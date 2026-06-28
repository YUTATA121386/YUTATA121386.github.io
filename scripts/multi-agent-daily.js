#!/usr/bin/env node
/**
 * YUTATA 多Agent日报系统 v4
 * 五个角色并行博弈: 采集师·核查师·分析师·编辑师·记忆管理师
 */

const fs = require("fs");
const path = require("path");

function writeFileUTF8(filepath, content) {
  fs.writeFileSync(filepath, content, { encoding: "utf-8", flag: "w" });
  const buf = fs.readFileSync(filepath);
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    fs.writeFileSync(filepath, buf.slice(3));
  }
}
const http = require("http");
const https = require("https");

const SHARED = require("./agents/shared");
const {
  DEEPSEEK_KEY, OUTPUT_DIR, LOGS_DIR, WEEKLY_DIR, RULES_DIR,
  AGENT_NAMES_CN, createInitialState,
  updateReputation, getReputationWeight,
  createMessage, callDeepSeek, loadPrompt,
  generateRuleVersion, extractJSON, log
} = SHARED;

const CONFIG_FILE = path.join(__dirname, "sources.json");
let CONFIG;
try { CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")); }
catch (e) { console.error("无法加载 sources.json:", e.message); process.exit(1); }

const SOURCES = CONFIG.sources;
const KEYWORDS = CONFIG.keywords;

if (!DEEPSEEK_KEY) { console.error("DEEPSEEK_API_KEY 未设置"); process.exit(1); }

// ===================== RSS 采集 =====================
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: 30000, headers: { "User-Agent": "YUTATA-Radar/4.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchUrl(res.headers.location).then(resolve).catch(reject);
        return;
      }
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

async function fetchRSS(source) {
  try {
    const xml = await fetchUrl(source.url);
    const { parseStringPromise: parser } = require("xml2js");
    let result;
    try {
      result = await parser(xml, { explicitArray: false, mergeAttrs: true, strict: false, normalizeTags: true });
    } catch (parseErr) {
      log("collector", "XML解析失败 " + source.name + ": " + parseErr.message.slice(0, 80));
      return [];
    }
    const items = [];
    
    // RSS 2.0
    if (result.rss && result.rss.channel) {
      const channel = result.rss.channel;
      const channelItems = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
      for (const item of channelItems.slice(0, 15)) {
        const title = typeof item.title === "string" ? item.title : (item.title?._ || item.title?.__text || "");
        const link = typeof item.link === "string" ? item.link : (item.link?.href || item.link?._ || "");
        const pubDate = typeof item.pubdate === "string" ? item.pubdate : (item.pubdate?._ || "");
        const desc = typeof item.description === "string" ? item.description : (item.description?._ || "");
        const cleanSummary = String(desc || "").replace(/<[^>]*>/g, "").trim().slice(0, 300);
        if (title && link) items.push({ title: String(title), link: String(link), source: source.name, lang: source.lang, pubDate: String(pubDate), summary: cleanSummary });
      }
    }
    
    // Atom
    if (result.feed && result.feed.entry) {
      const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
      for (const entry of entries.slice(0, 15)) {
        if (!entry) continue;
        const title = typeof entry.title === "string" ? entry.title : (entry.title?._ || entry.title?.__text || "");
        const link = typeof entry.link === "string" ? entry.link : (entry.link?.href || "");
        const pubDate = entry.published || entry.updated || "";
        const summary = typeof entry.summary === "string" ? entry.summary : (entry.summary?._ || entry.summary?.__text || "");
        if (title && link) items.push({ title: String(title), link: String(link), source: source.name, lang: source.lang, pubDate: String(pubDate), summary: String(summary || "").slice(0, 300) });
      }
    }
    
    log("collector", source.name + ": " + items.length + " 条");
    return items;
  } catch (e) { log("collector", "采集失败 " + source.name + ": " + e.message.slice(0, 80)); return []; }
}

function matchKeywords(text) {
  const matched = [];
  const tl = text.toLowerCase();
  for (const [cat, kws] of Object.entries(KEYWORDS)) {
    for (const kw of kws) { if (tl.includes(kw.toLowerCase())) { matched.push(cat); break; } }
  }
  return matched;
}

function normalizeTitle(title) {
  return title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff\s]/g, "").replace(/\s+/g, " ").trim();
}

function loadHistory() {
  const seenUrls = new Set();
  const seenTitles = new Map();
  let files;
  try { files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith(".md") && f !== "index.md" && /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort(); }
  catch { return { seenUrls, seenTitles }; }
  for (const file of files) {
    const content = fs.readFileSync(path.join(OUTPUT_DIR, file), "utf-8");
    const refRegex = /\[(\d+)\]\s*\*\*\[([^\]]+)\]\(([^)]+)\)\*\*/g;
    let match;
    while ((match = refRegex.exec(content)) !== null) {
      seenUrls.add(match[3]);
      seenTitles.set(normalizeTitle(match[2]), { date: file.replace(".md", ""), title: match[2], link: match[3] });
    }
  }
  return { seenUrls, seenTitles };
}

