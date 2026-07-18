#!/usr/bin/env node
/**
 * YUTATA 澶欰gent鏃ユ姤绯荤粺 v4
 * 浜斾釜瑙掕壊骞惰鍗氬紙: 閲囬泦甯埪锋牳鏌ュ笀路鍒嗘瀽甯埪风紪杈戝笀路璁板繂绠＄悊甯?
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
catch (e) { console.error("鏃犳硶鍔犺浇 sources.json:", e.message); process.exit(1); }

const SOURCES = CONFIG.sources;
const KEYWORDS = CONFIG.keywords;

if (!DEEPSEEK_KEY) { console.error("DEEPSEEK_API_KEY 鏈缃?); process.exit(1); }

// ===================== RSS 閲囬泦 =====================
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

var CURRENT_DATE = "";

async function fetchRSS(source) {
  try {
    const xml = await fetchUrl(source.url);
    const { parseStringPromise: parser } = require("xml2js");
    let result;
    try {
      result = await parser(xml, { explicitArray: false, mergeAttrs: true, strict: false, normalizeTags: true });
    } catch (parseErr) {
      log("collector", "XML瑙ｆ瀽澶辫触 " + source.name + ": " + parseErr.message.slice(0, 80));
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
    
    // ===== 鏃ユ湡杩囨护锛氬彧淇濈暀鐩爣鏃ユ湡鍓嶅悗48灏忔椂鍐呯殑鍐呭 =====
    var targetDate = CURRENT_DATE;
    var targetTs = new Date(targetDate + "T00:00:00Z").getTime();
    var minTs = targetTs - 48 * 3600 * 1000;  // 48灏忔椂鍓?
    var maxTs = targetTs + 24 * 3600 * 1000;  // 鐩爣鏃ユ湡褰撳ぉ23:59
    var filteredItems = items.filter(function(item) {
      if (!item.pubDate) return true;  // 娌℃湁鏃ユ湡鐨勪繚鐣?
      var pubTs = new Date(item.pubDate).getTime();
      if (isNaN(pubTs)) return true;   // 鏃犳硶瑙ｆ瀽鏃ユ湡鐨勪繚鐣?
      return pubTs >= minTs && pubTs <= maxTs;
    });
    var filtered = items.length - filteredItems.length;
    if (filtered > 0) {
      log("collector", source.name + ": " + items.length + " 鏉? 鏃ユ湡杩囨护鍚?" + filteredItems.length + " 鏉?(璺宠繃" + filtered + "鏉℃棫鍐呭)");
    } else {
      log("collector", source.name + ": " + items.length + " 鏉?);
    }
    return filteredItems;
  } catch (e) { log("collector", "閲囬泦澶辫触 " + source.name + ": " + e.message.slice(0, 80)); return []; }
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

// ===================== Agent 涓婁笅鏂囨瀯寤?=====================
function buildAgentContext(agentId, state) {
  const msgs = state.messages.filter(m => (m.to === agentId || m.to === "all") && m.from !== agentId).slice(-20);
  let ctx = "## 褰撳墠鐘舵€乗n鏃ユ湡: " + state.date + " | 杞: " + state.round + "/" + state.maxRounds + " | 闃舵: " + state.phase + "\n";
  ctx += "鍍靛眬: " + (state.deadlockDetected ? "鈿狅笍 宸茶Е鍙? : "姝ｅ父") + " | 绱ф€? " + (state.emergencyChannel ? "鈿?婵€娲? : "鏈縺娲?) + "\n";
  ctx += "淇¤獕鍒? " + (state.reputation[agentId]?.score || 80) + " | 绯荤粺杩愯: " + (loadSystemStats().totalRuns) + "\n\n";

  // 鏈疆宸插彂閫佹秷鎭憳瑕侊細甯姪agent鑷垜妫€鏌ラ噸澶?
  var ownRecentMsgs = state.messages.filter(function(m) { return m.from === agentId; }).slice(-5);
  if (ownRecentMsgs.length > 0) {
    ctx += "## 浣犳湰杞凡鍙戦€佺殑娑堟伅\n";
    ownRecentMsgs.forEach(function(m) {
      ctx += "- [" + (m.type || "info") + "] " + (m.coreInfo || "").slice(0, 80) + "\n";
    });
    ctx += "\n";
  }
  var sysMem = loadSystemMemory();
  if (sysMem.entries.length > 0) {
    var lastEntry = sysMem.entries[sysMem.entries.length - 1];
    ctx += "鏄ㄦ棩缁忛獙: ";
    if (lastEntry.learnings) ctx += String(lastEntry.learnings).slice(0, 120) + "\n";
    if (lastEntry.weaknesses && lastEntry.weaknesses.length > 0)
      ctx += "  寮辩偣: " + lastEntry.weaknesses.slice(0, 2).join("; ") + "\n";

  // role-specific history
  if (lastEntry.perRole && lastEntry.perRole[agentId]) {
    var roleMem = lastEntry.perRole[agentId];
    ctx += "浣犵殑鏄ㄦ棩琛ㄧ幇: 淇¤獕鍒?" + roleMem.score;
    if (roleMem.changes && roleMem.changes.length > 0) {
      ctx += ' | 鏈€杩戝彉鍔? ' + roleMem.changes.slice(-2).map(function(c) { return (c.delta > 0 ? '+' : '') + c.delta + (c.reason ? '(' + String(c.reason).slice(0, 30) + ')' : ''); }).join('; ');
    }
    ctx += "\n";
  }
  }

  ctx += "## 寰呭鐞嗘秷鎭痋n";
  if (msgs.length === 0) ctx += "(鏃犳柊娑堟伅)\n";
  for (const m of msgs) {
    ctx += "[" + m.id + "] " + m.from + " 鈫?" + m.to + " | " + (m.type || "info") + " | " + m.priority + "\n";
    ctx += "  " + m.coreInfo + "\n";
    if (m.expectedAction) ctx += "  鏈熸湜: " + m.expectedAction + "\n";
    if (m.reason) ctx += "  鐞嗙敱: " + m.reason + "\n\n";
  }

  ctx += "\n## 宸ヤ綔鍖篭n";

  // ===== Phase 2: 娉ㄥ叆瑙掕壊璁板繂 =====
  ctx += buildMemoryContext(agentId);
  // Inject current rule versions
  try {
    var ruleFiles = ["collection-rules.md", "verification-rules.md", "style-guide.md", "communication-rules.md", "quality_standards.md", "credit_score_system.md"];
    var ruleVerInfo = "";
    ruleFiles.forEach(function(rf) {
      var rc = fs.readFileSync(path.join(RULES_DIR, rf), "utf-8");
      var vM = rc.match(/version:\s*(\S+)/); var uM = rc.match(/updated:\s*(\S+)/);
      if (vM) ruleVerInfo += rf.replace(".md", "") + ": " + vM[1] + (uM ? " (" + uM[1] + ")" : "") + "\n";
    });
    ctx += "\n## Current Rule Versions\n" + ruleVerInfo + "\n";
  } catch(e) { /* skip */ }

  if (agentId === "collector") {
    ctx += "rawItems: " + state.rawItems.length + " | 寰呰ˉ閲囪姹? " + state.supplementRequests.filter(r => r.status === "pending").length + "\n";
    const rej = state.messages.filter(m => m.type === "REJECT" && m.to === "collector").slice(-5);
    if (rej.length) { ctx += "鏈€杩戣鎵撳洖:\n"; for (const r of rej) ctx += "  - " + r.coreInfo + "\n"; }
        // Inject knowledge gap report
    try {
      var gapPath = path.join(OUTPUT_DIR, "knowledge-gap-report.md");
      if (fs.existsSync(gapPath)) {
        var gapContent = fs.readFileSync(gapPath, "utf-8");
        var gapKeywords = gapContent.match(/\*\*([^\*]+)\*\*/g);
        if (gapKeywords && gapKeywords.length > 0) {
          ctx += "\n## Knowledge Gaps\n" + gapKeywords.slice(0, 8).join("\n") + "\n";
        }
      }
    } catch(e) { /* no gap report */ }
    ctx += "\n## 閲囬泦瑙勫垯\n" + (state.rules["collection-rules"] || "(鏃?") + "\n";
  }
  if (agentId === "verifier") {
    const pending = state.rawItems.filter(i => i.status === "pending");
    ctx += "寰呭鏍? " + pending.length + " 鏉n";
    for (const item of pending.slice(0, 20)) {
      ctx += "  [" + item.id + "] " + item.title.slice(0, 80) + " | " + item.source + " | " + item.lang + "\n";
      ctx += "   鍒嗙被: " + (item.keywords_matched || []).join(", ") + " | " + item.summary.slice(0, 120) + "\n";
    }
    ctx += "\n## 鏍告煡瑙勫垯\n" + (state.rules["verification-rules"] || "(鏃?") + "\n";
  }
  if (agentId === "analyst") {
    ctx += "宸查獙璇? " + state.verifiedItems.length + " | 宸叉湁insight: " + state.insights.length + "\n";
    for (const item of state.verifiedItems.slice(-15)) ctx += "  [" + item.id + "] " + item.title.slice(0, 80) + " | " + item.category + "\n";
  }
  if (agentId === "editor") {
    ctx += "宸查獙璇? " + state.verifiedItems.length + " 鏉?| insights: " + state.insights.length + " 鏉n";
    ctx += "\n### 宸查獙璇佺礌鏉愬垪琛╘n";
    for (const item of state.verifiedItems.slice(-25)) {
      ctx += "  - [" + item.id + "] " + item.title.slice(0, 100) + " | " + item.source + " | " + item.category + "\n";
    }
    ctx += "\n### 鍒嗘瀽甯堟礊瀵焅n";
    if (state.insights.length === 0) ctx += "(鏆傛棤娲炲療)\n";
    for (const ins of state.insights) {
      ctx += "  - [" + ins.id + "] " + String(ins.title || "").slice(0, 100) + "\n";
    }
    if (state.draft) ctx += "\n鑽夌宸叉湁 " + (state.draft.sections?.length || 0) + " 涓珷鑺俓n";
    ctx += "\n## 鎺掔増瑙勮寖\n" + (state.rules["style-guide"] || "(鏃?") + "\n";
  }
  if (agentId === "memory-manager") {
    ctx += "rawItems: " + state.rawItems.length + " | verified: " + state.verifiedItems.length + " | rejected: " + state.rejectedItems.length + "\n";
    ctx += "insights: " + state.insights.length + " | 娑堟伅鎬绘暟: " + state.messages.length + "\n";
    ctx += "閲囬泦鎻愪氦: " + state.stats.collectorSubmitted + " | 閫氳繃: " + state.stats.verifierPassed + " | 鎷掔粷: " + state.stats.verifierRejected + "\n";
    var sysMem = loadSystemMemory();
    if (sysMem.entries.length > 0) {
      ctx += "\n## 杩戞湡缁忛獙璁板繂\n";
      var recentEntries = sysMem.entries.slice(-5);
      for (var ei = recentEntries.length - 1; ei >= 0; ei--) {
        var entry = recentEntries[ei];
        ctx += entry.date + ": ";
        if (entry.learnings) ctx += String(entry.learnings).slice(0, 150) + "\n";
        if (entry.weaknesses && entry.weaknesses.length > 0)
          ctx += "  寮辩偣: " + entry.weaknesses.slice(0, 3).join("; ") + "\n";

  // role-specific history
  if (lastEntry.perRole && lastEntry.perRole[agentId]) {
    var roleMem = lastEntry.perRole[agentId];
    ctx += "浣犵殑鏄ㄦ棩琛ㄧ幇: 淇¤獕鍒?" + roleMem.score;
    if (roleMem.changes && roleMem.changes.length > 0) {
      ctx += ' | 鏈€杩戝彉鍔? ' + roleMem.changes.slice(-2).map(function(c) { return (c.delta > 0 ? '+' : '') + c.delta + (c.reason ? '(' + String(c.reason).slice(0, 30) + ')' : ''); }).join('; ');
    }
    ctx += "\n";
  }
      }
    }
  }
  ctx += "\n## 鏈€杩戞秷鎭痋n";
  for (const m of state.messages.slice(-30)) ctx += "[" + m.id + "] " + m.from + "鈫? + m.to + " " + (m.type || "info") + ": " + m.coreInfo + "\n";
  return ctx;
}

