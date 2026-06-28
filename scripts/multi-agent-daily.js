#!/usr/bin/env node
/**
 * YUTATA 多Agent日报系统 v4
 * 五个角色并行博弈: 采集师·核查师·分析师·编辑师·记忆管理师
 */

const fs = require("fs");
const path = require("path");
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
          const message = createMessage(agentId, msg.to, msg.type, msg.coreInfo, msg.expectedAction, msg.reason, msg.priority);
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
function generateProcessLog(state, dateStr) {
  var dateCN = new Date(dateStr).getFullYear() + "年" + (new Date(dateStr).getMonth() + 1) + "月" + new Date(dateStr).getDate() + "日";
  var pr = state.stats.collectorSubmitted > 0 ? ((state.stats.verifierPassed / state.stats.collectorSubmitted) * 100).toFixed(1) : "0";

  // CSS for chat dialog
  var c = "<style>\n" +
    ".chat-log { max-width: 860px; margin: 0 auto; }\n" +
    ".chat-msg { display: flex; gap: 12px; margin: 0 0 1px 0; padding: 14px 16px; transition: background 0.15s; border-radius: 6px; }\n" +
    ".chat-msg:hover { background: rgba(0,0,0,0.02); }\n" +
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

  // Type labels
  var tL = { REJECT: "\ud83d\udeab \u6253\u56de", REQUEST: "\ud83d\udce9 \u8bf7\u6c42", DISPUTE: "\u2694\ufe0f \u8d28\u7591", NOTIFY: "\ud83d\udce2 \u901a\u77e5", ESCALATE: "\u26a0\ufe0f \u5347\u7ea7", CONFIRM: "\u2705 \u786e\u8ba4", DIRECTIVE: "\ud83d\udc51 \u6307\u4ee4", APPROVE: "\ud83d\udc4d \u6279\u51c6", GUIDANCE: "\ud83d\udca1 \u6307\u5bfc", PRIORITY_OVERRIDE: "\u26a1 \u7d27\u6025" };
  var avatars = { collector: "\ud83d\udce1", verifier: "\ud83d\udd0d", analyst: "\ud83d\udd2c", editor: "\u270d\ufe0f", "memory-manager": "\ud83e\udde0" };

  // Messages
  var msgs = '<div class="chat-log">\n';
  var hasArb = !!state.arbitration;
  var arbLinked = false;

  state.messages.forEach(function(m, mi) {
    var fn = AGENT_NAMES_CN[m.from] || m.from;
    var tn = AGENT_NAMES_CN[m.to] || m.to;
    var av = avatars[m.from] || "\ud83d\udcac";
    var tl = tL[m.type] || m.type;
    var time = m.timestamp ? m.timestamp.slice(11, 16) : "";

    msgs += '<div class="chat-msg chat-from-' + m.from + '" id="msg-' + mi + '">\n';
    msgs += '<div class="chat-avatar">' + av + '</div>\n';
    msgs += '<div class="chat-content">\n';
    msgs += '<div class="chat-meta">\n';
    msgs += '<span class="chat-sender">' + fn + '</span>\n';
    msgs += '<span class="chat-badge">' + tl + '</span>\n';
    msgs += '<span style="opacity:0.6">\u2192 ' + tn + '</span>\n';

    if (hasArb && !arbLinked && (m.type === "ESCALATE" || (m.type === "REJECT" && mi > state.messages.length * 0.55))) {
      msgs += '<a href="#arbitration" class="arb-anchor">\u2696\ufe0f \u4ef2\u88c1\u8bb0\u5f55</a>\n';
      arbLinked = true;
    }

    msgs += '<span class="chat-time">' + time + '</span>\n';
    msgs += '</div>\n';
    msgs += '<div class="chat-body">\n';

    var cleanText = m.coreInfo
      .replace(/RAW-\d{4}-\d{2}-\d{2}-\d{4}/g, "\u3010\u7d20\u6750\u3011")
      .replace(/MSG-[A-Z]{3}-\d{4}-\d{2}-\d{2}-\d{3}/g, "\u3010\u6d88\u606f\u3011")
      .replace(/REQ-[A-Z]{3}-\d{4}-\d{2}-\d{2}-\d{3}/g, "\u3010\u8bf7\u6c42\u3011")
      .replace(/INS-\d{4}-\d{2}-\d{2}-\d{3}/g, "\u3010\u6d1e\u5bdf\u3011")
      .replace(/%/g, "\uff05");

    msgs += '<blockquote>' + cleanText.replace(/\n/g, '<br>') + '</blockquote>\n';
    msgs += '</div>\n';

    if (m.expectedAction || m.reason) {
      msgs += '<div class="chat-footer">\n';
      if (m.expectedAction) msgs += '<span>\ud83c\udfaf ' + m.expectedAction + '</span>\n';
      if (m.reason) msgs += '<span>\ud83d\udcdd ' + m.reason + '</span>\n';
      msgs += '</div>\n';
    }

    msgs += '</div></div>\n\n';
  });
  msgs += '</div>\n';

  // Arbitration
  var arb = "";
  if (state.arbitration && state.arbitration.verdict) {
    arb = '\n---\n\n## \u2696\ufe0f \u4ef2\u88c1\u8bb0\u5f55 <a id="arbitration"></a>\n\n';
    var vd = state.arbitration.verdict;
    
    if (state.arbitration.rounds[0] && state.arbitration.rounds[0].result && state.arbitration.rounds[0].result.fact_list) {
      arb += '### \u521d\u5ba1 \u00b7 \u4e8b\u5b9e\u6e05\u5355\n\n';
      state.arbitration.rounds[0].result.fact_list.forEach(function(f) { arb += '- ' + f + '\n'; });
      arb += '\n';
    }
    
    if (state.arbitration.rounds[1] && state.arbitration.rounds[1].result && state.arbitration.rounds[1].result.positions) {
      arb += '### \u590d\u5ba1 \u00b7 \u5404\u65b9\u89c2\u70b9\n\n';
      for (var pk in state.arbitration.rounds[1].result.positions) {
        arb += '**' + (AGENT_NAMES_CN[pk] || pk) + '**\uff1a' + state.arbitration.rounds[1].result.positions[pk] + '\n\n';
      }
    }
    
    arb += '### \u7ec8\u5ba1 \u00b7 \u88c1\u51b3\n\n';
    if (vd.summary) arb += '> **\u4e89\u8bae\u6458\u8981**\uff1a' + vd.summary + '\n>\n';
    if (vd.decision) arb += '> **\u88c1\u51b3\u7ed3\u679c**\uff1a' + vd.decision + '\n>\n';
    if (vd.action_items && vd.action_items.length) {
      arb += '> **\u6267\u884c\u6b65\u9aa4**\uff1a\n';
      vd.action_items.forEach(function(a) { arb += '> - ' + a + '\n'; });
      arb += '>\n';
    }
    if (vd.rule_changes && vd.rule_changes.length) {
      arb += '> **\u89c4\u5219\u53d8\u66f4**\uff1a\n';
      vd.rule_changes.forEach(function(r) { 
        arb += '> - ' + (typeof r === "string" ? r : (r.reason || r.file || JSON.stringify(r))) + '\n';
      });
    }
    arb += '\n';
  }

  // Emergency
  var emerg = "";
  if (state.emergencyChannel) {
    emerg = '\n---\n\n## \u26a1 \u7d27\u6025\u901a\u9053\n\n- \u89e6\u53d1\uff1a' + (state.emergencyChannel.triggered_by || "\u672a\u77e5") + ' | ' + (state.emergencyChannel.topic || "\u672a\u77e5") + '\n';
  }

  return "---\ntitle: " + dateStr + " | \u56e2\u961f\u8fc7\u7a0b\u65e5\u5fd7\noutline: [2, 3]\n---\n\n" + c ++
    "# \ud83d\udccb \u56e2\u961f\u8fc7\u7a0b\u65e5\u5fd7 \u00b7 " + dateCN + "\n\n" +
    "## \ud83d\udcca \u4eca\u65e5\u7edf\u8ba1\n\n" +
    "| \u6307\u6807 | \u6570\u636e |\n|------|------|\n" +
    "| \u603b\u8f6e\u6b21 | " + state.round + " (" + (state.deadlockDetected ? "\u5df2\u89e6\u53d1\u4ef2\u88c1" : "\u6b63\u5e38\u6d41\u7a0b") + ") |\n" +
    "| \u91c7\u96c6\u63d0\u4ea4 | " + state.stats.collectorSubmitted + " \u6761 |\n" +
    "| \u6838\u67e5\u901a\u8fc7 | " + state.stats.verifierPassed + " \u6761\uff08\u901a\u8fc7\u7387 " + pr + "%\uff09 |\n" +
    "| \u6838\u67e5\u62d2\u7edd | " + state.stats.verifierRejected + " \u6761 |\n" +
    "| \u8865\u91c7\u8bf7\u6c42 | " + state.stats.analystRequests + " \u6b21 |\n" +
    "| \u7d27\u6025\u901a\u9053 | " + (state.emergencyChannel ? "\u5df2\u89e6\u53d1" : "\u672a\u89e6\u53d1") + " |\n" +
    "| \u89c4\u5219\u53d8\u66f4 | " + (state.stats.ruleChanges || 0) + " \u6761 |\n\n" +
    emerg +
    "## \ud83d\udcac \u5b8c\u6574\u901a\u4fe1\u8bb0\u5f55\n\n" + msgs + "\n" +
    arb +
    "\n---\n> \u751f\u6210\u65f6\u95f4: " + new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + "\n";
}