// ===================== Agent 上下文构建 =====================
function buildAgentContext(agentId, state) {
  const msgs = state.messages.filter(m => m.to === agentId || m.to === "all").slice(-20);
  let ctx = "## 当前状态\n日期: " + state.date + " | 轮次: " + state.round + "/" + state.maxRounds + " | 阶段: " + state.phase + "\n";
  ctx += "僵局: " + (state.deadlockDetected ? "⚠️ 已触发" : "正常") + " | 紧急: " + (state.emergencyChannel ? "⚡ 激活" : "未激活") + "\n";
  ctx += "信誉分: " + (state.reputation[agentId]?.score || 80) + "\n\n";

  ctx += "## 待处理消息\n";
  if (msgs.length === 0) ctx += "(无新消息)\n";
  for (const m of msgs) {
    ctx += "[" + m.id + "] " + m.from + " → " + m.to + " | " + m.type + " | " + m.priority + "\n";
    ctx += "  " + m.coreInfo + "\n";
    if (m.expectedAction) ctx += "  期望: " + m.expectedAction + "\n";
    if (m.reason) ctx += "  理由: " + m.reason + "\n\n";
  }

  ctx += "\n## 工作区\n";
  if (agentId === "collector") {
    ctx += "rawItems: " + state.rawItems.length + " | 待补采请求: " + state.supplementRequests.filter(r => r.status === "pending").length + "\n";
    const rej = state.messages.filter(m => m.type === "REJECT" && m.to === "collector").slice(-5);
    if (rej.length) { ctx += "最近被打回:\n"; for (const r of rej) ctx += "  - " + r.coreInfo + "\n"; }
    ctx += "\n## 采集规则\n" + (state.rules["collection-rules"] || "(无)") + "\n";
  }
  if (agentId === "verifier") {
    const pending = state.rawItems.filter(i => i.status === "pending");
    ctx += "待审核: " + pending.length + " 条\n";
    for (const item of pending.slice(0, 20)) {
      ctx += "  [" + item.id + "] " + item.title.slice(0, 80) + " | " + item.source + " | " + item.lang + "\n";
      ctx += "   分类: " + (item.keywords_matched || []).join(", ") + " | " + item.summary.slice(0, 120) + "\n";
    }
    ctx += "\n## 核查规则\n" + (state.rules["verification-rules"] || "(无)") + "\n";
  }
  if (agentId === "analyst") {
    ctx += "已验证: " + state.verifiedItems.length + " | 已有insight: " + state.insights.length + "\n";
    for (const item of state.verifiedItems.slice(-15)) ctx += "  [" + item.id + "] " + item.title.slice(0, 80) + " | " + item.category + "\n";
  }
  if (agentId === "editor") {
    ctx += "已验证: " + state.verifiedItems.length + " | insights: " + state.insights.length + "\n";
    if (state.draft) ctx += "草稿已有 " + (state.draft.sections?.length || 0) + " 个章节\n";
    ctx += "\n## 排版规范\n" + (state.rules["style-guide"] || "(无)") + "\n";
  }
  if (agentId === "memory-manager") {
    ctx += "rawItems: " + state.rawItems.length + " | verified: " + state.verifiedItems.length + " | rejected: " + state.rejectedItems.length + "\n";
    ctx += "insights: " + state.insights.length + " | 消息总数: " + state.messages.length + "\n";
    ctx += "采集提交: " + state.stats.collectorSubmitted + " | 通过: " + state.stats.verifierPassed + " | 拒绝: " + state.stats.verifierRejected + "\n";
  }
  ctx += "\n## 最近消息\n";
  for (const m of state.messages.slice(-30)) ctx += "[" + m.id + "] " + m.from + "→" + m.to + " " + m.type + ": " + m.coreInfo + "\n";
  return ctx;
}

// ===================== Agent 执行 =====================
async function runAgent(agentId, state, extraInstructions) {
  const systemPrompt = loadPrompt(agentId);
  const context = buildAgentContext(agentId, state);
  const fullPrompt = context + (extraInstructions ? "\n## 本轮特殊指令\n" + extraInstructions + "\n" : "");

  log(agentId, "开始思考... (轮次" + state.round + ")");
  try {
    const response = await callDeepSeek(systemPrompt, fullPrompt, 0.7, 4096);
    const result = extractJSON(response);
    if (result) {
      if (result.internal_thought) log(agentId, "💭 " + result.internal_thought.slice(0, 120));
      if (result.messages && Array.isArray(result.messages)) {
        for (const msg of result.messages) {
          const message = createMessage(agentId, (msg.to === "memory_manager" ? "memory-manager" : msg.to), msg.type, msg.coreInfo, msg.expectedAction, msg.reason, msg.priority);
          state.messages.push(message);
          log(agentId, "📤 → " + msg.to + ": [" + msg.type + "] " + (msg.coreInfo || "").slice(0, 80));
        }
      }
      return result;
    }
    log(agentId, "⚠️ 无法解析输出");
    return { raw_output: response.slice(0, 500), actions: [], messages: [] };
  } catch (err) {
    log(agentId, "❌ 失败: " + err.message);
    return { error: err.message, actions: [], messages: [] };
  }
}

// ===================== 僵局检测 =====================
function detectDeadlock(state) {
  const recent = state.messages.slice(-50);
  if (recent.filter(m => m.type === "ESCALATE").length >= 2) { log("system", "⚠️ 升级消息触发僵局"); return true; }
  const rejects = recent.filter(m => m.type === "REJECT");
  const rc = {};
  for (const r of rejects) { const k = r.from + "→" + r.to; rc[k] = (rc[k] || 0) + 1; }
  for (const [k, v] of Object.entries(rc)) { if (v >= 4) { log("system", "⚠️ " + k + " 连续打回" + v + "次"); return true; } }
  if (state.round >= 4 && state.stats.verifierPassed === 0 && state.rejectedItems.length > state.verifiedItems.length * 2) { log("system", "⚠️ 核查通过率持续为0"); return true; }
  return false;
}

// ===================== 仲裁 =====================
async function runArbitration(state) {
  log("system", "⚖️ ===== 仲裁会议 =====");
  state.phase = "arbitration";
  state.arbitration = { rounds: [], verdict: null };

  const r1Inst = "## 仲裁初审（事实陈述）\n你是记忆管理师。请基于所有消息提取客观事实清单和争议规则条款。\n输出: { \"arbitration_round\": 1, \"fact_list\": [...], \"disputed_rules\": [...], \"internal_thought\": \"...\" }";
  const r1 = await runAgent("memory-manager", state, r1Inst);
  state.arbitration.rounds.push({ round: 1, phase: "初审", result: r1 });

  const r2Inst = "## 仲裁复审（观点辩论）\n你是记忆管理师。请模拟各方立场。\n输出: { \"arbitration_round\": 2, \"positions\": { \"collector\": \"...\", \"verifier\": \"...\", \"analyst\": \"...\", \"editor\": \"...\" }, \"internal_thought\": \"...\" }";
  const r2 = await runAgent("memory-manager", state, r2Inst);
  state.arbitration.rounds.push({ round: 2, phase: "复审", result: r2 });

  const r3Inst = "## 仲裁终审（裁决）\n你是记忆管理师。必须做出最终强制裁决。\n输出: { \"arbitration_round\": 3, \"verdict\": { \"summary\": \"...\", \"decision\": \"...\", \"action_items\": [...], \"rule_changes\": [...], \"reputation_changes\": [...] }, \"internal_thought\": \"...\" }";
  const r3 = await runAgent("memory-manager", state, r3Inst);
  state.arbitration.rounds.push({ round: 3, phase: "终审", result: r3 });
  state.arbitration.verdict = r3.arbitration_verdict || r3.verdict;

  log("system", "⚖️ ===== 仲裁结束 =====");
  return state.arbitration.verdict;
}