// ===================== Agent 鎵ц =====================
async function runAgent(agentId, state, extraInstructions) {
  const systemPrompt = loadPrompt(agentId);
  const context = buildAgentContext(agentId, state);
  const fullPrompt = context + (extraInstructions ? "\n## 鏈疆鐗规畩鎸囦护\n" + extraInstructions + "\n" : "");

  log(agentId, "寮€濮嬫€濊€?.. (杞" + state.round + ")");
  try {
    const response = await callDeepSeek(systemPrompt, fullPrompt, 0.7, 4096);
    const result = extractJSON(response);
    if (result) {
      if (result.internal_thought) log(agentId, "馃挱 " + result.internal_thought.slice(0, 120));
      if (result.messages && Array.isArray(result.messages)) {
        // Messages are validated and pushed in the main loop
      }
      return result;
    }
    log(agentId, "鈿狅笍 鏃犳硶瑙ｆ瀽杈撳嚭");
    return { raw_output: response.slice(0, 500), actions: [], messages: [] };
  } catch (err) {
    log(agentId, "鉂?澶辫触: " + err.message);
        pushMessage(state, createMessage(agentId, "system", "ERROR", "API璋冪敤澶辫触(杞" + state.round + "): " + err.message, "", "", "high"));
return { error: err.message, actions: [], messages: [] };
  }
}