// ===================== 周报生成 =====================
function generateWeeklyReport(state, dateStr) {
  const weekNum = Math.ceil(new Date(dateStr).getDate() / 7);
  const rep = state.reputation;
  const mermaidBlock = "\`\`\`mermaid\nxychart-beta\n  title \"本周信誉分走势\"\n  x-axis [\"周一\", \"周二\", \"周三\", \"周四\", \"周五\", \"周六\", \"周日\"]\n  y-axis \"信誉分\" 0 --> 100\n  line \"采集师\" [80, 78, 79, 77, 80, 82, 81]\n  line \"核查师\" [82, 83, 85, 84, 86, 86, 87]\n  line \"分析师\" [80, 82, 81, 80, 83, 83, 84]\n  line \"编辑师\" [85, 86, 88, 87, 89, 90, 90]\n\`\`\`";
  return "---\ntitle: " + dateStr + " | 第" + weekNum + "周工作报告\noutline: [2, 3]\n---\n\n# 📊 第" + weekNum + "周 · AI团队工作报告\n\n## 📈 各角色信誉分走势\n\n" + mermaidBlock + "\n\n> 数据将在每周运行后自动填充\n\n## 各角色本周情况\n\n| 角色 | 周初分 | 周末分 | 变动 | 核心问题 |\n|------|--------|--------|------|----------|\n| 采集师 | " + (rep.collector?.score || 80) + " | " + (rep.collector?.score || 80) + " | 0 | - |\n| 核查师 | " + (rep.verifier?.score || 80) + " | " + (rep.verifier?.score || 80) + " | 0 | - |\n| 分析师 | " + (rep.analyst?.score || 80) + " | " + (rep.analyst?.score || 80) + " | 0 | - |\n| 编辑师 | " + (rep.editor?.score || 80) + " | " + (rep.editor?.score || 80) + " | 0 | - |\n\n## 🧑‍⚖️ 记忆管理师周评\n\n（本周运行后由管理师填写）\n\n## 🗳️ 管理师评分（四个角色打分）\n\n| 评分角色 | 分数 | 评语 |\n|----------|------|------|\n| 采集师 | -/10 | - |\n| 核查师 | -/10 | - |\n| 分析师 | -/10 | - |\n| 编辑师 | -/10 | - |\n\n## 🔧 本周规则迭代\n\n---\n> 生成时间: " + new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + "\n";
}

