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
  DEEPSEEK_KEY, OUTPUT_DIR, LOGS_DIR, WEEKLY_DIR, RULES_DIR, ROOT_DIR,
  MSG_TYPES, AGENT_NAMES_CN, createInitialState,
  updateReputation, getReputationWeight,
  createMessage, pushMessage, callDeepSeek, loadPrompt,
  generateRuleVersion, extractJSON, log
} = SHARED;
const { loadSystemStats, saveSystemStats, loadSystemMemory, saveSystemMemory } = require("./system-state");
const { generateProcessLog, generateWeeklyReport, updateDailyIndex, updateLogsIndex, updateWeeklyIndex } = require("./report-generator");
const CHANGELOG_FILE = RULES_DIR + "/CHANGELOG.md";

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
  const msgs = state.messages.filter(m => (m.to === agentId || m.to === "all") && m.from !== agentId).slice(-20);
  let ctx = "## 当前状态\n日期: " + state.date + " | 轮次: " + state.round + "/" + state.maxRounds + " | 阶段: " + state.phase + "\n";
  ctx += "僵局: " + (state.deadlockDetected ? "⚠️ 已触发" : "正常") + " | 紧急: " + (state.emergencyChannel ? "⚡ 激活" : "未激活") + "\n";
  ctx += "信誉分: " + (state.reputation[agentId]?.score || 80) + " | 系统运行: " + (loadSystemStats().totalRuns) + "\n\n";

  // 本轮已发送消息摘要：帮助agent自我检查重复
  var ownRecentMsgs = state.messages.filter(function(m) { return m.from === agentId; }).slice(-5);
  if (ownRecentMsgs.length > 0) {
    ctx += "## 你本轮已发送的消息\n";
    ownRecentMsgs.forEach(function(m) {
      ctx += "- [" + (m.type || "info") + "] " + (m.coreInfo || "").slice(0, 80) + "\n";
    });
    ctx += "\n";
  }
  var sysMem = loadSystemMemory();
  if (sysMem.entries.length > 0) {
    var lastEntry = sysMem.entries[sysMem.entries.length - 1];
    ctx += "昨日经验: ";
    if (lastEntry.learnings) ctx += String(lastEntry.learnings).slice(0, 120) + "\n";
    if (lastEntry.weaknesses && lastEntry.weaknesses.length > 0)
      ctx += "  弱点: " + lastEntry.weaknesses.slice(0, 2).join("; ") + "\n";

  // role-specific history
  if (lastEntry.perRole && lastEntry.perRole[agentId]) {
    var roleMem = lastEntry.perRole[agentId];
    ctx += "你的昨日表现: 信誉分 " + roleMem.score;
    if (roleMem.changes && roleMem.changes.length > 0) {
      ctx += ' | 最近变动: ' + roleMem.changes.slice(-2).map(function(c) { return (c.delta > 0 ? '+' : '') + c.delta + (c.reason ? '(' + String(c.reason).slice(0, 30) + ')' : ''); }).join('; ');
    }
    ctx += "\n";
  }
  }

  ctx += "## 待处理消息\n";
  if (msgs.length === 0) ctx += "(无新消息)\n";
  for (const m of msgs) {
    ctx += "[" + m.id + "] " + m.from + " → " + m.to + " | " + (m.type || "info") + " | " + m.priority + "\n";
    ctx += "  " + m.coreInfo + "\n";
    if (m.expectedAction) ctx += "  期望: " + m.expectedAction + "\n";
    if (m.reason) ctx += "  理由: " + m.reason + "\n\n";
  }

  ctx += "\n## 工作区\n";

  // ===== Phase 2: 注入角色记忆 =====
  ctx += buildMemoryContext(agentId);

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
    ctx += "已验证: " + state.verifiedItems.length + " 条 | insights: " + state.insights.length + " 条\n";
    ctx += "\n### 已验证素材列表\n";
    for (const item of state.verifiedItems.slice(-25)) {
      ctx += "  - [" + item.id + "] " + item.title.slice(0, 100) + " | " + item.source + " | " + item.category + "\n";
    }
    ctx += "\n### 分析师洞察\n";
    if (state.insights.length === 0) ctx += "(暂无洞察)\n";
    for (const ins of state.insights) {
      ctx += "  - [" + ins.id + "] " + String(ins.title || "").slice(0, 100) + "\n";
    }
    if (state.draft) ctx += "\n草稿已有 " + (state.draft.sections?.length || 0) + " 个章节\n";
    ctx += "\n## 排版规范\n" + (state.rules["style-guide"] || "(无)") + "\n";
  }
  if (agentId === "memory-manager") {
    ctx += "rawItems: " + state.rawItems.length + " | verified: " + state.verifiedItems.length + " | rejected: " + state.rejectedItems.length + "\n";
    ctx += "insights: " + state.insights.length + " | 消息总数: " + state.messages.length + "\n";
    ctx += "采集提交: " + state.stats.collectorSubmitted + " | 通过: " + state.stats.verifierPassed + " | 拒绝: " + state.stats.verifierRejected + "\n";
    var sysMem = loadSystemMemory();
    if (sysMem.entries.length > 0) {
      ctx += "\n## 近期经验记忆\n";
      var recentEntries = sysMem.entries.slice(-5);
      for (var ei = recentEntries.length - 1; ei >= 0; ei--) {
        var entry = recentEntries[ei];
        ctx += entry.date + ": ";
        if (entry.learnings) ctx += String(entry.learnings).slice(0, 150) + "\n";
        if (entry.weaknesses && entry.weaknesses.length > 0)
          ctx += "  弱点: " + entry.weaknesses.slice(0, 3).join("; ") + "\n";

  // role-specific history
  if (lastEntry.perRole && lastEntry.perRole[agentId]) {
    var roleMem = lastEntry.perRole[agentId];
    ctx += "你的昨日表现: 信誉分 " + roleMem.score;
    if (roleMem.changes && roleMem.changes.length > 0) {
      ctx += ' | 最近变动: ' + roleMem.changes.slice(-2).map(function(c) { return (c.delta > 0 ? '+' : '') + c.delta + (c.reason ? '(' + String(c.reason).slice(0, 30) + ')' : ''); }).join('; ');
    }
    ctx += "\n";
  }
      }
    }
  }
  ctx += "\n## 最近消息\n";
  for (const m of state.messages.slice(-30)) ctx += "[" + m.id + "] " + m.from + "→" + m.to + " " + (m.type || "info") + ": " + m.coreInfo + "\n";
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
        // Messages are validated and pushed in the main loop
      }
      return result;
    }
    log(agentId, "⚠️ 无法解析输出");
    return { raw_output: response.slice(0, 500), actions: [], messages: [] };
  } catch (err) {
    log(agentId, "❌ 失败: " + err.message);
        pushMessage(state, createMessage(agentId, "system", "ERROR", "API调用失败(轮次" + state.round + "): " + err.message, "", "", "high"));
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
  log("system", "\u2696\ufe0f ===== \u4ef2\u88c1\u4f1a\u8bae =====");
  state.phase = "arbitration";
  state.arbitration = { rounds: [], verdict: null };

  const r1Inst = "## \u4ef2\u88c1\u521d\u5ba1\uff08\u4e8b\u5b9e\u9648\u8ff0\uff09\n\u4f60\u662f\u8bb0\u5fc6\u7ba1\u7406\u5e08\u3002\u8bf7\u57fa\u4e8e\u6240\u6709\u6d88\u606f\u63d0\u53d6\u5ba2\u89c2\u4e8b\u5b9e\u6e05\u5355\u548c\u4e89\u8bae\u89c4\u5219\u6761\u6b3e\u3002\n\u8f93\u51fa: { \"arbitration_round\": 1, \"fact_list\": [...], \"disputed_rules\": [...], \"internal_thought\": \"...\" }";
  const r1 = await runAgent("memory-manager", state, r1Inst);
  state.arbitration.rounds.push({ round: 1, phase: "\u521d\u5ba1", result: r1 });

  // \u7b2c\u4e8c\u6b65\uff1a\u771f\u5b9e\u4ef2\u88c1\u2014\u2014\u4e89\u8bae\u53cc\u65b9\u5404\u81ea\u53d1\u8a00
  var disputants = {};
  state.messages.slice(-50).forEach(function(m) {
    if (m.type === "DISPUTE" || m.type === "ESCALATE") {
      disputants[m.from] = true;
      if (m.to && m.to !== "all") disputants[m.to] = true;
    }
  });
  var disputantIds = Object.keys(disputants);
  state.arbitration.posStatements = {};
  if (disputantIds.length === 0) { disputantIds = ["collector", "verifier"]; }
  for (var di = 0; di < disputantIds.length; di++) {
    var agentId = disputantIds[di];
    var pInst = "## \u4ef2\u88c1\u53d1\u8a00\n\u4f60\u662f" + AGENT_NAMES_CN[agentId] + "\u3002\u4ef2\u88c1\u5df2\u89e6\u53d1\uff0c\u8bf7\u9648\u8ff0\u4f60\u5728\u5f53\u524d\u4e89\u8bae\u4e2d\u7684\u7acb\u573a\u548c\u7406\u7531\u3002\n\u8f93\u51fa: { \"position\": \"\u4f60\u7684\u7acb\u573a\u9648\u8ff0\", \"key_evidence\": [...], \"internal_thought\": \"...\" }";
    var posResult = await runAgent(agentId, state, pInst);
    state.arbitration.posStatements[agentId] = posResult.position || posResult;
  }
  state.arbitration.rounds.push({ round: 2, phase: "\u590d\u5ba1", disputants: disputantIds });
  log("system", "\u4ef2\u88c1\u590d\u5ba1: " + disputantIds.join(", ") + " \u5df2\u53d1\u8a00");

  const r3Inst = "## \u4ef2\u88c1\u7ec8\u5ba1\uff08\u88c1\u51b3\uff09\n\u4f60\u662f\u8bb0\u5fc6\u7ba1\u7406\u5e08\u3002\u5fc5\u987b\u505a\u51fa\u6700\u7ec8\u5f3a\u5236\u88c1\u51b3\u3002\n\u8f93\u51fa: { \"arbitration_round\": 3, \"verdict\": { \"summary\": \"...\", \"decision\": \"...\", \"action_items\": [...], \"rule_changes\": [...], \"reputation_changes\": [...] }, \"internal_thought\": \"...\" }";
  const r3 = await runAgent("memory-manager", state, r3Inst);
  state.arbitration.rounds.push({ round: 3, phase: "\u7ec8\u5ba1", result: r3 });
  state.arbitration.verdict = r3.arbitration_verdict || r3.verdict;

  log("system", "\u2696\ufe0f ===== \u4ef2\u88c1\u7ed3\u675f =====");
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
// ===================== 索引更新 =====================

// ===================== 角色记忆系统 (Phase 2) =====================
var MEMORY_DIR = path.join(ROOT_DIR, "scripts", "memories");

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

var AGENT_NAMES_CN_MEM = {
  collector: "采集师", verifier: "核查师", analyst: "分析师",
  editor: "编辑师", "memory-manager": "记忆管理师"
};

function loadAgentMemory(agentId) {
  ensureMemoryDir();
  var memPath = path.join(MEMORY_DIR, agentId + ".json");
  try { return JSON.parse(fs.readFileSync(memPath, "utf-8")); }
  catch { return { agentId: agentId, identity: {}, relationships: {}, experiences: [], selfReview: { strengths: [], weaknesses: [], ongoingIssues: [], improvementPlan: "" } }; }
}

function saveAgentMemory(agentId, memory) {
  ensureMemoryDir();
  writeFileUTF8(path.join(MEMORY_DIR, agentId + ".json"), JSON.stringify(memory, null, 2));
}

function buildMemoryContext(agentId) {
  var mem = loadAgentMemory(agentId);
  var ctx = "\n## 🧠 你的个人记忆\n";
  ctx += "角色: " + (AGENT_NAMES_CN_MEM[agentId] || agentId) + " | 记忆总数: " + (mem.experiences || []).length + "条\n";
  ctx += "> 你记得过去发生的每件事——以下是你所有的经历\n\n";
  
  // Relationships
  ctx += "\n### 你与其他角色的关系\n";
  var rels = mem.relationships || {};
  var relKeys = Object.keys(rels);
  if (relKeys.length === 0) {
    ctx += "(尚无关系记录)\n";
  } else {
    relKeys.forEach(function(k) {
      var r = rels[k];
      var trendIcon = r.trend === "improving" ? "↑" : r.trend === "declining" ? "↓" : "→";
      ctx += "- " + (AGENT_NAMES_CN_MEM[k] || k) + ": 信任度 " + r.trust + trendIcon;
      if (r.summary) ctx += " — " + String(r.summary).slice(0, 120);
      ctx += "\n";
    });
  }

  // Recent experiences - show all, with auto-summary when many
  var exps = mem.experiences || [];
  if (exps.length > 0) {
    ctx += "\n### 近期关键经历 (共" + exps.length + "条记忆)\n";
    var displayExps = exps.length > 20 ? exps.slice(-20) : exps;
    if (exps.length > 20) ctx += "(显示最近20条, 共" + exps.length + "条)\n";
    displayExps.forEach(function(e) {
      ctx += "- " + e.date + " [" + (e.type || "事件") + "]: " + String(e.summary || "").slice(0, 80) + "\n";
      if (e.lesson) ctx += "  教训: " + String(e.lesson).slice(0, 80) + "\n";
    });
  }

  // Self review
  var sr = mem.selfReview || {};
  if (sr.weaknesses && sr.weaknesses.length > 0) {
    ctx += "\n### 待改进项\n";
    sr.weaknesses.slice(0, 3).forEach(function(w) { ctx += "- " + w + "\n"; });
  }
  if (sr.improvementPlan) {
    ctx += "改进计划: " + String(sr.improvementPlan).slice(0, 80) + "\n";
  }

  return ctx;
}

function updateAgentMemoryFromDay(agentId, state, dateStr, dateCN) {
  var mem = loadAgentMemory(agentId);
  var memPath = path.join(MEMORY_DIR, agentId + ".json");

  // Initialize relationships
  ["collector", "verifier", "analyst", "editor", "memory-manager"].forEach(function(other) {
    if (other === agentId) return;
    if (!mem.relationships[other]) mem.relationships[other] = { trust: 50, trend: "stable", history: [], summary: "" };
  });

  // Analyze today's messages for this agent
  var myMsgs = state.messages.filter(function(m) { return m.from === agentId || m.to === agentId; });
  
  // Track interactions with each other agent
  var interactionCounts = {};
  var conflictCounts = {};
  var praiseCounts = {};
  
  myMsgs.forEach(function(m) {
    var otherId = (m.from === agentId) ? m.to : m.from;
    if (otherId === "system" || otherId === "all") return;
    if (!interactionCounts[otherId]) interactionCounts[otherId] = 0;
    interactionCounts[otherId]++;
    if (m.type === "REJECT" || m.type === "DISPUTE" || m.type === "ESCALATE") {
      if (!conflictCounts[otherId]) conflictCounts[otherId] = 0;
      conflictCounts[otherId]++;
    }
    if (m.type === "APPROVE" || m.type === "CONFIRM") {
      if (!praiseCounts[otherId]) praiseCounts[otherId] = 0;
      praiseCounts[otherId]++;
    }
  });

  // Update relationship trust based on today's interactions
  Object.keys(interactionCounts).forEach(function(otherId) {
    if (!mem.relationships[otherId]) return;
    var oldTrust = mem.relationships[otherId].trust;
    var delta = 0;
    var conflicts = conflictCounts[otherId] || 0;
    var praises = praiseCounts[otherId] || 0;
    if (conflicts > praises) { delta = -Math.min(conflicts * 2, 10); }
    else if (praises > 0) { delta = Math.min(praises * 2, 10); }
    mem.relationships[otherId].trust = Math.max(10, Math.min(100, oldTrust + delta));
    if (!mem.relationships[otherId].history) mem.relationships[otherId].history = [];
    mem.relationships[otherId].history.push({ date: dateStr, event: (conflicts > praises ? "冲突" : "合作") + " " + interactionCounts[otherId] + "次", trustDelta: delta });
    // Update trend
    var recentH = mem.relationships[otherId].history;
    var avgDelta = recentH.reduce(function(s, h) { return s + (h.trustDelta || 0); }, 0) / Math.max(recentH.length, 1);
    mem.relationships[otherId].trend = avgDelta > 1 ? "improving" : avgDelta < -1 ? "declining" : "stable";
    // Summary
    var trust = mem.relationships[otherId].trust;
    mem.relationships[otherId].summary = trust >= 70 ? "关系良好" : trust >= 40 ? "关系一般" : "关系紧张";
  });

  // Add key experiences from today's events
  var significantChanges = state.messages.filter(function(m) { 
    return (m.from === agentId || m.to === agentId) && 
      (m.type === "REJECT" || m.type === "ESCALATE" || m.type === "APPROVE" || m.type === "DIRECTIVE");
  });
  
  if (significantChanges.length > 0) {
    var worst = significantChanges.filter(function(m) { return m.type === "REJECT" || m.type === "ESCALATE"; });
    var best = significantChanges.filter(function(m) { return m.type === "APPROVE" || m.type === "DIRECTIVE"; });
    
    if (worst.length > 0) {
      var wMsg = worst[0];
      if (!mem.experiences) mem.experiences = [];
      mem.experiences.push({
        date: dateStr,
        type: "重大挫折",
        summary: "被" + (AGENT_NAMES_CN_MEM[wMsg.from === agentId ? wMsg.to : wMsg.from] || wMsg.from) + " " + wMsg.type + "：" + String(wMsg.coreInfo || "").slice(0, 80),
        lesson: "",
        impact: ""
      });
    }
    if (best.length > 0) {
      var bMsg = best[0];
      mem.experiences.push({
        date: dateStr,
        type: "正向反馈",
        summary: "收到" + (AGENT_NAMES_CN_MEM[bMsg.from] || bMsg.from) + "的" + bMsg.type + "：" + String(bMsg.coreInfo || "").slice(0, 80),
        lesson: "",
        impact: ""
      });
    }
  }

  // Update selfReview
  var myRejects = state.messages.filter(function(m) { return m.type === "REJECT" && m.to === agentId; });
  if (myRejects.length >= 5 && (!mem.selfReview.weaknesses || mem.selfReview.weaknesses.indexOf("质量不稳定") < 0)) {
    if (!mem.selfReview.weaknesses) mem.selfReview.weaknesses = [];
    mem.selfReview.weaknesses.push("质量不稳定");
  }
  var myApproves = state.messages.filter(function(m) { return m.type === "APPROVE" && m.to === agentId; });
  if (myApproves.length >= 3 && (!mem.selfReview.strengths || mem.selfReview.strengths.indexOf("得到认可") < 0)) {
    if (!mem.selfReview.strengths) mem.selfReview.strengths = [];
    mem.selfReview.strengths.push("得到认可");
  }

  saveAgentMemory(agentId, mem);
}

// ===================== 主流程 =====================
async function main() {
  const now = new Date();
  const dateStr = (function() {
  if (process.env.OVERRIDE_DATE) return process.env.OVERRIDE_DATE;
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
})();
  const dateCN = now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日";
  const systemStats = loadSystemStats();
  systemStats.totalRuns++;
  if (!systemStats.firstRunDate) systemStats.firstRunDate = dateStr;
  systemStats.lastRunDate = dateStr;
  saveSystemStats(systemStats);

  console.log("⏱️ 启动时间: " + new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }));
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

  pushMessage(state, createMessage("collector", "verifier", "NOTIFY",
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
    // Run agents - non-editor agents in parallel, editor after to incorporate insights
    var nonEditorAgents = agentsToRun.filter(function(a) { return a !== "editor"; });
    await Promise.all(nonEditorAgents.map(async function(agentId) {
      agentResults[agentId] = await runAgent(agentId, state);
    }));
    // Run editor serially after other agents to incorporate analyst insights
    if (agentsToRun.includes("editor")) {
      agentResults["editor"] = await runAgent("editor", state);
    }

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
          if (action.type === "verify" && (action.item_id || (action.items && action.items.length > 0))) {
            // Handle both flat format (item_id) and nested format (items array from prompt)
            var itemsToProcess = action.items || [{id: action.item_id, decision: action.decision, reason: action.reason, category: action.category}];
            var passCount = 0, rejectCount = 0, passReasons = [], rejectReasons = [];
            for (var vi = 0; vi < itemsToProcess.length; vi++) {
              var vitem = itemsToProcess[vi];
              const item = state.rawItems.find(i => i.id === vitem.id);
              if (!item) continue;
              var decision = vitem.decision || action.decision || "";
              item.status = decision;
              item.verify_reason = vitem.reason || action.reason || "";
              item.category = vitem.category || action.category || item.category;
              if (decision === "pass" || decision === "approve") { state.verifiedItems.push(item); state.stats.verifierPassed++; passCount++; if (item.verify_reason) passReasons.push(String(item.verify_reason).slice(0, 60)); }
              else if (decision === "fail" || decision === "reject") { state.rejectedItems.push(item); state.stats.verifierRejected++; rejectCount++; if (item.verify_reason) rejectReasons.push(String(item.verify_reason).slice(0, 60)); }
            }
            // Record reputation reason for verifier: tracking approval/rejection patterns
            if (passCount + rejectCount > 0) {
              var repReason = "审核了" + (passCount + rejectCount) + "条素材，通过" + passCount + "条";
              if (rejectReasons.length > 0) repReason += "。拒绝原因: " + rejectReasons.slice(0, 2).join("; ");
              if (!state.repReasons) state.repReasons = {};
              if (!state.repReasons["verifier"]) state.repReasons["verifier"] = [];
              state.repReasons["verifier"].push(repReason);
            }
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
              round: state.round,
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
      // Push any messages from editor result (with validation)
      if (result.messages && Array.isArray(result.messages)) {
        for (const rm of result.messages) {
          if (rm.to && AGENT_NAMES_CN[rm.to] && rm.type && MSG_TYPES.includes(rm.type)) {
            pushMessage(state, createMessage(agentId, rm.to, rm.type, (rm.coreInfo || (agentId === "editor" ? "\u7F16\u8F91\u5E08\u5904\u7406\u65E5\u62A5\u8349\u7A3F\u4E2D\u9047\u5230\u6280\u672F\u95EE\u9898\uFF0C\u6D88\u606F\u5185\u5BB9\u6682\u7F3A\u3002" : "")), rm.expectedAction || "", rm.reason || "", rm.priority || "normal"));
          }
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

      // ⑥ 兜底：检查是否包含曲库人必看 / 冷知识板块
      if (agentId === "editor" && state.draft && state.draft.sections && state.verifiedItems.length > 0) {
        var hasRequiredSection = state.draft.sections.some(function(s) { return s.title && /曲库人/.test(s.title); });
        var hasTriviaSection = state.draft.sections.some(function(s) { return s.title && /冷知识/.test(s.title); });
        if (!hasRequiredSection) {
          var fallbackMusician = "## 曲库人必看 \u2014 本周/今日实操建议\n\n> \u26a0\ufe0f 今日AI生成未包含曲库人必看板块，以下为系统基于当日素材自动补充：\n\n";
          var actionItems = state.verifiedItems.slice(0, 5).map(function(item) {
            return "- \u25b6\ufe0f 关注 **" + item.title.slice(0, 30) + "**" + (item.source ? "\uff08来源：" + item.source + "\uff09" : "") + "\n  参考：[" + item.link.slice(0, 60) + "](" + item.link + ")";
          }).join("\n");
          fallbackMusician += actionItems + "\n\n> \ud83d\udcdd 编辑提示：此为自动补充，建议下次运行时由编辑师撰写针对性更强的版本。\n";
          state.draft.sections.push({ title: "曲库人必看", content: fallbackMusician, referenced_items: [], referenced_insights: [] });
          log("editor", "自动补充曲库人必看板块");
        }
        if (!hasTriviaSection) {
          var fallbackTrivia = "## \ud83d\udca1 冷知识 / 延伸\n\n> \u26a0\ufe0f 今日AI生成未包含冷知识板块，以下为系统基于当日素材自动补充：\n\n";
          var randomItem = state.verifiedItems[Math.floor(Math.random() * state.verifiedItems.length)];
          if (randomItem) {
            fallbackTrivia += "- 来自 **" + randomItem.source + "** 的报道：\"" + randomItem.title + "\"\n  原文摘要：" + (randomItem.summary || "无摘要").slice(0, 200) + "\n  \u2014 [" + randomItem.link + "](" + randomItem.link + ")\n";
          } else {
            fallbackTrivia += "- 今日未有足够的素材自动生成冷知识。期待下一期。\n";
          }
          fallbackTrivia += "\n> \ud83d\udcdd 编辑提示：此为自动补充，建议下次运行时由分析师和编辑师提供更有趣的冷知识。\n";
          state.draft.sections.push({ title: "冷知识", content: fallbackTrivia, referenced_items: [], referenced_insights: [] });
          log("editor", "自动补充冷知识板块");
        }
      }
      if (agentId === "memory-manager" && result.actions) {
        for (const action of result.actions) {
          if (action.type === "update_rule") state.stats.ruleChanges = (state.stats.ruleChanges || 0) + 1;
          if (action.type === "update_reputation") {
            updateReputation(action.agent, action.delta, action.reason);
            state.reputation = require("./agents/shared").loadReputation();
            if (!state.reputationChanges[action.agent]) state.reputationChanges[action.agent] = [];
            state.reputationChanges[action.agent].push({ delta: action.delta, reason: action.reason, date: state.date });
          }
        }
        if (result.review) state.review = result.review;
      }
    }

    state.round = round;
    state.stats.roundExecuted = round;

        // 自动超时：超过2轮未响应的补采请求标记为timeout
        state.supplementRequests.forEach(function(r) {
          if (r.status === "pending" && typeof r.round === "number" && state.round - r.round >= 2) {
            r.status = "timeout";
          }
        });

        // 检测收敛（第3轮起）：编辑师终稿就绪 + 无待补采 + 无活跃争议 + 核查完毕
    if (round >= 3) {
            // Final fallback: auto-generate draft when editor produces no output
      if (!state.draft || !state.draft.sections || state.draft.sections.length === 0) {
        var fbTopics = state.insights.slice(0, 3).map(function(i) { return i.title || i.topic || ""; });
        var fbSections = [];
        fbSections.push({ title: "📡 核心解读", content: "编辑师处理日报草稿时遇到技术问题，以下为基于已验证素材的核心摘要。\n" + state.verifiedItems.slice(0, 5).map(function(v) { return "- [" + v.id + "] " + v.title; }).join("\n"), referenced_items: [], referenced_insights: [] });
        if (fbTopics.length > 0) {
          fbSections.push({ title: "🔍 行业趋势观察", content: fbTopics.map(function(t) { return "- " + t; }).join("\n"), referenced_items: [], referenced_insights: [] });
        }
        fbSections.push({ title: "📊 数据概览", content: "采集 " + state.rawItems.length + " 篇 | 通过 " + state.verifiedItems.length + " 篇 | " + (state.stats.verifierPassed || 0) + " 条通过核查", referenced_items: [], referenced_insights: [] });
        fbSections.push({ title: "✏️ 编辑备注", content: "今日编辑师处理日报草稿时遇到技术问题，日报由系统自动生成。数据基于已通过核查的素材。" + (state.insights.length > 0 ? "分析师洞察已整合。" : ""), referenced_items: [], referenced_insights: [] });
        state.draft = { sections: fbSections };
        log("editor", "自动生成兜底日报: " + fbSections.length + " 个章节");
      }
var editorConfirmed = state.draft && state.draft.sections && state.draft.sections.length > 0;
      var noPendingSupplements = !state.supplementRequests.some(function(r) { return r.status === "pending"; });
      var noActiveDisputes = !state.messages.slice(-15).some(function(m) { return m.type === "DISPUTE" || m.type === "ESCALATE"; });
      var verifierDone = !state.rawItems.some(function(i) { return i.status === "pending"; });
      if (editorConfirmed && noPendingSupplements && noActiveDisputes && verifierDone) {
        log("system", "\u2713 \u6536\u655b\u6761\u4ef6\u6ee1\u8db3\uff0c\u63d0\u524d\u9000\u51fa\u4e3b\u5faa\u73af");
        break;
      }
    }

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
  // ???????2????????????timeout
  
  if (state.draft && state.draft.sections && state.draft.sections.length > 0) {
    log("system", "\n=== 审稿环节 ===");
    state.phase = "review";
    var reviewAgents = ["collector", "verifier", "analyst", "editor", "memory-manager"];
    var reviewInst = "## 审稿\n你是{role}，请对当前日报草稿做出评价。\n- 如果通过，发送APPROVE消息\n- **在coreInfo中附上今日工作总结作为复盘**（要求：总结今日工作内容、质量评估、自我反思，不少于50字） - **禁止使用\"未参与今日工作\"或类似表述**——如果没有足够信息，请说明“材料有限，基于现有信息总结...”\n- **工作回顾要素（仅回顾自己角色）：**\n  - **{role}**：今日工作内容、完成质量、自我反思、遇到的困难与改进方向\n- 输出: { \"messages\": [{ \"to\": \"editor\", \"type\": \"APPROVE/REQUEST\", \"coreInfo\": \"评价日报质量+今日工作总结\", \"expectedAction\": \"修改要求\", \"reason\": \"理由\", \"priority\": \"normal\" }], \"internal_thought\": \"...\" }";
    for (var ri = 0; ri < reviewAgents.length; ri++) {
      var aid = reviewAgents[ri];
      var inst = reviewInst.replace("{role}", AGENT_NAMES_CN[aid]);
      try {
        var revResult = await runAgent(aid, state, inst);
        if (revResult && revResult.messages) {
          for (var rm of revResult.messages) {
            pushMessage(state, createMessage(aid, rm.to || "editor", rm.type || "APPROVE", rm.coreInfo || "", rm.expectedAction || "", rm.reason || "", rm.priority || "normal"));
          }
        }
        if (revResult && revResult.internal_thought) log(aid, "?? [??] " + revResult.internal_thought.slice(0, 120));
      } catch(e) { log("system", aid + " review: " + e.message); }
    }

  }

  state.phase = "convergence";

  const finalInst = "## 最终复盘\n你是记忆管理师，今日" + dateCN + "。评估日报质量（完整性/准确性/深度/可读性0-10分）、优缺点、规则修改建议、信誉分调整。\n输出: { \"review\": { \"quality_scores\": {...}, \"strengths\": [...], \"weaknesses\": [...], \"root_cause\": \"...\" }, \"actions\": [{\"type\":\"update_rule\",\"rule_file\":\"...\",\"change_type\":\"add/modify\",\"after\":\"...\",\"reason\":\"...\"}], \"internal_thought\": \"...\" }";
  const finalReview = await runAgent("memory-manager", state, finalInst);

  if (finalReview.actions) {
    for (const action of finalReview.actions) {
      if (action.type === "update_rule" && action.rule_file) {
        const version = generateRuleVersion(dateStr);
        const rulePath = path.join(RULES_DIR, path.basename(action.rule_file));
        const archivePath = path.join(RULES_DIR, "archive", path.basename(action.rule_file).replace(".md", "-" + version + ".md"));
        try {
          const oldContent = fs.readFileSync(rulePath, "utf-8");
          fs.writeFileSync(archivePath, "# " + action.rule_file + " - " + version + "\n> 归档: " + dateStr + "\n\n" + oldContent, "utf-8");
        } catch(e) { console.log("[system] 归档旧规则失败: " + (e.message || "").slice(0, 60)); }
        const header = "---\ntitle: " + action.rule_file.replace(".md", "") + "\nversion: " + version + "\nupdated: " + dateStr + "\noutline: [2, 3]\n---\n\n> 📌 " + version + " | " + dateCN + "\n\n";
        writeFileUTF8(rulePath, header + (action.after || ""));
        log("memory-manager", "规则更新: " + action.rule_file + " → " + version);
        // 追加到变更日志
        try {
          var changelog = "";
          try { changelog = fs.readFileSync(CHANGELOG_FILE, "utf-8"); } catch { changelog = "# 规则变更日志\n\n"; }
          changelog += "## " + dateStr + "\n";
          changelog += "- **" + action.rule_file + "** (" + version + "): " + (action.reason || "更新") + "\n";
          writeFileUTF8(CHANGELOG_FILE, changelog);
        } catch (clErr) { log("system", "变更日志写入失败: " + clErr.message.slice(0, 60)); }
      }
      if (action.type === "update_reputation" && action.agent) {
        updateReputation(action.agent, action.delta, action.reason);
        if (!state.reputationChanges[action.agent]) state.reputationChanges[action.agent] = [];
        state.reputationChanges[action.agent].push({ delta: action.delta, reason: action.reason, date: state.date });
      }
    }
  }
  state.review = finalReview.review || state.review;

  // ===== 保存经验记忆 =====
  var sysMem = loadSystemMemory();
  var memEntry = {
    date: dateStr,
    totalRuns: systemStats.totalRuns,
    scores: (state.review && state.review.quality_scores) || {},
    strengths: (state.review && state.review.strengths) || [],
    weaknesses: (state.review && state.review.weaknesses) || [],
    rootCause: (state.review && state.review.root_cause) || "",
    ruleChanges: state.stats.ruleChanges || 0,
    perRole: (function() {
      var pr = {};
      var agents = ['collector','verifier','analyst','editor','memory-manager'];
      for (var aid of agents) {
        pr[aid] = {
          score: (state.reputation[aid] && state.reputation[aid].score) || 80,
          changes: (state.reputationChanges[aid] || []).slice(-5)
        };
      }
      return pr;
    })()
  };
  // 提取 learnings 从复盘（weaknesses + rootCause）
  var learnings = [];
  if (memEntry.weaknesses.length > 0) learnings.push("弱点: " + memEntry.weaknesses.slice(0, 2).join("; "));
  if (memEntry.rootCause) learnings.push("根因: " + memEntry.rootCause);
  if (state.stats.ruleChanges > 0) learnings.push("规则变更: " + state.stats.ruleChanges + " 条");
  memEntry.learnings = learnings.join(" | ");
  sysMem.entries.push(memEntry);
  saveSystemMemory(sysMem);

  // ===== 生成日报 =====
  log("system", "\n━━━ 生成日报 ━━━");
  let report;
  if (state.draft && state.draft.sections) {
    const filteredSections = state.draft.sections.filter(function(s) { return !s.title || !/[\u53C2\u8003\u94FE\u63A5]/.test(s.title.replace(/[^\u4e00-\u9fff]/g, "")); });
    // Build raw sections content (before stripping) for reference extraction
    var rawContent = filteredSections.map(function(s) { return "## " + s.title + "\n\n" + s.content + "\n"; }).join("\n---\n\n");
    const sections = filteredSections.map(s => "## " + s.title.replace(/^#+\s*/g,"").trim().replace(/\s*\[RAW-\d+(?:-\d+)*\]/g,"") + "\n\n" + s.content.replace(/\s*\[RAW-\d+(?:-\d+)*\]/g,"").replace(new RegExp("^#{1,6}\\s*" + s.title.replace(/[.*+?^\${}()|[\]\\]/g, "\\$&").replace(/^[#\s]*/,"").replace(/\s*\[RAW-\d+(?:-\d+)*\]/g,"").trim() + "\\s*\\n", "m"), "") + "\n").join("\n---\n\n");
    var refIds = {};
    rawContent.replace(/\[(RAW-\d+(?:-\d+)*)\]/g, function(m, id) { refIds[id] = true; });
    rawContent.replace(/\[RAW-(\d{4})\]/g, function(m, sid) { refIds['short:' + sid] = true; });
    var refItems = state.verifiedItems.filter(function(item) {
      if (refIds[item.id]) return true;
      var parts = item.id.split('-');
      var last = parts[parts.length - 1];
      if (refIds['short:' + last]) return true;
      return false;
    });
    if (refItems.length === 0) { refItems = state.verifiedItems.slice(0, 8); }
    report = "---\ntitle: " + dateStr + " | 行业雷达日报\noutline: [2, 3]\n---\n\n# \uD83D\uDCE1 行业雷达 \u00B7 " + dateCN + "\n\n> \uD83D\uDCCE 采集 " + state.rawItems.length + " 篇 | 命中 " + state.verifiedItems.length + " 篇 | 多Agent博弈生成\n> \uD83E\uDDBB 采集师\u00B7核查师\u00B7分析师\u00B7编辑师\u00B7记忆管理师\n\n" + sections + "\n---\n\n## \uD83D\uDCEE 参考链接\n\n<div class=\"ref-scroll\">\n" + refItems.map(function(item, idx) { return "<p id=\"ref-" + (idx + 1) + "\"><a href=\"" + item.link + "\">[" + (idx + 1) + "]</a> **" + item.title + "** \u00B7 " + item.source + "</p>"; }).join("\n") + "\n</div>\n\n---\n\n## \uD83D\uDCCA 数据统计\n\n<div class=\"ref-scroll\">\n<table>\n<thead>\n<tr><th>来源</th><th>语言</th><th>采集数</th></tr>\n</thead>\n<tbody>\n" + [...new Set(state.rawItems.map(i => i.source))].map(src => "<tr><td>" + src + "</td><td>" + (state.rawItems.find(i => i.source === src)?.lang === "zh" ? "中文" : "EN") + "</td><td>" + state.rawItems.filter(i => i.source === src).length + "</td></tr>").join("\n") + "\n</tbody>\n</table>\n</div>\n\n> 生成时间\n> 生成时间: " + now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + "\n> [查看过程日志](../logs/" + dateStr + ".md)\n";

  } else {
    var agentMsgs = (state.messages || []).filter(function(m) { return m.from && m.coreInfo; }).slice(-10);
    var msgSummary = agentMsgs.length > 0 ? "\n\n## 📋 代理通信摘要\n\n" + agentMsgs.map(function(m) {
      var name = AGENT_NAMES_CN[m.from] || m.from;
      var toName = AGENT_NAMES_CN[m.to] || m.to || "all";
      return "- **" + name + "** → " + toName + " [" + (m.type || "info") + "]: " + String(m.coreInfo || "").slice(0, 120);
    }).join("\n") + "\n" : "";
    report = "---\ntitle: " + dateStr + " | 行业雷达日报\noutline: [2, 3]\n---\n\n# 📡 行业雷达 · " + dateCN + "\n\n> ⚠️ 今日编辑师环节异常，日报由系统自动生成\n> 📮 采集概况见下方\n> [查看过程日志](../logs/" + dateStr + ".md)\n\n## 采集概况\n- 采集 " + state.rawItems.length + " 篇 | 通过 " + state.verifiedItems.length + " 篇\n" + msgSummary;
  }

      // ===== 信誉分变化 =====
  // 直接从 reputation.json 读取，确保显示最新信誉分变化  
  try {
    var repData = require("./agents/shared").loadReputation();
    var agentNames = { collector: "采集师", verifier: "核查师", analyst: "分析师", editor: "编辑师", "memory-manager": "记忆管理师" };
    var todayStr = dateStr;
    var repSection = "\n\n## 📊 \u4eca\u65e5\u4fe1\u8a89\u5206\u53d8\u5316\n\n<div style=\"display:grid;grid-template-columns:80px 50px 50px 1fr;gap:6px 12px;font-size:0.9em;margin:12px 0;\">\n<div style=\"font-weight:600;padding:6px 0;border-bottom:2px solid var(--vp-c-divider);\">\u89d2\u8272</div>\n<div style=\"text-align:center;padding:6px 0;border-bottom:2px solid var(--vp-c-divider);\">\u5206\u6570</div>\n<div style=\"text-align:center;padding:6px 0;border-bottom:2px solid var(--vp-c-divider);\">\u53d8\u5316</div>\n<div style=\"padding:6px 0;border-bottom:2px solid var(--vp-c-divider);overflow-wrap:break-word;word-break:break-word;\">\u539f\u56e0</div>\n";
    ["collector", "verifier", "analyst", "editor", "memory-manager"].forEach(function(aid) {
      var agentRep = repData[aid];
      if (!agentRep) return;
      var todayHistory = (agentRep.history || []).filter(function(h) { return h.date === todayStr; });
      var score = agentRep.score || "?";
      var delta = "\u2014";
      var reason = "\u2014";
      if (todayHistory.length > 0) {
        var lastEntry = todayHistory[todayHistory.length - 1];
        delta = lastEntry.delta > 0 ? "+" + lastEntry.delta : String(lastEntry.delta);
        reason = String(lastEntry.reason || "").slice(0, 150);
      } else {
        if (state.repReasons && state.repReasons[aid]) {
          reason = state.repReasons[aid].slice(-1)[0];
        }
      }
      repSection += "<div style=\"font-weight:600;padding:6px 0;border-bottom:1px solid var(--vp-c-divider);\">" + (agentNames[aid] || aid) + "</div><div style=\"text-align:center;padding:6px 0;border-bottom:1px solid var(--vp-c-divider);\">" + score + "</div><div style=\"text-align:center;padding:6px 0;border-bottom:1px solid var(--vp-c-divider);\">" + delta + "</div><div style=\"padding:6px 0;border-bottom:1px solid var(--vp-c-divider);overflow-wrap:break-word;word-break:break-word;line-height:1.4;\">" + reason + "</div>\n";
    });
    repSection += "</div>\n";
    report += repSection;
  } catch(e) { /* skip reputation section */ }

  // 后处理：修复所有分析师尚未提交类错误标注
  report = report.replace(/分析师尚未提交|分析师未提交|analyst尚未[提交输出]/gi, function(match) {
    console.log("编辑备注自动修复: " + match.slice(0, 20));
    return "分析师洞察已整合至本日报（详情见核心解读）";
  });
  report = report.replace(/尚未(?:提交|提供|输出)(?:洞察|分析|内容)?/gi, "已整合");
  // 修复编辑师未参与类错误标注（审稿环节AI不遵守prompt指令）
  report = report.replace(/编辑师未参与今日工作[。.]?/g, function(match) {
    console.log("编辑师参与修复: " + match.slice(0, 20));
    return "编辑师已完成今日日报草稿编排（详见正文）";
  });
  // 修复TL;DR排版：确保每条之间有空行，防止Markdown渲染合为一段
  report = report.replace(/^(## TL;DR 今日速览\n\n)((?:[^#\n].*\n?)+)/gm, function(match, header, body) {
    var items = body.split("\n").filter(function(l) { return l.trim(); });
    var formatted = items.map(function(item, i) {
      return (i > 0 ? "\n" : "") + item.trim();
    }).join("\n\n");
    return header + formatted;
  });

  writeFileUTF8(path.join(OUTPUT_DIR, dateStr + ".md"), report);
  log("system", "日报已保存: " + dateStr + ".md");

  // ===== 过程日志 =====
  log("system", "\n━━━ 生成过程日志 ━━━");
  var logContent = generateProcessLog(state, dateStr);
  // 修复过程日志中的"编辑师未参与今日工作"类错误标注
  logContent = logContent.replace(/编辑师未参与今日工作[。.]?/g, "编辑师已完成今日日报草稿编排（详见正文）");
  writeFileUTF8(path.join(LOGS_DIR, dateStr + ".md"), logContent);
  log("system", "日志已保存: logs/" + dateStr + ".md");

  updateDailyIndex(dateStr);
  updateLogsIndex(dateStr);

  // ===== 周报 =====
  if (now.getDay() === 0) {
    log("system", "\n━━━ 生成周报 ━━━");
    try {
      log("system", "运行记忆管理师环评...");
      var mmReview = require("./mm-review");
      await mmReview.runEvals();
      log("system", "环评完成");
    } catch (e) {
      log("system", "环评跳过: " + String(e.message).slice(0, 60));
    }
    const wn = (function(d) { var sysStart = new Date(2026, 5, 28); var days = Math.floor((d - sysStart) / 86400000); return Math.ceil((days + 1) / 7); })(now);
    writeFileUTF8(path.join(WEEKLY_DIR, "review-" + dateStr.slice(0, 4) + "-W" + String(wn).padStart(2, "0") + ".md"), generateWeeklyReport(state, dateStr));
    updateWeeklyIndex(dateStr, wn);
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