// ===================== 紧急通道 =====================
async function handleEmergencyChannel(state) {
  log("system", "⚡ 紧急通道触发");
  const inst = "## 紧急通道讨论\n你是记忆管理师。PRIORITY_OVERRIDE已触发。召集全体投票（管理师2票，其余各1票，≥4票通过）。\n输出: { \"emergency_discussion\": { \"triggered_by\": \"...\", \"topic\": \"...\", \"votes\": {...}, \"result\": \"passed/rejected\", \"total_votes\": N }, \"internal_thought\": \"...\" }";
  const result = await runAgent("memory-manager", state, inst);
  return result;
}

// ===================== 过程日志生成 =====================
﻿function generateProcessLog(state, dateStr) {
  var dateCN = new Date(dateStr).getFullYear() + "\u5e74" + (new Date(dateStr).getMonth() + 1) + "\u6708" + new Date(dateStr).getDate() + "\u65e5";
  var pr = state.stats.collectorSubmitted > 0 ? ((state.stats.verifierPassed / state.stats.collectorSubmitted) * 100).toFixed(1) : "0";

  var c = "<style>\n" +
    ".chat-log { max-width: 860px; margin: 0 auto; }\n" +
    ".chat-msg { display: flex; gap: 12px; margin: 0 0 1px 0; padding: 14px 16px; transition: background 0.15s; border-radius: 6px; }\n" +
    ".chat-msg:hover { background: rgba(0,0,0,0.02); }\n" +
    ".chat-round-divider { text-align: center; margin: 24px 0 12px; font-size: 0.85em; color: #999; border-top: 1px solid var(--vp-c-divider); padding-top: 12px; }\n" +
    ".chat-avatar { flex-shrink: 0; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; }\n" +
    ".chat-from-collector .chat-avatar { background: #fde8e8; }\n" +
    ".chat-from-verifier .chat-avatar { background: #e6f9ed; }\n" +
    ".chat-from-analyst .chat-avatar { background: #e3f0fc; }\n" +
    ".chat-from-editor .chat-avatar { background: #f3eafa; }\n" +
    ".chat-from-memory-manager .chat-avatar { background: #fef3d5; }\n" +
    ".chat-content { flex: 1; min-width: 0; }\n" +
    ".chat-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 0.85em; flex-wrap: wrap; }\n" +
    ".chat-sender { font-weight: 600; }\n" +
    ".chat-from-collector .chat-sender { color: #c0392b; }\n" +
    ".chat-from-verifier .chat-sender { color: #1e8449; }\n" +
    ".chat-from-analyst .chat-sender { color: #2471a3; }\n" +
    ".chat-from-editor .chat-sender { color: #7d3c98; }\n" +
    ".chat-from-memory-manager .chat-sender { color: #b7950b; }\n" +
    ".chat-badge { display: inline-block; padding: 1px 7px; border-radius: 3px; font-size: 0.75em; font-weight: 500; background: #eee; color: #555; white-space: nowrap; }\n" +
    ".chat-time { color: #999; font-size: 0.8em; margin-left: auto; }\n" +
    ".chat-body { font-size: 0.93em; line-height: 1.6; color: #333; }\n" +
    ".chat-body blockquote { margin: 4px 0 0 0; padding: 2px 0 2px 10px; border-left: 2px solid #ddd; color: #555; }\n" +
    ".chat-footer { margin-top: 6px; font-size: 0.8em; color: #888; display: flex; gap: 12px; flex-wrap: wrap; }\n" +
    ".arb-anchor { display: inline-block; padding: 1px 8px; border-radius: 3px; font-size: 0.8em; background: #fdebd0; color: #b7950b; text-decoration: none; font-weight: 600; }\n" +
    ".dark .chat-msg:hover { background: rgba(255,255,255,0.03); }\n" +
    ".dark .chat-from-collector .chat-avatar { background: #3d1a1a; }\n" +
    ".dark .chat-from-verifier .chat-avatar { background: #1a3d1a; }\n" +
    ".dark .chat-from-analyst .chat-avatar { background: #1a1a3d; }\n" +
    ".dark .chat-from-editor .chat-avatar { background: #3d1a3d; }\n" +
    ".dark .chat-from-memory-manager .chat-avatar { background: #3d3a1a; }\n" +
    ".dark .chat-from-collector .chat-sender { color: #e74c3c; }\n" +
    ".dark .chat-from-verifier .chat-sender { color: #2ecc71; }\n" +
    ".dark .chat-from-analyst .chat-sender { color: #3498db; }\n" +
    ".dark .chat-from-editor .chat-sender { color: #a569bd; }\n" +
    ".dark .chat-from-memory-manager .chat-sender { color: #f1c40f; }\n" +
    ".dark .chat-body { color: #ccc; }\n" +
    ".dark .chat-badge { background: #333; color: #aaa; }\n" +
    ".dark .chat-body blockquote { border-left-color: #444; color: #999; }\n" +
    ".dark .chat-footer { color: #777; }\n" +
    ".dark .arb-anchor { background: #3d3500; }\n" +
    "</style>\n\n";

  var tL = { REJECT: "\uD83D\uDEAB \u6253\u56DE", REQUEST: "\uD83D\uDCE9 \u8BF7\u6C42", DISPUTE: "\u2694\uFE0F \u8D28\u7591", NOTIFY: "\uD83D\uDCE2 \u901A\u77E5", ESCALATE: "\u26A0\uFE0F \u5347\u7EA7", CONFIRM: "\u2705 \u786E\u8BA4", DIRECTIVE: "\uD83D\uDC51 \u6307\u4EE4", APPROVE: "\uD83D\uDC4D \u6279\u51C6", GUIDANCE: "\uD83D\uDCA1 \u6307\u5BFC", PRIORITY_OVERRIDE: "\u26A1 \u7D27\u6025", INQUIRE: "\uD83D\uDD0E \u8BE2\u95EE" };
  var avatars = { collector: "\uD83D\uDCE1", verifier: "\uD83D\uDD0D", analyst: "\uD83D\uDD2C", editor: "\u270D\uFE0F", "memory-manager": "\uD83E\uDDE0" };

  function stripMD(text) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/^- /gm, "\u2022 ")
      .replace(/\n- /g, "\n\u2022 ")
      .replace(/%/g, "\uFF05").replace(/TL;DR/gi, "\uD83D\uDCCB \u8981\u70B9\u603B\u7ED3");
  }

  var msgs = '<div class="chat-log">\n';
  var hasArb = !!state.arbitration;
  var arbLinked = false;
  var roundMsgs = {};

  state.messages.forEach(function(m, mi) {
    var rKey = Math.floor(mi / Math.max(1, Math.ceil(state.messages.length / state.round)));
    if (!roundMsgs[rKey]) roundMsgs[rKey] = [];
    roundMsgs[rKey].push({ msg: m, idx: mi });
  });

  var rKeys = Object.keys(roundMsgs).sort(function(a,b) { return a-b; });
  rKeys.forEach(function(rk) {
    var roundLabel = "\u7B2C" + (parseInt(rk)+1) + "\u8F6E";
    msgs += '<div class="chat-round-divider">\u25CF ' + roundLabel + '</div>\n';

    roundMsgs[rk].forEach(function(entry) {
      var m = entry.msg;
      var mi = entry.idx;
      var fn = AGENT_NAMES_CN[m.from] || m.from;
      var tn = AGENT_NAMES_CN[m.to] || m.to;
      var av = avatars[m.from] || "\uD83D\uDCAC";
      var tl = tL[m.type] || m.type;
      var time = m.timestamp ? (function(ts) { if (!ts) return ""; var d = new Date(ts); var h = String((d.getUTCHours() + 8) % 24).padStart(2, "0"); var m = String(d.getUTCMinutes()).padStart(2, "0"); return h + ":" + m; })(m.timestamp) : "";

      msgs += '<div class="chat-msg chat-from-' + m.from + '" id="msg-' + mi + '">\n';
      msgs += '<div class="chat-avatar">' + av + '</div>\n';
      msgs += '<div class="chat-content">\n';
      msgs += '<div class="chat-meta">\n';
      msgs += '<span class="chat-sender">' + fn + '</span>\n';
      msgs += '<span class="chat-badge">' + tl + '</span>\n';
      msgs += '<span style="opacity:0.6">\u2192 ' + tn + '</span>\n';

      if (hasArb && !arbLinked && (m.type === "ESCALATE" || m.type === "DISPUTE")) {
        msgs += '<a href="#arbitration" class="arb-anchor">\u2696\uFE0F \u4EF2\u88C1</a>\n';
        arbLinked = true;
      }

      msgs += '<span class="chat-time">' + time + '</span>\n';
      msgs += '</div>\n';
      msgs += '<div class="chat-body">\n';

      var allItems = {};
      state.rawItems.forEach(function(item) { allItems[item.id] = item.title; });
      state.verifiedItems.forEach(function(item) { allItems[item.id] = item.title; });
      state.rejectedItems.forEach(function(item) { allItems[item.id] = item.title; });
      state.rawItems.forEach(function(item) { var parts = item.id.split('-'); var short = 'RAW-' + parts[parts.length-1]; allItems[short] = item.title; });
      
      var cleanText = m.coreInfo
        .replace(/RAW-(\d{4}-\d{2}-\d{2}-\d{4})/g, function(match, idSuffix) {
          var fullId = "RAW-" + idSuffix;
          var title = allItems[fullId];
          if (!title) { var shortId = "RAW-" + idSuffix.slice(-4); title = allItems[shortId]; }
          if (!title) { for (var k in allItems) { if (k.endsWith(idSuffix)) { title = allItems[k]; break; } } }
          return title ? "\u3010\u7D20\u6750\uFF1A" + title.slice(0, 30) + "\u3011" : "\u3010\u7D20\u6750\u3011";
        })
        .replace(/RAW-(\d{4})\b(?!-)/g, function(match, shortId) {
          var found = null;
          for (var k in allItems) { if (k.endsWith("-" + shortId)) { found = allItems[k]; break; } }
          return found ? "\u3010\u7D20\u6750\uFF1A" + found.slice(0, 30) + "\u3011" : match;
        })
        .replace(/MSG-[A-Z]{3}-\d{4}-\d{2}-\d{2}-\d{3}/g, "\u3010\u6D88\u606F\u3011")
        .replace(/REQ-[A-Z]{3}-\d{4}-\d{2}-\d{2}-\d{3}/g, "\u3010\u8BF7\u6C42\u3011")
        .replace(/INS-\d{4}-\d{2}-\d{2}-\d{3}/g, "\u3010\u6D1E\u5BDF\u3011");
      
      cleanText = stripMD(cleanText);
      cleanText = cleanText.replace(/\[【/g, "【").replace(/】\]/g, "】");

      msgs += '<blockquote>' + cleanText.replace(/\n/g, '<br>') + '</blockquote>\n';
      msgs += '</div>\n';

      if (m.expectedAction || m.reason) {
        msgs += '<div class="chat-footer">\n';
        if (m.expectedAction) msgs += '<span>\uD83C\uDFAF ' + stripMD(m.expectedAction) + '</span>\n';
        if (m.reason) msgs += '<span>\uD83D\uDCDD ' + stripMD(m.reason) + '</span>\n';
        msgs += '</div>\n';
      }

      msgs += '</div></div>\n\n';
    });
  });
  msgs += '</div>\n';

  var arb = "";
  if (state.arbitration && state.arbitration.verdict) {
    arb = '\n---\n\n## \u2696\uFE0F \u4EF2\u88C1\u8BB0\u5F55 <a id="arbitration"></a>\n\n';
    var vd = state.arbitration.verdict;
    if (state.arbitration.rounds[0] && state.arbitration.rounds[0].result && state.arbitration.rounds[0].result.fact_list) {
      arb += '### \u521D\u5BA1 \u00B7 \u4E8B\u5B9E\u6E05\u5355\n\n';
      state.arbitration.rounds[0].result.fact_list.forEach(function(f) { arb += '- ' + f + '\n'; });
      arb += '\n';
    }
    if (state.arbitration.rounds[1] && state.arbitration.rounds[1].result && state.arbitration.rounds[1].result.positions) {
      arb += '### \u590D\u5BA1 \u00B7 \u5404\u65B9\u89C2\u70B9\n\n';
      for (var pk in state.arbitration.rounds[1].result.positions) {
        arb += '**' + (AGENT_NAMES_CN[pk] || pk) + '**\uFF1A' + state.arbitration.rounds[1].result.positions[pk] + '\n\n';
      }
    }
    arb += '### \u7EC8\u5BA1 \u00B7 \u88C1\u51B3\n\n';
    if (vd.summary) arb += '> **\u4E89\u8BAE\u6458\u8981**\uFF1A' + vd.summary + '\n>\n';
    if (vd.decision) arb += '> **\u88C1\u51B3\u7ED3\u679C**\uFF1A' + vd.decision + '\n>\n';
    if (vd.action_items && vd.action_items.length) {
      arb += '> **\u6267\u884C\u6B65\u9AA4**\uFF1A\n';
      vd.action_items.forEach(function(a) { arb += '> - ' + a + '\n'; });
      arb += '>\n';
    }
    if (vd.rule_changes && vd.rule_changes.length) {
      arb += '> **\u89C4\u5219\u53D8\u66F4**\uFF1A\n';
      vd.rule_changes.forEach(function(r) { 
        arb += '> - ' + (typeof r === "string" ? r : (r.reason || r.file || JSON.stringify(r))) + '\n';
      });
    }
    arb += '\n';
  }

  var emerg = "";
  if (state.emergencyChannel) {
    emerg = '\n---\n\n## \u26A1 \u7D27\u6025\u901A\u9053\n\n- \u89E6\u53D1\uFF1A' + (state.emergencyChannel.triggered_by || "\u672A\u77E5") + ' | ' + (state.emergencyChannel.topic || "\u672A\u77E5") + '\n';
  }


  // ===== ???? + ???? =====
  var retro = "\n## \uD83D\uDCDD \u4ECA\u65E5\u590D\u76D8\n\n> \u6BCF\u4E2A\u89D2\u8272\u5BF9\u4ECA\u65E5\u5DE5\u4F5C\u7684\u603B\u7ED3\u4E0E\u53CD\u601D\n\n";
  var agentLastMsg = {};
  state.messages.forEach(function(m) { agentLastMsg[m.from] = m; });
  var agentOrder = ["collector", "verifier", "analyst", "editor", "memory-manager"];
  agentOrder.forEach(function(aid) {
    var m = agentLastMsg[aid];
    var name = AGENT_NAMES_CN[aid] || aid;
    var av = avatars[aid] || "\uD83D\uDCAC";
    retro += '<div class="chat-msg chat-from-' + aid + '">\n';
    retro += '<div class="chat-avatar">' + av + '</div>\n';
    retro += '<div class="chat-content">\n';
    retro += '<div class="chat-meta"><span class="chat-sender">' + name + '</span><span class="chat-badge">\uD83D\uDCDD \u590D\u76D8</span></div>\n';
    retro += '<div class="chat-body"><blockquote>';
    if (m) { retro += stripMD(m.coreInfo.slice(0, 200)); }
    else { retro += name + '\u672A\u53C2\u4E0E\u4ECA\u65E5\u5DE5\u4F5C\u3002'; }
    retro += '</blockquote></div>\n';
    retro += '</div></div>\n\n';
  });
  retro += '<div class="chat-round-divider">\u25CF \u5BA1\u7A3F\u53CD\u9988</div>\n';
  var reviewMsgs = state.messages.filter(function(m) { return m.type === "APPROVE" || m.type === "CONFIRM"; }).slice(-10);
  if (reviewMsgs.length === 0) {
    retro += '<p style="color:#999;text-align:center;padding:12px;">\u26A0\uFE0F \u672C\u6B21\u672A\u8FDB\u884C\u6B63\u5F0F\u5BA1\u7A3F\u6D41\u7A0B</p>\n';
  } else {
    reviewMsgs.forEach(function(m) {
      var fn = AGENT_NAMES_CN[m.from] || m.from;
      var av = avatars[m.from] || "\uD83D\uDCAC";
      retro += '<div class="chat-msg chat-from-' + m.from + '">\n';
      retro += '<div class="chat-avatar">' + av + '</div>\n';
      retro += '<div class="chat-content">\n';
      retro += '<div class="chat-meta"><span class="chat-sender">' + fn + '</span><span class="chat-badge">\u2705 \u5BA1\u7A3F</span></div>\n';
      retro += '<div class="chat-body"><blockquote>' + stripMD(m.coreInfo.slice(0, 150)) + '</blockquote></div>\n';
      retro += '</div></div>\n\n';
    });
  }

  return "---\ntitle: " + dateStr + " | \u56E2\u961F\u8FC7\u7A0B\u65E5\u5FD7\noutline: [2, 3]\n---\n\n" + c +
    "# \uD83D\uDCCB \u56E2\u961F\u8FC7\u7A0B\u65E5\u5FD7 \u00B7 " + dateCN + "\n\n" +
    "## \uD83D\uDCCA \u4ECA\u65E5\u7EDF\u8BA1\n\n" +
    "| \u6307\u6807 | \u6570\u636E |\n|------|------|\n" +
    "| \u603B\u8F6E\u6B21 | " + state.round + " (" + (state.deadlockDetected ? "\u5DF2\u89E6\u53D1\u4EF2\u88C1" : "\u6B63\u5E38\u6D41\u7A0B") + ") |\n" +
    "| \u91C7\u96C6\u63D0\u4EA4 | " + state.stats.collectorSubmitted + " \u6761 |\n" +
    "| \u6838\u67E5\u901A\u8FC7 | " + state.stats.verifierPassed + " \u6761\uFF08\u901A\u8FC7\u7387 " + pr + "%\uFF09 |\n" +
    "| \u6838\u67E5\u62D2\u7EDD | " + state.stats.verifierRejected + " \u6761 |\n" +
    "| \u8865\u91C7\u8BF7\u6C42 | " + state.stats.analystRequests + " \u6B21 |\n" +
    "| \u7D27\u6025\u901A\u9053 | " + (state.emergencyChannel ? "\u5DF2\u89E6\u53D1" : "\u672A\u89E6\u53D1") + " |\n" +
    "| \u89C4\u5219\u53D8\u66F4 | " + (state.stats.ruleChanges || 0) + " \u6761 |\n\n" +
    emerg +
    "## \uD83D\uDCAC \u5B8C\u6574\u901A\u4FE1\u8BB0\u5F55\n\n" + msgs + "\n" +
    arb +
    "\n---\n> \u751F\u6210\u65F6\u95F4: " + new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + "\n";
}