// ===================== 索引更新 =====================
function updateDailyIndex(dateStr) {
  var indexPath = path.join(OUTPUT_DIR, "index.md");
  var content;
  try { content = fs.readFileSync(indexPath, "utf-8"); } catch (e) { return; }

  // Insert new entry in the scroll-list div
  var marker = '<div class="scroll-list">';
  var insertPos = content.indexOf(marker);
  if (insertPos > 0) {
    var lineStart = content.indexOf("\n", insertPos) + 1;
    var newEntry = "- [" + dateStr + "](./" + dateStr + ".md) — [📝 过程日志](../logs/" + dateStr + ".md)\n";
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
        fs.writeFileSync(rulePath, header + (action.after || ""), "utf-8");
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
    const sections = state.draft.sections.map(s => "## " + s.title + "\n\n" + s.content + "\n").join("\n---\n\n");
    report = "---\ntitle: " + dateStr + " | 行业雷达日报\noutline: [2, 3]\n---\n\n# 📡 行业雷达 · " + dateCN + "\n\n> 📮 采集 " + state.rawItems.length + " 篇 | 命中 " + state.verifiedItems.length + " 篇 | 多Agent博弈生成\n> 🤖 采集师·核查师·分析师·编辑师·记忆管理师\n\n" + sections + "\n---\n\n## 📮 参考链接\n\n<div class=\"ref-scroll\">\n" + state.verifiedItems.map((item, idx) => "<p id=\"ref-" + (idx + 1) + "\">[" + (idx + 1) + "] **" + item.title + "** · " + item.source + " · <a href=\"" + item.link + "\">链接</a></p>").join("\n") + "\n</div>\n\n---\n\n## 📊 数据统计\n\n| 来源 | 语言 | 采集数 |\n|------|------|--------|\n" + [...new Set(state.rawItems.map(i => i.source))].map(src => "| " + src + " | " + (state.rawItems.find(i => i.source === src)?.lang === "zh" ? "中文" : "EN") + " | " + state.rawItems.filter(i => i.source === src).length + " |").join("\n") + "\n\n> 生成时间: " + now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + "\n> [查看过程日志](../logs/" + dateStr + ".md)\n";
  } else {
    report = "---\ntitle: " + dateStr + " | 行业雷达日报\noutline: [2, 3]\n---\n\n# 📡 行业雷达 · " + dateCN + "\n\n> ⚠️ 今日多Agent系统未产出完整日报\n> [查看过程日志](../logs/" + dateStr + ".md)\n\n## 采集概况\n- 采集 " + state.rawItems.length + " 篇 | 通过 " + state.verifiedItems.length + " 篇\n";
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, dateStr + ".md"), report, "utf-8");
  log("system", "日报已保存: " + dateStr + ".md");

  // ===== 过程日志 =====
  log("system", "\n━━━ 生成过程日志 ━━━");
  fs.writeFileSync(path.join(LOGS_DIR, dateStr + ".md"), generateProcessLog(state, dateStr), "utf-8");
  log("system", "日志已保存: logs/" + dateStr + ".md");

  updateDailyIndex(dateStr);

  // ===== 周报 =====
  if (now.getDay() === 0) {
    log("system", "\n━━━ 生成周报 ━━━");
    const wn = Math.ceil(now.getDate() / 7);
    fs.writeFileSync(path.join(WEEKLY_DIR, "review-" + dateStr.slice(0, 4) + "-W" + String(wn).padStart(2, "0") + ".md"), generateWeeklyReport(state, dateStr), "utf-8");
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