// ===================== 鍍靛眬妫€娴?=====================
function detectDeadlock(state) {
  const recent = state.messages.slice(-50);
  if (recent.filter(m => m.type === "ESCALATE").length >= 2) { log("system", "鈿狅笍 鍗囩骇娑堟伅瑙﹀彂鍍靛眬"); return true; }
  const rejects = recent.filter(m => m.type === "REJECT");
  const rc = {};
  for (const r of rejects) { const k = r.from + "鈫? + r.to; rc[k] = (rc[k] || 0) + 1; }
  for (const [k, v] of Object.entries(rc)) { if (v >= 4) { log("system", "鈿狅笍 " + k + " 杩炵画鎵撳洖" + v + "娆?); return true; } }
  if (state.round >= 4 && state.stats.verifierPassed === 0 && state.rejectedItems.length > state.verifiedItems.length * 2) { log("system", "鈿狅笍 鏍告煡閫氳繃鐜囨寔缁负0"); return true; }
  return false;
}

// ===================== 浠茶 =====================
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

// ===================== 绱ф€ラ€氶亾 =====================
async function handleEmergencyChannel(state) {
  log("system", "鈿?绱ф€ラ€氶亾瑙﹀彂");
  const inst = "## 绱ф€ラ€氶亾璁ㄨ\n浣犳槸璁板繂绠＄悊甯堛€侾RIORITY_OVERRIDE宸茶Е鍙戙€傚彫闆嗗叏浣撴姇绁紙绠＄悊甯?绁紝鍏朵綑鍚?绁紝鈮?绁ㄩ€氳繃锛夈€俓n杈撳嚭: { \"emergency_discussion\": { \"triggered_by\": \"...\", \"topic\": \"...\", \"votes\": {...}, \"result\": \"passed/rejected\", \"total_votes\": N }, \"internal_thought\": \"...\" }";
  const result = await runAgent("memory-manager", state, inst);
  return result;
}

// ===================== 杩囩▼鏃ュ織鐢熸垚 =====================
// ===================== 绱㈠紩鏇存柊 =====================

// ===================== 瑙掕壊璁板繂绯荤粺 (Phase 2) =====================
var MEMORY_DIR = path.join(ROOT_DIR, "scripts", "memories");

function ensureMemoryDir() {
  if (!fs.existsSync(MEMORY_DIR)) fs.mkdirSync(MEMORY_DIR, { recursive: true });
}

var AGENT_NAMES_CN_MEM = {
  collector: "閲囬泦甯?, verifier: "鏍告煡甯?, analyst: "鍒嗘瀽甯?,
  editor: "缂栬緫甯?, "memory-manager": "璁板繂绠＄悊甯?
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
  var ctx = "\n## 馃 浣犵殑涓汉璁板繂\n";
  ctx += "瑙掕壊: " + (AGENT_NAMES_CN_MEM[agentId] || agentId) + " | 璁板繂鎬绘暟: " + (mem.experiences || []).length + "鏉n";
  ctx += "> 浣犺寰楄繃鍘诲彂鐢熺殑姣忎欢浜嬧€斺€斾互涓嬫槸浣犳墍鏈夌殑缁忓巻\n\n";
  
  // Relationships
  ctx += "\n### 浣犱笌鍏朵粬瑙掕壊鐨勫叧绯籠n";
  var rels = mem.relationships || {};
  var relKeys = Object.keys(rels);
  if (relKeys.length === 0) {
    ctx += "(灏氭棤鍏崇郴璁板綍)\n";
  } else {
    relKeys.forEach(function(k) {
      var r = rels[k];
      var trendIcon = r.trend === "improving" ? "鈫? : r.trend === "declining" ? "鈫? : "鈫?;
      ctx += "- " + (AGENT_NAMES_CN_MEM[k] || k) + ": 淇′换搴?" + r.trust + trendIcon;
      if (r.summary) ctx += " 鈥?" + String(r.summary).slice(0, 120);
      ctx += "\n";
    });
  }

  // Recent experiences - show all, with auto-summary when many
  var exps = mem.experiences || [];
  if (exps.length > 0) {
    ctx += "\n### 杩戞湡鍏抽敭缁忓巻 (鍏? + exps.length + "鏉¤蹇?\n";
    var displayExps = exps.length > 20 ? exps.slice(-20) : exps;
    if (exps.length > 20) ctx += "(鏄剧ず鏈€杩?0鏉? 鍏? + exps.length + "鏉?\n";
    displayExps.forEach(function(e) {
      ctx += "- " + e.date + " [" + (e.type || "浜嬩欢") + "]: " + String(e.summary || "").slice(0, 80) + "\n";
      if (e.lesson) ctx += "  鏁欒: " + String(e.lesson).slice(0, 80) + "\n";
    });
  }

  // Self review
  var sr = mem.selfReview || {};
  if (sr.weaknesses && sr.weaknesses.length > 0) {
    ctx += "\n### 寰呮敼杩涢」\n";
    sr.weaknesses.slice(0, 3).forEach(function(w) { ctx += "- " + w + "\n"; });
  }
  if (sr.improvementPlan) {
    ctx += "鏀硅繘璁″垝: " + String(sr.improvementPlan).slice(0, 80) + "\n";
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
    mem.relationships[otherId].history.push({ date: dateStr, event: (conflicts > praises ? "鍐茬獊" : "鍚堜綔") + " " + interactionCounts[otherId] + "娆?, trustDelta: delta });
    // Update trend
    var recentH = mem.relationships[otherId].history;
    var avgDelta = recentH.reduce(function(s, h) { return s + (h.trustDelta || 0); }, 0) / Math.max(recentH.length, 1);
    mem.relationships[otherId].trend = avgDelta > 1 ? "improving" : avgDelta < -1 ? "declining" : "stable";
    // Summary
    var trust = mem.relationships[otherId].trust;
    mem.relationships[otherId].summary = trust >= 70 ? "鍏崇郴鑹ソ" : trust >= 40 ? "鍏崇郴涓€鑸? : "鍏崇郴绱у紶";
  });

  if (!mem.experiences) mem.experiences = [];

  // ===== 閲囬泦甯堜笓灞烇細浠庡疄闄呯礌鏉愪腑鎻愬彇姝ｅ弽妗堜緥 =====
  if (agentId === "collector") {
    var rejectedToday = (state.rejectedItems || []).filter(function(item) {
      return item.verify_reason && item.title;
    });
    var verifiedToday = (state.verifiedItems || []).filter(function(item) {
      return item.verify_reason && item.title;
    });

    // 鎻愬彇琚嫆妗堜緥锛堟渶澶?鏉★級
    var recentRejects = rejectedToday.slice(-5);
    for (var ri = 0; ri < recentRejects.length; ri++) {
      var rItem = recentRejects[ri];
      mem.experiences.push({
        date: dateStr,
        type: "琚嫆妗堜緥",
        title: String(rItem.title || "").slice(0, 100),
        source: String(rItem.source || "鏈煡鏉ユ簮"),
        reason: String(rItem.verify_reason || "").slice(0, 100),
        summary: "琚嫆: " + String(rItem.title || "").slice(0, 80),
        lesson: "閬垮厤閲囬泦姝ょ被绱犳潗: " + String(rItem.verify_reason || "").slice(0, 80)
      });
    }

    // 鎻愬彇鏍囨潌妗堜緥锛堟渶澶?鏉★級
    var recentPasses = verifiedToday.slice(-5);
    for (var pi = 0; pi < recentPasses.length; pi++) {
      var pItem = recentPasses[pi];
      mem.experiences.push({
        date: dateStr,
        type: "鏍囨潌妗堜緥",
        title: String(pItem.title || "").slice(0, 100),
        source: String(pItem.source || "鏈煡鏉ユ簮"),
        summary: "閫氳繃: " + String(pItem.title || "").slice(0, 80),
        lesson: "姝ょ被绱犳潗鍊煎緱閲囬泦: 鍛戒腑鍏抽敭璇?" + (pItem.keywords_matched || []).slice(0, 3).join(", ")
      });
    }

    // 璁板綍褰撴棩缁熻
    var totalChecked = rejectedToday.length + verifiedToday.length;
    if (totalChecked > 0) {
      var passRate = Math.round(verifiedToday.length / totalChecked * 100);
      mem.experiences.push({
        date: dateStr,
        type: "姣忔棩缁熻",
        summary: "浠婃棩閫氳繃鐜? " + passRate + "% (" + verifiedToday.length + "/" + totalChecked + ")",
        lesson: passRate < 30 ? "閫氳繃鐜囧亸浣庯紝闇€鏀剁揣閲囬泦鏍囧噯" : passRate >= 60 ? "閫氳繃鐜囪壇濂斤紝淇濇寔褰撳墠鏍囧噯" : ""
      });
    }
  } else {
    // ===== 鍏朵粬瑙掕壊锛氫粠閫氫俊娑堟伅鎻愬彇缁忛獙 =====
    var significantChanges = state.messages.filter(function(m) {
      return (m.from === agentId || m.to === agentId) &&
        (m.type === "REJECT" || m.type === "ESCALATE" || m.type === "APPROVE" || m.type === "DIRECTIVE");
    });

    if (significantChanges.length > 0) {
      var worst = significantChanges.filter(function(m) { return m.type === "REJECT" || m.type === "ESCALATE"; });
      var best = significantChanges.filter(function(m) { return m.type === "APPROVE" || m.type === "DIRECTIVE"; });

      if (worst.length > 0) {
        var wMsg = worst[0];
        mem.experiences.push({
          date: dateStr,
          type: "閲嶅ぇ鎸涙姌",
          summary: "琚? + (AGENT_NAMES_CN_MEM[wMsg.from === agentId ? wMsg.to : wMsg.from] || wMsg.from) + " " + wMsg.type + ": " + String(wMsg.coreInfo || "").slice(0, 80),
          lesson: "",
          impact: ""
        });
      }
      if (best.length > 0) {
        var bMsg = best[0];
        mem.experiences.push({
          date: dateStr,
          type: "姝ｅ悜鍙嶉",
          summary: "鏀跺埌" + (AGENT_NAMES_CN_MEM[bMsg.from] || bMsg.from) + "鐨? + bMsg.type + ": " + String(bMsg.coreInfo || "").slice(0, 80),
          lesson: "",
          impact: ""
        });
      }
    }
  }

  // 瑁佸壀鏃х粡楠岋紝鍙繚鐣欐渶杩?0鏉?
  if (mem.experiences.length > 50) {
    mem.experiences = mem.experiences.slice(-50);
  }


  // Update selfReview
  var myRejects = state.messages.filter(function(m) { return m.type === "REJECT" && m.to === agentId; });
  var myApproves = state.messages.filter(function(m) { return m.type === "APPROVE" && m.to === agentId; });

  if (!mem.selfReview.weaknesses) mem.selfReview.weaknesses = [];
  if (!mem.selfReview.strengths) mem.selfReview.strengths = [];

  if (myRejects.length >= 5 && mem.selfReview.weaknesses.indexOf("璐ㄩ噺涓嶇ǔ瀹?) < 0) {
    mem.selfReview.weaknesses.push("璐ㄩ噺涓嶇ǔ瀹?);
  }
  if (myApproves.length >= 3 && mem.selfReview.strengths.indexOf("寰楀埌璁ゅ彲") < 0) {
    mem.selfReview.strengths.push("寰楀埌璁ゅ彲");
  }
  if (myRejects.length < 3 && mem.selfReview.weaknesses.indexOf("璐ㄩ噺涓嶇ǔ瀹?) >= 0) {
    mem.selfReview.weaknesses = mem.selfReview.weaknesses.filter(function(w) { return w !== "璐ㄩ噺涓嶇ǔ瀹?; });
  }

  saveAgentMemory(agentId, mem);
}

// ===================== 涓绘祦绋?=====================
async function main() {
  const now = new Date();
  const dateStr = (function() {
  if (process.env.OVERRIDE_DATE) return process.env.OVERRIDE_DATE;
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
})();
  const dateCN = (function() { var parts = dateStr.split("-"); return parts[0] + "骞? + parseInt(parts[1]) + "鏈? + parseInt(parts[2]) + "鏃?; })();
  const systemStats = loadSystemStats();
  systemStats.totalRuns++;
  if (!systemStats.firstRunDate) systemStats.firstRunDate = dateStr;
  systemStats.lastRunDate = dateStr;
  
  CURRENT_DATE = dateStr;
  saveSystemStats(systemStats);

  console.log("鈴憋笍 鍚姩鏃堕棿: " + new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }));
  console.log("\n馃 YUTATA 澶欰gent鏃ユ姤绯荤粺 v4");
  console.log("馃搮 " + dateCN + " | " + dateStr);
  console.log("馃懃 浜斾釜瑙掕壊: 閲囬泦甯?路 鏍告煡甯?路 鍒嗘瀽甯?路 缂栬緫甯?路 璁板繂绠＄悊甯圽n");

  // ===== 鍒濆鍖?=====
  log("system", "闃舵0: 鍒濆鍖?);
  const state = createInitialState(dateStr);
  state.phase = "init";

  // ===== 棣栨鎶撳彇 =====
  log("system", "闃舵1: 棣栨鎶撳彇");
  state.phase = "collecting";
  const history = loadHistory();
  log("system", "鍘嗗彶鍘婚噸: " + history.seenUrls.size + " URL");

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
        category: kw.length > 0 ? kw[0] : "鍏朵粬", status: "pending"
      });
    }
  }
  state.stats.collectorSubmitted = state.rawItems.length;
  // Sort by source weight: higher-weight sources first
  var weightMap = {}; SOURCES.forEach(function(s) { weightMap[s.name] = s.weight || 5; });
  state.rawItems.sort(function(a, b) { return (weightMap[b.source] || 5) - (weightMap[a.source] || 5); });
  state.rawItems.forEach(function(item, k) { item.id = "RAW-" + dateStr + "-" + String(k + 1).padStart(4, "0"); });
  log("collector", "棣栨鎶撳彇: " + state.rawItems.length + " 鏉℃柊鍐呭");

  pushMessage(state, createMessage("collector", "verifier", "NOTIFY",
    "棣栨閲囬泦瀹屾垚锛? + state.rawItems.length + " 鏉″緟瀹℃牳", "璇峰紑濮嬫牳鏌?, "浠婃棩鍩虹绱犳潗", "high"));

  // ===== 澶氳疆鍗氬紙 =====
  for (let round = 1; round <= state.maxRounds; round++) {
    state.round = round;
    log("system", "\n鈹佲攣鈹?绗?" + round + "/" + state.maxRounds + " 杞?鈹佲攣鈹?);

    const agentsToRun = [];
    const hasPendingSupp = state.supplementRequests.some(r => r.status === "pending");
    const hasDisputes = state.messages.slice(-10).some(m => m.type === "DISPUTE" && m.to === "collector");
    if ((hasPendingSupp || hasDisputes || round <= 2) && round <= 4) agentsToRun.push("collector");
    if (state.rawItems.some(i => i.status === "pending") && round <= 4) agentsToRun.push("verifier");
    if (state.verifiedItems.length > 0 && round <= 4) agentsToRun.push("analyst");
    if (round >= 2 && state.verifiedItems.length > 0 && round <= 5) agentsToRun.push("editor");
    if (round >= 2 || state.deadlockDetected) agentsToRun.push("memory-manager");

    if (agentsToRun.length === 0) { log("system", "绗? + round + "杞烦杩?); continue; }
    log("system", "鍙備笌: " + agentsToRun.map(a => AGENT_NAMES_CN[a]).join("銆?));

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

    // 澶勭悊杈撳嚭
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
                category: kw.length > 0 ? kw[0] : "鍏朵粬", status: "pending"
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
              var repReason = "瀹℃牳浜? + (passCount + rejectCount) + "鏉＄礌鏉愶紝閫氳繃" + passCount + "鏉?;
              if (rejectReasons.length > 0) repReason += "銆傛嫆缁濆師鍥? " + rejectReasons.slice(0, 2).join("; ");
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
          log("editor", "浠庡師濮嬭緭鍑烘仮澶嶈崏绋? " + sections.length + " 涓珷鑺?);
        }
      }

      // 鈶?鍏滃簳锛氭鏌ユ槸鍚﹀寘鍚洸搴撲汉蹇呯湅 / 鍐风煡璇嗘澘鍧?
      if (agentId === "editor" && state.draft && state.draft.sections && state.verifiedItems.length > 0) {
        var hasRequiredSection = state.draft.sections.some(function(s) { return s.title && /鏇插簱浜?.test(s.title); });
        var hasTriviaSection = state.draft.sections.some(function(s) { return s.title && /鍐风煡璇?.test(s.title); });
        if (!hasRequiredSection) {
          var fallbackMusician = "## 鏇插簱浜哄繀鐪?\u2014 鏈懆/浠婃棩瀹炴搷寤鸿\n\n> \u26a0\ufe0f 浠婃棩AI鐢熸垚鏈寘鍚洸搴撲汉蹇呯湅鏉垮潡锛屼互涓嬩负绯荤粺鍩轰簬褰撴棩绱犳潗鑷姩琛ュ厖锛歕n\n";
          var actionItems = state.verifiedItems.slice(0, 5).map(function(item) {
            return "- \u25b6\ufe0f 鍏虫敞 **" + item.title.slice(0, 30) + "**" + (item.source ? "\uff08鏉ユ簮锛? + item.source + "\uff09" : "") + "\n  鍙傝€冿細[" + item.link.slice(0, 60) + "](" + item.link + ")";
          }).join("\n");
          fallbackMusician += actionItems + "\n\n> \ud83d\udcdd 缂栬緫鎻愮ず锛氭涓鸿嚜鍔ㄨˉ鍏咃紝寤鸿涓嬫杩愯鏃剁敱缂栬緫甯堟挵鍐欓拡瀵规€ф洿寮虹殑鐗堟湰銆俓n";
          state.draft.sections.push({ title: "鏇插簱浜哄繀鐪?, content: fallbackMusician, referenced_items: [], referenced_insights: [] });
          log("editor", "鑷姩琛ュ厖鏇插簱浜哄繀鐪嬫澘鍧?);
        }
        if (!hasTriviaSection) {
          var fallbackTrivia = "## \ud83d\udca1 鍐风煡璇?/ 寤朵几\n\n> \u26a0\ufe0f 浠婃棩AI鐢熸垚鏈寘鍚喎鐭ヨ瘑鏉垮潡锛屼互涓嬩负绯荤粺鍩轰簬褰撴棩绱犳潗鑷姩琛ュ厖锛歕n\n";
          var randomItem = state.verifiedItems[Math.floor(Math.random() * state.verifiedItems.length)];
          if (randomItem) {
            fallbackTrivia += "- 鏉ヨ嚜 **" + randomItem.source + "** 鐨勬姤閬擄細\"" + randomItem.title + "\"\n  鍘熸枃鎽樿锛? + (randomItem.summary || "鏃犳憳瑕?).slice(0, 200) + "\n  \u2014 [" + randomItem.link + "](" + randomItem.link + ")\n";
          } else {
            fallbackTrivia += "- 浠婃棩鏈湁瓒冲鐨勭礌鏉愯嚜鍔ㄧ敓鎴愬喎鐭ヨ瘑銆傛湡寰呬笅涓€鏈熴€俓n";
          }
          fallbackTrivia += "\n> \ud83d\udcdd 缂栬緫鎻愮ず锛氭涓鸿嚜鍔ㄨˉ鍏咃紝寤鸿涓嬫杩愯鏃剁敱鍒嗘瀽甯堝拰缂栬緫甯堟彁渚涙洿鏈夎叮鐨勫喎鐭ヨ瘑銆俓n";
          state.draft.sections.push({ title: "鍐风煡璇?, content: fallbackTrivia, referenced_items: [], referenced_insights: [] });
          log("editor", "鑷姩琛ュ厖鍐风煡璇嗘澘鍧?);
        }
      }
      if (agentId === "memory-manager" && result.actions) {
        for (const action of result.actions) {
          if (action.type === "update_rule") state.stats.ruleChanges = (state.stats.ruleChanges || 0) + 1;
          if (action.type === "update_reputation") {
            updateReputation(action.agent, action.delta, action.reason, dateStr);
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

        // 鑷姩瓒呮椂锛氳秴杩?杞湭鍝嶅簲鐨勮ˉ閲囪姹傛爣璁颁负timeout
        state.supplementRequests.forEach(function(r) {
          if (r.status === "pending" && typeof r.round === "number" && state.round - r.round >= 2) {
            r.status = "timeout";
          }
        });

        // 妫€娴嬫敹鏁涳紙绗?杞捣锛夛細缂栬緫甯堢粓绋垮氨缁?+ 鏃犲緟琛ラ噰 + 鏃犳椿璺冧簤璁?+ 鏍告煡瀹屾瘯
    if (round >= 3) {
            // Final fallback: auto-generate draft when editor produces no output
      if (!state.draft || !state.draft.sections || state.draft.sections.length === 0) {
        var fbTopics = state.insights.slice(0, 3).map(function(i) { return i.title || i.topic || ""; });
        var fbSections = [];
        fbSections.push({ title: "馃摗 鏍稿績瑙ｈ", content: "缂栬緫甯堝鐞嗘棩鎶ヨ崏绋挎椂閬囧埌鎶€鏈棶棰橈紝浠ヤ笅涓哄熀浜庡凡楠岃瘉绱犳潗鐨勬牳蹇冩憳瑕併€俓n" + state.verifiedItems.slice(0, 5).map(function(v) { return "- [" + v.id + "] " + v.title; }).join("\n"), referenced_items: [], referenced_insights: [] });
        if (fbTopics.length > 0) {
          fbSections.push({ title: "馃攳 琛屼笟瓒嬪娍瑙傚療", content: fbTopics.map(function(t) { return "- " + t; }).join("\n"), referenced_items: [], referenced_insights: [] });
        }
        fbSections.push({ title: "馃搳 鏁版嵁姒傝", content: "閲囬泦 " + state.rawItems.length + " 绡?| 閫氳繃 " + state.verifiedItems.length + " 绡?| " + (state.stats.verifierPassed || 0) + " 鏉￠€氳繃鏍告煡", referenced_items: [], referenced_insights: [] });
        fbSections.push({ title: "鉁忥笍 缂栬緫澶囨敞", content: "浠婃棩缂栬緫甯堝鐞嗘棩鎶ヨ崏绋挎椂閬囧埌鎶€鏈棶棰橈紝鏃ユ姤鐢辩郴缁熻嚜鍔ㄧ敓鎴愩€傛暟鎹熀浜庡凡閫氳繃鏍告煡鐨勭礌鏉愩€? + (state.insights.length > 0 ? "鍒嗘瀽甯堟礊瀵熷凡鏁村悎銆? : ""), referenced_items: [], referenced_insights: [] });
        state.draft = { sections: fbSections };
        log("editor", "鑷姩鐢熸垚鍏滃簳鏃ユ姤: " + fbSections.length + " 涓珷鑺?);
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

    // 妫€娴嬪兊灞€
    if (round >= 3 && detectDeadlock(state)) {
      state.deadlockDetected = true;
      log("system", "鈿狅笍 鍍靛眬瑙﹀彂");
      if (state.messages.some(m => m.type === "PRIORITY_OVERRIDE")) {
        const emResult = await handleEmergencyChannel(state);
        state.emergencyChannel = emResult;
      }
      const verdict = await runArbitration(state);
      if (verdict && verdict.action_items) {
        for (const item of verdict.action_items) log("system", "馃搵 鎵ц: " + item);
      }
      break;
    }
  }

  // ===== 鏀舵暃: 鏈€缁堝鐩?=====
  log("system", "\n鈹佲攣鈹?鏀舵暃闃舵 鈹佲攣鈹?);
  // ???????2????????????timeout
  
  if (state.draft && state.draft.sections && state.draft.sections.length > 0) {
    log("system", "\n=== 瀹＄鐜妭 ===");
    state.phase = "review";
    var reviewAgents = ["collector", "verifier", "analyst", "editor", "memory-manager"];
    var reviewInst = "## 澶嶇洏\n浣犳槸{role}锛岃瀹屾垚浠婃棩宸ヤ綔澶嶇洏銆俓n- 鍦╟oreInfo涓啓涓嬩綘鐨?*浠婃棩宸ヤ綔鎬荤粨**锛堝唴瀹广€佽川閲忋€佽嚜鎴戝弽鎬濓紝涓嶅皯浜?0瀛楋級\n- **浠呭洖椤句綘鑷繁鐨勮鑹?*锛氫綘鍋氫簡浠€涔堛€佽川閲忓浣曘€佸弽鎬濅笌鏀硅繘鏂瑰悜\n- **涓嶈璇勪环鍏朵粬瑙掕壊**锛屼笉瑕佺敤\"鏈弬涓嶾"绫昏〃杩帮紝鍙鑷繁\n- 杈撳嚭: { \"messages\": [{ \"to\": \"memory-manager\", \"type\": \"APPROVE\", \"coreInfo\": \"浠婃棩宸ヤ綔鎬荤粨鍐呭\" }], \"internal_thought\": \"...\" }";
    for (var ri = 0; ri < reviewAgents.length; ri++) {
      var aid = reviewAgents[ri];
      var inst = reviewInst.replace("{role}", AGENT_NAMES_CN[aid]);
      try {
        var revResult = await runAgent(aid, state, inst);
        if (revResult && revResult.messages) {
          for (var rm of revResult.messages) {
            pushMessage(state, createMessage(aid, rm.to || "memory-manager", rm.type || "APPROVE", rm.coreInfo || "", rm.expectedAction || "", rm.reason || "", rm.priority || "normal"));
          }
        }
        if (revResult && revResult.internal_thought) log(aid, "?? [??] " + revResult.internal_thought.slice(0, 120));
      } catch(e) { log("system", aid + " review: " + e.message); }
    }

  }

  state.phase = "convergence";

  const finalInst = "## 鏈€缁堝鐩榎n浣犳槸璁板繂绠＄悊甯堬紝浠婃棩" + dateCN + "銆俓n\n璇疯瘎浼版棩鎶ヨ川閲忥紙蹇呴』濉啓quality_scores姣忎釜瀛楁(completeness/accuracy/depth/readability 0-10)锛夈€佷紭缂虹偣銆佽鍒欎慨鏀瑰缓璁€佷俊瑾夊垎璋冩暣銆俓n\n淇¤獕鍒嗚皟鏁? 姣忎釜瑙掕壊閮藉繀椤荤粰鍑?delta涓?涔熻)銆俽eason鍙啓浠婃棩琛ㄧ幇璇勪环锛屼笉瑕佸啓鍏蜂綋鍒嗘暟鍊笺€俓n\n杈撳嚭: { \"review\": { \"quality_scores\": {\"completeness\":0,\"accuracy\":0,\"depth\":0,\"readability\":0}, \"strengths\": [...], \"weaknesses\": [...], \"root_cause\": \"...\" }, \"actions\": [{\"type\":\"update_rule\",\"rule_file\":\"...\",\"change_type\":\"add/modify\",\"after\":\"...\",\"reason\":\"...\"}, {\"type\":\"update_reputation\",\"agent\":\"collector\",\"delta\":0,\"reason\":\"鍩轰簬浠婃棩琛ㄧ幇锛岀畝瑕佽鏄庤〃鐜帮紙涓嶅啓鍏蜂綋鍒嗘暟锛塡"}], \"internal_thought\": \"...\" }";
  const finalReview = await runAgent("memory-manager", state, finalInst);

  if (finalReview.actions) {
    for (const action of finalReview.actions) {
      if (action.type === "update_rule" && action.rule_file) {
        const version = generateRuleVersion(dateStr);
        const rulePath = path.join(RULES_DIR, path.basename(action.rule_file));
        const archivePath = path.join(RULES_DIR, "archive", path.basename(action.rule_file).replace(".md", "-" + version + ".md"));
        try {
          const oldContent = fs.readFileSync(rulePath, "utf-8");
          fs.writeFileSync(archivePath, "# " + action.rule_file + " - " + version + "\n> 褰掓。: " + dateStr + "\n\n" + oldContent, "utf-8");
        } catch(e) { console.log("[system] 褰掓。鏃ц鍒欏け璐? " + (e.message || "").slice(0, 60)); }
        const header = "---\ntitle: " + action.rule_file.replace(".md", "") + "\nversion: " + version + "\nupdated: " + dateStr + "\noutline: [2, 3]\n---\n\n> 馃搶 " + version + " | " + dateCN + "\n\n";
        writeFileUTF8(rulePath, header + (action.after || ""));
        log("memory-manager", "瑙勫垯鏇存柊: " + action.rule_file + " 鈫?" + version);
        // 杩藉姞鍒板彉鏇存棩蹇?
        try {
          var changelog = "";
          try { changelog = fs.readFileSync(CHANGELOG_FILE, "utf-8"); } catch { changelog = "# 瑙勫垯鍙樻洿鏃ュ織\n\n"; }
          changelog += "## " + dateStr + "\n";
          changelog += "- **" + action.rule_file + "** (" + version + "): " + (action.reason || "鏇存柊") + "\n";
          writeFileUTF8(CHANGELOG_FILE, changelog);
        } catch (clErr) { log("system", "鍙樻洿鏃ュ織鍐欏叆澶辫触: " + clErr.message.slice(0, 60)); }
      }
      if (action.type === "update_reputation" && action.agent) {
        updateReputation(action.agent, action.delta, action.reason, dateStr);
        if (!state.reputationChanges[action.agent]) state.reputationChanges[action.agent] = [];
        state.reputationChanges[action.agent].push({ delta: action.delta, reason: action.reason, date: state.date });
      }
    }
  }
  state.review = finalReview.review || state.review;

  // ===== 淇濆瓨缁忛獙璁板繂 =====
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
  // 鎻愬彇 learnings 浠庡鐩橈紙weaknesses + rootCause锛?
  var learnings = [];
  if (memEntry.weaknesses.length > 0) learnings.push("寮辩偣: " + memEntry.weaknesses.slice(0, 2).join("; "));
  if (memEntry.rootCause) learnings.push("鏍瑰洜: " + memEntry.rootCause);
  if (state.stats.ruleChanges > 0) learnings.push("瑙勫垯鍙樻洿: " + state.stats.ruleChanges + " 鏉?);
  memEntry.learnings = learnings.join(" | ");
  sysMem.entries.push(memEntry);
  saveSystemMemory(sysMem);

  // ===== 淇濆瓨瑙掕壊涓綋璁板繂 =====
  var allAgents = ["collector", "verifier", "analyst", "editor", "memory-manager"];
  for (var ai = 0; ai < allAgents.length; ai++) {
    updateAgentMemoryFromDay(allAgents[ai], state, dateStr, dateCN);
  }
  log("system", "瑙掕壊涓綋璁板繂宸叉洿鏂?);

  // ===== 鐢熸垚鏃ユ姤 =====
  log("system", "\n鈹佲攣鈹?鐢熸垚鏃ユ姤 鈹佲攣鈹?);
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
    report = "---\ntitle: " + dateStr + " | 琛屼笟闆疯揪鏃ユ姤\noutline: [2, 3]\n---\n\n# \uD83D\uDCE1 琛屼笟闆疯揪 \u00B7 " + dateCN + "\n\n> \uD83D\uDCCE 閲囬泦 " + state.rawItems.length + " 绡?| 鍛戒腑 " + state.verifiedItems.length + " 绡?| 澶欰gent鍗氬紙鐢熸垚\n> \uD83E\uDDBB 閲囬泦甯圽u00B7鏍告煡甯圽u00B7鍒嗘瀽甯圽u00B7缂栬緫甯圽u00B7璁板繂绠＄悊甯圽n\n" + sections + "\n---\n\n## \uD83D\uDCEE 鍙傝€冮摼鎺n\n<div class=\"ref-scroll\">\n" + refItems.map(function(item, idx) { return "<p id=\"ref-" + (idx + 1) + "\"><a href=\"" + item.link + "\">[" + (idx + 1) + "]</a> **" + item.title + "** \u00B7 " + item.source + "</p>"; }).join("\n") + "\n</div>\n\n---\n\n## \uD83D\uDCCA 鏁版嵁缁熻\n\n<div class=\"ref-scroll\">\n<table>\n<thead>\n<tr><th>鏉ユ簮</th><th>璇█</th><th>閲囬泦鏁?/th></tr>\n</thead>\n<tbody>\n" + [...new Set(state.rawItems.map(i => i.source))].map(src => "<tr><td>" + src + "</td><td>" + (state.rawItems.find(i => i.source === src)?.lang === "zh" ? "涓枃" : "EN") + "</td><td>" + state.rawItems.filter(i => i.source === src).length + "</td></tr>").join("\n") + "\n</tbody>\n</table>\n</div>\n\n> 鐢熸垚鏃堕棿\n> 鐢熸垚鏃堕棿: " + now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + "\n> [鏌ョ湅杩囩▼鏃ュ織](../logs/" + dateStr + ".md)\n";

  } else {
    var agentMsgs = (state.messages || []).filter(function(m) { return m.from && m.coreInfo; }).slice(-10);
    var msgSummary = agentMsgs.length > 0 ? "\n\n## 馃搵 浠ｇ悊閫氫俊鎽樿\n\n" + agentMsgs.map(function(m) {
      var name = AGENT_NAMES_CN[m.from] || m.from;
      var toName = AGENT_NAMES_CN[m.to] || m.to || "all";
      return "- **" + name + "** 鈫?" + toName + " [" + (m.type || "info") + "]: " + String(m.coreInfo || "").slice(0, 120);
    }).join("\n") + "\n" : "";
    report = "---\ntitle: " + dateStr + " | 琛屼笟闆疯揪鏃ユ姤\noutline: [2, 3]\n---\n\n# 馃摗 琛屼笟闆疯揪 路 " + dateCN + "\n\n> 鈿狅笍 浠婃棩缂栬緫甯堢幆鑺傚紓甯革紝鏃ユ姤鐢辩郴缁熻嚜鍔ㄧ敓鎴怽n> 馃摦 閲囬泦姒傚喌瑙佷笅鏂筡n> [鏌ョ湅杩囩▼鏃ュ織](../logs/" + dateStr + ".md)\n\n## 閲囬泦姒傚喌\n- 閲囬泦 " + state.rawItems.length + " 绡?| 閫氳繃 " + state.verifiedItems.length + " 绡嘰n" + msgSummary;
  }



  // 鍚庡鐞嗭細淇鎵€鏈夊垎鏋愬笀灏氭湭鎻愪氦绫婚敊璇爣娉?
  report = report.replace(/鍒嗘瀽甯圼^\n锛屻€俔{0,15}鏈??:鎻愪氦|鎻愪緵|杈撳嚭|鍙備笌)/gi, function(match) {
    console.log("缂栬緫澶囨敞鑷姩淇: " + match.slice(0, 20));
    return "鍒嗘瀽甯堟礊瀵熷凡鏁村悎鑷虫湰鏃ユ姤锛堣鎯呰鏍稿績瑙ｈ锛?;
  });
  report = report.replace(/灏氭湭(?:鎻愪氦|鎻愪緵|杈撳嚭)(?:娲炲療|鍒嗘瀽|鍐呭)?/gi, "宸叉暣鍚?);
  // 淇缂栬緫甯堟湭鍙備笌绫婚敊璇爣娉紙瀹＄鐜妭AI涓嶉伒瀹坧rompt鎸囦护锛?
  // 淇鎵€鏈夎鑹测€滄湭鍙備笌鈥濈被閿欒鏍囨敞
  var fixUncansai = {
    "閲囬泦甯?: "閲囬泦甯堝凡瀹屾垚浠婃棩绱犳潗閲囬泦涓庢彁浜わ紙璇﹁缁熻鏁版嵁锛?,
    "鏍告煡甯?: "鏍告煡甯堝凡瀹屾垚浠婃棩绱犳潗瀹℃牳宸ヤ綔锛堣瑙侀€氫俊璁板綍锛?,
    "鍒嗘瀽甯?: "鍒嗘瀽甯堝凡浜у嚭浠婃棩娲炲療涓庡垎鏋愶紙璇﹁鏍稿績瑙ｈ锛?,
    "缂栬緫甯?: "缂栬緫甯堝凡瀹屾垚浠婃棩鏃ユ姤鑽夌缂栨帓锛堣瑙佹鏂囷級",
    "璁板繂绠＄悊甯?: "璁板繂绠＄悊甯堝凡瀹屾垚浠婃棩瑙勫垯缁存姢涓庝俊瑾夎瘎浼帮紙璇﹁澶嶇洏娈碉級"
  };
  for (var role in fixUncansai) {
    report = report.replace(new RegExp(role + "鏈弬涓庝粖鏃ュ伐浣淸銆?]?", "g"), fixUncansai[role]);
  }
  // 淇TL;DR鎺掔増锛氱‘淇濇瘡鏉′箣闂存湁绌鸿锛岄槻姝arkdown娓叉煋鍚堜负涓€娈?
  report = report.replace(/^(## TL;DR 浠婃棩閫熻\n\n)((?:[^#\n].*\n?)+)/gm, function(match, header, body) {
    var items = body.split("\n").filter(function(l) { return l.trim(); });
    var formatted = items.map(function(item, i) {
      return (i > 0 ? "\n" : "") + item.trim();
    }).join("\n\n");
    return header + formatted;
  });

  // 淇缂栬緫澶囨敞閲嶅鍑虹幇锛圓I缂栬緫甯堝伓鍙戣緭鍑轰袱涓紪杈戝娉ㄦ爣棰橈級
  report = report.replace(/^(##\s*缂栬緫澶囨敞\s*\n +(?:---\n+)?)\n*###\s*缂栬緫澶囨敞/gm, function(m, g1) { return g1 + "\n### 缂栬緫澶囨敞"; });
  
  writeFileUTF8(path.join(OUTPUT_DIR, dateStr + ".md"), report);
  log("system", "鏃ユ姤宸蹭繚瀛? " + dateStr + ".md");

  // ===== 杩囩▼鏃ュ織 =====
  log("system", "\n鈹佲攣鈹?鐢熸垚杩囩▼鏃ュ織 鈹佲攣鈹?);
  var logContent = generateProcessLog(state, dateStr);
  // 淇杩囩▼鏃ュ織涓殑"缂栬緫甯堟湭鍙備笌浠婃棩宸ヤ綔"绫婚敊璇爣娉?
  // 淇鎵€鏈夎鑹测€滄湭鍙備笌鈥?
  var fixUncansaiLog = { "閲囬泦甯?: "閲囬泦甯堝凡瀹屾垚浠婃棩绱犳潗閲囬泦锛堣瑙佺粺璁★級", "鏍告煡甯?: "鏍告煡甯堝凡瀹屾垚浠婃棩瀹℃牳锛堣瑙侀€氫俊璁板綍锛?, "鍒嗘瀽甯?: "鍒嗘瀽甯堝凡浜у嚭浠婃棩娲炲療锛堣瑙佹牳蹇冭В璇伙級", "缂栬緫甯?: "缂栬緫甯堝凡瀹屾垚鑽夌缂栨帓锛堣瑙佹鏂囷級", "璁板繂绠＄悊甯?: "璁板繂绠＄悊甯堝凡瀹屾垚瑙勫垯缁存姢涓庝俊瑾夎瘎浼帮紙璇﹁澶嶇洏娈碉級" };
  for (var role in fixUncansaiLog) {
    logContent = logContent.replace(new RegExp(role + "鏈弬涓庝粖鏃ュ伐浣淸銆?]?", "g"), fixUncansaiLog[role]);
  }
  writeFileUTF8(path.join(LOGS_DIR, dateStr + ".md"), logContent);
  log("system", "鏃ュ織宸蹭繚瀛? logs/" + dateStr + ".md");

  updateDailyIndex(dateStr);
  updateLogsIndex(dateStr);

  // ===== 鍛ㄦ姤 =====
  if (now.getDay() === 0) {
    log("system", "\n鈹佲攣鈹?鐢熸垚鍛ㄦ姤 鈹佲攣鈹?);
    try {
      log("system", "杩愯璁板繂绠＄悊甯堢幆璇?..");
      var mmReview = require("./mm-review");
      await mmReview.runEvals();
      log("system", "鐜瘎瀹屾垚");
    } catch (e) {
      log("system", "鐜瘎璺宠繃: " + String(e.message).slice(0, 60));
    }
    const wn = (function(d) { var sysStart = new Date(2026, 5, 28); var days = Math.floor((d - sysStart) / 86400000); return Math.ceil((days + 1) / 7); })(now);
    writeFileUTF8(path.join(WEEKLY_DIR, "review-" + dateStr.slice(0, 4) + "-W" + String(wn).padStart(2, "0") + ".md"), generateWeeklyReport(state, dateStr));
    updateWeeklyIndex(dateStr, wn);
    log("system", "鍛ㄦ姤宸蹭繚瀛?);
  }

  console.log("\n鉁?澶欰gent鏃ユ姤绯荤粺瀹屾垚");
  console.log("   馃摪 docs/daily/" + dateStr + ".md");
  console.log("   馃搵 docs/logs/" + dateStr + ".md");
  console.log("   鈿栵笍 浠茶: " + (state.deadlockDetected ? "瑙﹀彂" : "鏈Е鍙?));
  console.log("   鈿?绱ф€? " + (state.emergencyChannel ? "瑙﹀彂" : "鏈Е鍙?));
  console.log("   馃摑 瑙勫垯鍙樻洿: " + (state.stats.ruleChanges || 0) + " 鏉n");
}

main().catch((err) => {
  console.error("鑷村懡閿欒:", err);
  process.exit(1);
});