// ===================== 周报生成 =====================
function generateWeeklyReport(state, dateStr) {
  var weekNum = (function(d) { var start = new Date(d.getFullYear(), 0, 1); var days = Math.floor((d - start) / 86400000); return Math.ceil((days + start.getDay() + 1) / 7); })(new Date(dateStr));
  var rep = state.reputation;
  var dateCN = new Date(dateStr).getFullYear() + "\u5e74" + (new Date(dateStr).getMonth() + 1) + "\u6708" + new Date(dateStr).getDate() + "\u65e5";
  var agents = ["collector", "verifier", "analyst", "editor", "memory-manager"];
  
  // Build reputation chart (HTML bar chart)
  var chartHtml = '<div class="rep-chart">\n';
  agents.forEach(function(aid) {
    if (aid === "memory-manager") return;
    var score = rep[aid] ? rep[aid].score : 80;
    var name = AGENT_NAMES_CN[aid] || aid;
    var pct = score + "%";
    var color = aid === "collector" ? "#e74c3c" : aid === "verifier" ? "#2ecc71" : aid === "analyst" ? "#3498db" : "#a569bd";
    chartHtml += '<div class="rep-bar-row">\n';
    chartHtml += '<span class="rep-bar-label">' + name + '</span>\n';
    chartHtml += '<div class="rep-bar-track"><div class="rep-bar-fill" style="width:' + pct + ';background:' + color + ';"></div></div>\n';
    chartHtml += '<span class="rep-bar-score">' + score + '</span>\n';
    chartHtml += '</div>\n';
  });
  chartHtml += '</div>\n';
  
  // Build history table
  var historyRows = "";
  agents.forEach(function(aid) {
    var name = AGENT_NAMES_CN[aid] || aid;
    var h = rep[aid] ? rep[aid].history || [] : [];
    var recent = h.slice(-7);
    var score = rep[aid] ? rep[aid].score : 80;
    var trend = recent.length >= 2 ? (recent[recent.length-1].scoreAfter - recent[0].scoreAfter) : 0;
    var trendIcon = trend > 0 ? "\u2191" : trend < 0 ? "\u2193" : "\u2192";
    historyRows += "| " + name + " | " + score + " | " + trendIcon + " " + (trend > 0 ? "+" : "") + trend + " | " + recent.length + " |\n";
  });
  
  // Memory manager review section
  var mmReview = "## \uD83D\uDC65 \u7BA1\u7406\u5E08\u8BC4\u4EF7\uFF08\u56DB\u4E2A\u89D2\u8272\u6253\u5206\uFF09\n\n";
  mmReview += "> \u6BCF\u5468\u7531\u91C7\u96C6\u5E08\u3001\u6838\u67E5\u5E08\u3001\u5206\u6790\u5E08\u3001\u7F16\u8F91\u5E08\u5BF9\u8BB0\u5FC6\u7BA1\u7406\u5E08\u7684\u5DE5\u4F5C\u8FDB\u884C\u8BC4\u4EF7\n\n";
  mmReview += "| \u8BC4\u5206\u89D2\u8272 | \u5206\u6570 | \u8BC4\u8BED |\n|------|------|------|\n";
  var mmReviewers = ["collector", "verifier", "analyst", "editor"];
  mmReviewers.forEach(function(aid) {
    var name = AGENT_NAMES_CN[aid] || aid;
    mmReview += "| " + name + " | -/10 | \u5F85\u8BC4\u4EF7 |\n";
  });
  mmReview += "\n> \u4E0B\u5468\u4E00\u8FD0\u884C\u540E\u81EA\u52A8\u586B\u5145\n";
  
  return "---\ntitle: " + dateStr + " | \u7B2C" + weekNum + "\u5468\u5DE5\u4F5C\u62A5\u544A\noutline: [2, 3]\n---\n\n" +
    
    "# \uD83D\uDCCA \u7B2C" + weekNum + "\u5468 \u00B7 AI\u56E2\u961F\u5DE5\u4F5C\u62A5\u544A\n\n" +
    "> \u751F\u6210\u65E5\u671F: " + dateCN + "\n\n" +
    "## \uD83D\uDCC8 \u5404\u89D2\u8272\u4FE1\u8A89\u5206\u8D70\u52BF\n\n" + chartHtml + "\n\n" +
    "## \uD83D\uDCCA \u672C\u5468\u6570\u636E\n\n" +
    "| \u89D2\u8272 | \u5F53\u524D\u5206 | \u8D8B\u52BF | \u8BB0\u5F55\u6761\u6570 |\n|------|--------|------|------|\n" + historyRows + "\n\n" +
    mmReview + "\n\n" +
    "## \uD83D\uDCDD \u672C\u5468\u89C4\u5219\u8FED\u4EE3\n\n" +
    "> \u672C\u5468\u89C4\u5219\u53D8\u66F4\u8BB0\u5F55\n\n" +
    (state.stats.ruleChanges ? "| \u53D8\u66F4\u6761\u6570 | \u8BF4\u660E |\n|------|------|\n| " + (state.stats.ruleChanges || 0) + " \u6761 | \u7531\u8BB0\u5FC6\u7BA1\u7406\u5E08\u5728\u65E5\u5E38\u590D\u76D8\u4E2D\u81EA\u52A8\u6267\u884C |\n" : "| \u53D8\u66F4\u6761\u6570 | \u8BF4\u660E |\n|------|------|\n| 0 \u6761 | \u672C\u5468\u672A\u89E6\u53D1\u89C4\u5219\u8FED\u4EE3 |\n") + "\n\n" +
    "---\n> \u751F\u6210\u65F6\u95F4: " + new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + "\n";
}
// ===================== 索引更新 =====================
function updateDailyIndex(dateStr) {
  var indexPath = path.join(OUTPUT_DIR, "index.md");
  var content;
  try { content = fs.readFileSync(indexPath, "utf-8"); } catch (e) { return; }

  // Check if entry already exists to avoid duplicates
  if (content.indexOf(dateStr) >= 0) return;

  // Insert new entry in the scroll-list div
  var marker = '<div class="scroll-list">';
  var insertPos = content.indexOf(marker);
  if (insertPos > 0) {
    var lineStart = content.indexOf("\n", insertPos) + 1;
    var newEntry = "- [" + dateStr + "](./" + dateStr + ".md)\n";
    content = content.substring(0, lineStart) + newEntry + content.substring(lineStart);
    fs.writeFileSync(indexPath, content, "utf-8");
  }
}
// ===================== 主流程 =====================
async function main() {
  const now = new Date();
  const dateStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const dateCN = now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日";

  console.log("\n🤖 YUTATA 多Agent日报系统 v4");
  console.log("📅 " + dateCN + " | " + dateStr);
  console.log("👥 五个角色: 采集师 · 核查师 · 分析师 · 编辑师 · 记忆管理师\n");

  // ===== 初始化 =====
  log("system", "阶段0: 初始化");
  const state = createInitialState(dateStr);
  state.phase = "init";

  // ===== 首次抓取 =====
  log("system", "阶段1: 首次抓取");
  state.phase = "collecting";
  const history = loadHistory();
  log("system", "历史去重: " + history.seenUrls.size + " URL");

  const rssResults = await Promise.all(SOURCES.map(src => fetchRSS(src)));
  let idCounter = 0;
  for (let i = 0; i < SOURCES.length; i++) {
    for (const item of rssResults[i]) {
      if (history.seenUrls.has(item.link)) continue;
      const nt = normalizeTitle(item.title);
      if (history.seenTitles.has(nt)) continue;
      const kw = matchKeywords(item.title + " " + item.summary);
      idCounter++;
      state.rawItems.push({
        id: "RAW-" + dateStr + "-" + String(idCounter).padStart(4, "0"),
        ...item, keywords_matched: kw,
        category: kw.length > 0 ? kw[0] : "其他", status: "pending"
      });
    }
  }
  state.stats.collectorSubmitted = state.rawItems.length;
  log("collector", "首次抓取: " + state.rawItems.length + " 条新内容");

  state.messages.push(createMessage("collector", "verifier", "NOTIFY",
    "首次采集完成，" + state.rawItems.length + " 条待审核", "请开始核查", "今日基础素材", "high"));

  // ===== 多轮博弈 =====
  for (let round = 1; round <= state.maxRounds; round++) {
    state.round = round;
    log("system", "\n━━━ 第 " + round + "/" + state.maxRounds + " 轮 ━━━");

    const agentsToRun = [];
    const hasPendingSupp = state.supplementRequests.some(r => r.status === "pending");
    const hasDisputes = state.messages.slice(-10).some(m => m.type === "DISPUTE" && m.to === "collector");
    if ((hasPendingSupp || hasDisputes || round <= 2) && round <= 4) agentsToRun.push("collector");
    if (state.rawItems.some(i => i.status === "pending") && round <= 4) agentsToRun.push("verifier");
    if (state.verifiedItems.length > 0 && round <= 4) agentsToRun.push("analyst");
    if (round >= 2 && state.verifiedItems.length > 0 && round <= 5) agentsToRun.push("editor");
    if (round >= 2 || state.deadlockDetected) agentsToRun.push("memory-manager");

    if (agentsToRun.length === 0) { log("system", "第" + round + "轮跳过"); continue; }
    log("system", "参与: " + agentsToRun.map(a => AGENT_NAMES_CN[a]).join("、"));

    const agentResults = {};
    await Promise.all(agentsToRun.map(async (agentId) => {
      agentResults[agentId] = await runAgent(agentId, state);
    }));

    // 处理输出
    for (const [agentId, result] of Object.entries(agentResults)) {
      if (!result || result.error) continue;

      if (agentId === "collector" && result.actions) {
        for (const action of result.actions) {
          if (action.type === "collect" && action.items) {
            for (const item of action.items) {
              idCounter++;
              const kw = matchKeywords(item.title + " " + (item.summary || ""));
              state.rawItems.push({
                id: "RAW-" + dateStr + "-" + String(idCounter).padStart(4, "0"),
                ...item, keywords_matched: kw,
                category: kw.length > 0 ? kw[0] : "其他", status: "pending"
              });
            }
            state.stats.collectorSubmitted += (action.items?.length || 0);
          }
          if (action.type === "supplement_collect" && action.response_to_request) {
            const req = state.supplementRequests.find(r => r.request_id === action.response_to_request);
            if (req) { req.status = "fulfilled"; state.stats.analystHitRate += 10; }
          }
        }
      }

      if (agentId === "verifier" && result.actions) {
        for (const action of result.actions) {
          if (action.type === "verify" && action.item_id) {
            const item = state.rawItems.find(i => i.id === action.item_id);
            if (!item) continue;
            item.status = action.decision;
            item.verify_reason = action.reason;
            item.category = action.category || item.category;
            if (action.decision === "pass") { state.verifiedItems.push(item); state.stats.verifierPassed++; }
            else { state.rejectedItems.push(item); state.stats.verifierRejected++; }
          }
        }
      }

      if (agentId === "analyst" && result.actions) {
        for (const action of result.actions) {
          if (action.type === "analyze" && action.insight) {
            state.insights.push({ id: "INS-" + dateStr + "-" + String(state.insights.length + 1).padStart(3, "0"), ...action.insight });
          }
          if (action.type === "request_supplement" && action.request) {
            state.supplementRequests.push({
              request_id: "REQ-" + dateStr + "-" + String(state.supplementRequests.length + 1).padStart(3, "0"),
              ...action.request, status: "pending", requested_by: "analyst"
            });
            state.stats.analystRequests++;
          }
        }
      }

      if (agentId === "editor" && result.actions) {
        for (const action of result.actions) {
          if (action.type === "draft_update" && action.draft) state.draft = action.draft;
        }
      }
      // Editor fallback: if _parse_failed, try to extract draft from raw output
      if (agentId === "editor" && result._parse_failed && result.raw_output) {
        const raw = result.raw_output;
        // Try to extract markdown sections
        const sections = [];
        const sectionRegex = /##\s+(.+?)\n\n([\s\S]*?)(?=\n##\s|\n---\s|\n$)/g;
        let match;
        while ((match = sectionRegex.exec(raw)) !== null) {
          sections.push({ title: match[1].trim(), content: match[2].trim(), referenced_items: [], referenced_insights: [] });
        }
        if (sections.length > 0) {
          state.draft = { sections, word_count_estimate: raw.length };
          log("editor", "从原始输出恢复草稿: " + sections.length + " 个章节");
        }
      }

      if (agentId === "memory-manager" && result.actions) {
        for (const action of result.actions) {
          if (action.type === "update_rule") state.stats.ruleChanges = (state.stats.ruleChanges || 0) + 1;
          if (action.type === "update_reputation") {
            updateReputation(action.agent, action.delta, action.reason);
            state.reputation = require("./agents/shared").loadReputation();
          }
        }
        if (result.review) state.review = result.review;
      }
    }

    state.round = round;
    state.stats.roundExecuted = round;

    // 检测僵局
    if (round >= 3 && detectDeadlock(state)) {
      state.deadlockDetected = true;
      log("system", "⚠️ 僵局触发");
      if (state.messages.some(m => m.type === "PRIORITY_OVERRIDE")) {
        const emResult = await handleEmergencyChannel(state);
        state.emergencyChannel = emResult;
      }
      const verdict = await runArbitration(state);
      if (verdict && verdict.action_items) {
        for (const item of verdict.action_items) log("system", "📋 执行: " + item);
      }
      break;
    }
  }

  // ===== 收敛: 最终复盘 =====
  log("system", "\n━━━ 收敛阶段 ━━━");
  state.phase = "convergence";

  const finalInst = "## 最终复盘\n你是记忆管理师，今日" + dateCN + "。评估日报质量（完整性/准确性/深度/可读性0-10分）、优缺点、规则修改建议、信誉分调整。\n输出: { \"review\": { \"quality_scores\": {...}, \"strengths\": [...], \"weaknesses\": [...], \"root_cause\": \"...\" }, \"actions\": [{\"type\":\"update_rule\",\"rule_file\":\"...\",\"change_type\":\"add/modify\",\"after\":\"...\",\"reason\":\"...\"}], \"internal_thought\": \"...\" }";
  const finalReview = await runAgent("memory-manager", state, finalInst);

  if (finalReview.actions) {
    for (const action of finalReview.actions) {
      if (action.type === "update_rule" && action.rule_file) {
        const version = generateRuleVersion(dateStr);
        const rulePath = path.join(RULES_DIR, action.rule_file);
        const archivePath = path.join(RULES_DIR, "archive", action.rule_file.replace(".md", "-" + version + ".md"));
        try {
          const oldContent = fs.readFileSync(rulePath, "utf-8");
          fs.writeFileSync(archivePath, "# " + action.rule_file + " - " + version + "\n> 归档: " + dateStr + "\n\n" + oldContent, "utf-8");
        } catch {}
        const header = "---\ntitle: " + action.rule_file.replace(".md", "") + "\nversion: " + version + "\nupdated: " + dateStr + "\noutline: [2, 3]\n---\n\n> 📌 " + version + " | " + dateCN + "\n\n";
        writeFileUTF8(rulePath, header + (action.after || ""));
        log("memory-manager", "规则更新: " + action.rule_file + " → " + version);
      }
      if (action.type === "update_reputation" && action.agent) {
        updateReputation(action.agent, action.delta, action.reason);
      }
    }
  }
  state.review = finalReview.review || state.review;

  // ===== 生成日报 =====
  log("system", "\n━━━ 生成日报 ━━━");
  let report;
  if (state.draft && state.draft.sections) {
    const filteredSections = state.draft.sections.filter(function(s) { return !s.title || !/[\u53C2\u8003\u94FE\u63A5]/.test(s.title.replace(/[^\u4e00-\u9fff]/g, "")); });
    const sections = filteredSections.map(s => "## " + s.title + "\n\n" + s.content + "\n").join("\n---\n\n");
    report = "---\ntitle: " + dateStr + " | 行业雷达日报\noutline: [2, 3]\n---\n\n# 📡 行业雷达 · " + dateCN + "\n\n> 📮 采集 " + state.rawItems.length + " 篇 | 命中 " + state.verifiedItems.length + " 篇 | 多Agent博弈生成\n> 🤖 采集师·核查师·分析师·编辑师·记忆管理师\n\n" + sections + "\n---\n\n## 📮 参考链接\n\n<div class=\"ref-scroll\">\n" + state.verifiedItems.map((item, idx) => "<p id=\"ref-" + (idx + 1) + "\">[" + (idx + 1) + "] **" + item.title + "** · " + item.source + " · <a href=\"" + item.link + "\">链接</a></p>").join("\n") + "\n</div>\n\n---\n\n## 📊 数据统计\n\n| 来源 | 语言 | 采集数 |\n|------|------|--------|\n" + [...new Set(state.rawItems.map(i => i.source))].map(src => "| " + src + " | " + (state.rawItems.find(i => i.source === src)?.lang === "zh" ? "中文" : "EN") + " | " + state.rawItems.filter(i => i.source === src).length + " |").join("\n") + "\n\n> 生成时间: " + now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + "\n> [查看过程日志](../logs/" + dateStr + ".md)\n";
  } else {
    report = "---\ntitle: " + dateStr + " | 行业雷达日报\noutline: [2, 3]\n---\n\n# 📡 行业雷达 · " + dateCN + "\n\n> ⚠️ 今日多Agent系统未产出完整日报\n> [查看过程日志](../logs/" + dateStr + ".md)\n\n## 采集概况\n- 采集 " + state.rawItems.length + " 篇 | 通过 " + state.verifiedItems.length + " 篇\n";
  }
  writeFileUTF8(path.join(OUTPUT_DIR, dateStr + ".md"), report);
  log("system", "日报已保存: " + dateStr + ".md");

  // ===== 过程日志 =====
  log("system", "\n━━━ 生成过程日志 ━━━");
  writeFileUTF8(path.join(LOGS_DIR, dateStr + ".md"), generateProcessLog(state, dateStr));
  log("system", "日志已保存: logs/" + dateStr + ".md");

  updateDailyIndex(dateStr);

  // ===== 周报 =====
  if (now.getDay() === 0) {
    log("system", "\n━━━ 生成周报 ━━━");
    const wn = (function(d) { const start = new Date(d.getFullYear(), 0, 1); const days = Math.floor((d - start) / 86400000); return Math.ceil((days + start.getDay() + 1) / 7); })(now);
    writeFileUTF8(path.join(WEEKLY_DIR, "review-" + dateStr.slice(0, 4) + "-W" + String(wn).padStart(2, "0") + ".md"), generateWeeklyReport(state, dateStr));
    log("system", "周报已保存");
  }

  console.log("\n✅ 多Agent日报系统完成");
  console.log("   📰 docs/daily/" + dateStr + ".md");
  console.log("   📋 docs/logs/" + dateStr + ".md");
  console.log("   ⚖️ 仲裁: " + (state.deadlockDetected ? "触发" : "未触发"));
  console.log("   ⚡ 紧急: " + (state.emergencyChannel ? "触发" : "未触发"));
  console.log("   📝 规则变更: " + (state.stats.ruleChanges || 0) + " 条\n");
}

main().catch((err) => {
  console.error("致命错误:", err);
  process.exit(1);
});
