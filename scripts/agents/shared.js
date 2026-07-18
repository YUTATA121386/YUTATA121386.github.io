/**
 * 澶?Agent 鏃ユ姤绯荤粺 - 鍏变韩妯″潡
 * 鐘舵€佺鐞嗐€佹秷鎭€荤嚎銆佷俊瑾夌郴缁熴€丏eepSeek API 璋冪敤
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// ===================== 閰嶇疆 =====================
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";
const ROOT_DIR = path.join(__dirname, "..", "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "docs", "daily");
const LOGS_DIR = path.join(ROOT_DIR, "docs", "logs");
const WEEKLY_DIR = path.join(ROOT_DIR, "docs", "weekly");
const RULES_DIR = path.join(ROOT_DIR, "docs", "rules");
const PROMPTS_DIR = path.join(__dirname, "..", "prompts");
const REPUTATION_FILE = path.join(ROOT_DIR, "scripts", "reputation.json");

// ===================== 娑堟伅鍗忚 =====================
const MSG_TYPES = ["REJECT", "REQUEST", "DISPUTE", "NOTIFY", "ESCALATE", "CONFIRM", "PRIORITY_OVERRIDE", "COMMAND", "DIRECTIVE", "APPROVE", "GUIDANCE", "INQUIRE", "INFO"];
const AGENTS = ["collector", "verifier", "analyst", "editor", "memory-manager"];
const AGENT_NAMES_CN = {
  collector: "閲囬泦甯?,
  verifier: "鏍告煡甯?,
  analyst: "鍒嗘瀽甯?,
  editor: "缂栬緫甯?,
  "memory-manager": "璁板繂绠＄悊甯?
};

// ===================== 鐘舵€佺鐞?=====================
function createInitialState(dateStr) {
  return {
    date: dateStr,
    round: 0,
    maxRounds: 5,
    phase: "init",
    deadlockDetected: false,
    arbitration: null,
    emergencyChannel: null,
    rawItems: [],
    verifiedItems: [],
    rejectedItems: [],
    insights: [],
    supplementRequests: [],
    draft: null,
    finalReport: null,
    messages: [],
    reputation: loadReputation(),
    rules: loadCurrentRules(),
    stats: {
      collectorSubmitted: 0,
      verifierPassed: 0,
      verifierRejected: 0,
      analystRequests: 0,
      analystHitRate: 0,
      emergencyTriggered: false,
      roundExecuted: 0
    },
    reputationChanges: {}
  };
}

function loadCurrentRules() {
  const rules = {};
  const ruleFiles = ["collection-rules.md", "verification-rules.md", "style-guide.md", "credit_score_system.md"];
  for (const f of ruleFiles) {
    const filepath = path.join(RULES_DIR, f);
    try {
      rules[f.replace(".md", "")] = fs.readFileSync(filepath, "utf-8");
    } catch {
      rules[f.replace(".md", "")] = "";
    }
  }
  return rules;
}

// ===================== 淇¤獕绯荤粺 =====================
function loadReputation() {
  try {
    return JSON.parse(fs.readFileSync(REPUTATION_FILE, "utf-8"));
  } catch {
    return {
      collector: { score: 80, history: [], lastUpdate: null },
      verifier: { score: 80, history: [], lastUpdate: null },
      analyst: { score: 80, history: [], lastUpdate: null },
      editor: { score: 80, history: [], lastUpdate: null },
      "memory-manager": { score: 80, history: [], lastUpdate: null }
    };
  }
}

function saveReputation(reputation) {
  writeFileUTF8(REPUTATION_FILE, JSON.stringify(reputation, null, 2));
}

function updateReputation(agentId, delta, reason, runDate) {
  if (!agentId || !AGENTS.includes(agentId)) { console.log('[warn] updateReputation: invalid agentId=' + agentId); return 80; }
  const rep = loadReputation();
  const entry = rep[agentId];
  if (!entry) { console.log('[warn] updateReputation: no entry for ' + agentId); return 80; }
  const today = runDate || (function() { const now = new Date(); return now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0"); })();
  
  // Remove any existing entry for today (deduplicate)
  const existingIdx = entry.history.findIndex(h => h.date === today);
  if (existingIdx >= 0) {
    // Roll back the previous score adjustment
    const prevDelta = entry.history[existingIdx].delta;
    entry.score = entry.score - prevDelta;
    entry.history.splice(existingIdx, 1);
  }
  
  // Apply new cumulative delta
  entry.score = Math.max(0, Math.min(100, entry.score + delta));
  entry.history.push({ date: today, delta, reason, scoreAfter: entry.score });
  const luNow = new Date(); entry.lastUpdate = luNow.getFullYear() + '-' + String(luNow.getMonth() + 1).padStart(2, '0') + '-' + String(luNow.getDate()).padStart(2, '0') + 'T' + String(luNow.getHours()).padStart(2, '0') + ':' + String(luNow.getMinutes()).padStart(2, '0') + ':' + String(luNow.getSeconds()).padStart(2, '0') + '.000Z';
  if (entry.history.length > 90) entry.history = entry.history.slice(-90);
  saveReputation(rep);
  return entry.score;
}

function getReputationWeight(agentId, baseWeight) {
  const rep = loadReputation();
  const score = rep[agentId]?.score ?? 80;
  const coefficient = 0.5 + (score / 100);
  return baseWeight * coefficient;
}

// ===================== 娑堟伅鎬荤嚎 =====================
let messageCounter = 0;

function createMessage(from, to, type, coreInfo, expectedAction, reason, priority, relatedMsg) {
  messageCounter++;
  const msg = {
    id: `MSG-${from.toUpperCase().slice(0, 3)}-${new Date().toISOString().slice(0, 10)}-${String(messageCounter).padStart(3, "0")}`,
    timestamp: new Date().toISOString(),
    from,
    to: to || "all",
    type,
    coreInfo,
    expectedAction: expectedAction || "",
    reason: reason || "",
    priority: priority || "normal",
    relatedMsg: relatedMsg || null
  };
  return msg;
}

function pushMessage(state, msg) {
  // 鍘婚噸锛氭鏌ユ渶杩?0鏉℃秷鎭腑鏄惁鏈夊畬鍏ㄧ浉鍚?from+type+coreInfo 鐨勬秷鎭?
  var isDup = state.messages.slice(-10).some(function(m) {
    return m.from === msg.from && m.type === msg.type && m.coreInfo === msg.coreInfo;
  });
  if (isDup) {
    return false;
  }
  state.messages.push(msg);
  return true;
}

// ===================== DeepSeek API 璋冪敤锛堝惈鑷姩閲嶈瘯锛?=====================
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

function callDeepSeek(systemPrompt, userPrompt, temperature, maxTokens) {
  return callDeepSeekWithRetry(systemPrompt, userPrompt, temperature || 0.7, maxTokens || 4096);
}

async function callDeepSeekWithRetry(systemPrompt, userPrompt, temperature, maxTokens, maxRetries) {
  if (maxRetries === undefined) maxRetries = 2;
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await new Promise((resolve, reject) => {
        if (!DEEPSEEK_KEY) { reject(new Error("DEEPSEEK_API_KEY 鏈缃?)); return; }
        const body = JSON.stringify({ model: "deepseek-chat", messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ], temperature, max_tokens: maxTokens, stream: false });
        const url = new URL(DEEPSEEK_API);
        const options = {
          hostname: url.hostname, path: url.pathname, method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + DEEPSEEK_KEY,
            "Content-Length": Buffer.byteLength(body)
          }, timeout: 120000
        };
        const req = https.request(options, function(res) {
          var chunks = [];
          res.on("data", function(chunk) { chunks.push(chunk); });
          res.on("end", function() {
            try {
              var data = Buffer.concat(chunks).toString("utf-8");
              var result = JSON.parse(data);
              if (result.choices && result.choices[0]) {
                resolve(result.choices[0].message.content);
              } else if (result.error) {
                reject(new Error(result.error.message || "API 閿欒"));
              } else {
                reject(new Error("鏈煡 API 鍝嶅簲鏍煎紡"));
              }
            } catch (e) {
              reject(new Error("瑙ｆ瀽鍝嶅簲澶辫触: " + e.message));
            }
          });
        });
        req.on("error", function(e) { reject(new Error("缃戠粶閿欒: " + e.message)); });
        req.on("timeout", function() { req.destroy(); reject(new Error("璇锋眰瓒呮椂")); });
        req.write(body);
        req.end();
      });
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        var backoff = Math.min(2000 * Math.pow(2, attempt - 1), 16000);
        await delay(backoff);
      }
    }
  }
  throw lastError;
}
// ===================== 鍔犺浇 Prompt =====================
function loadPrompt(agentId) {
  const filepath = path.join(PROMPTS_DIR, `${agentId}.md`);
  return fs.readFileSync(filepath, "utf-8");
}

// ===================== 瑙勫垯鐗堟湰鍙风敓鎴?=====================
function generateRuleVersion(dateStr) {
  const d = new Date(dateStr);
  const startYear = 2026;
  const startMonth = 1;
  const totalMonths = (d.getFullYear() - startYear) * 12 + (d.getMonth() + 1 - startMonth);
  const halfYear = Math.floor(totalMonths / 6) + 1;
  const monthInHalf = (totalMonths % 6) + 1;
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return `V${halfYear}.${monthInHalf}.${weekNum}`;
}

// ===================== 鎻愬彇 JSON =====================
function extractJSON(text) {
  if (!text || typeof text !== "string") {
    return { _parse_failed: true, raw_output: "", actions: [], messages: [], internal_thought: "" };
  }
  function tryParse(str) {
    try { return JSON.parse(str); } catch (e) { /* continue */ }
    try {
      var fixed2 = str.replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(fixed2);
    } catch (e) { /* continue */ }
    try {
      var fixed3 = str
        .replace(/,(\s*[}\]])/g, "$1")
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
        .replace(/\\(?![\\\/bfnrtu"])/g, "\\\\");
      return JSON.parse(fixed3);
    } catch (e) { /* continue */ }
    try {
      var fixed4 = str
        .replace(/'/g, '"')
        .replace(/([{,]\s*)(\w+)(\s*:)/g, '$1"$2"$3')
        .replace(/,(\s*[}\]])/g, "$1");
      return JSON.parse(fixed4);
    } catch (e) { /* continue */ }
    return null;
  }
  var blockMatch = text.match(/```(?:json)\s*([\s\S]*?)```/);
  if (blockMatch) {
    var result = tryParse(blockMatch[1].trim());
    if (result) return result;
  }
  var anyBlock = text.match(/```\s*([\s\S]*?)```/);
  if (anyBlock && anyBlock[1].indexOf("{") !== -1) {
    var result2 = tryParse(anyBlock[1].trim());
    if (result2) return result2;
  }
  var firstBrace = text.indexOf("{");
  var lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    var jsonCandidate = text.slice(firstBrace, lastBrace + 1);
    var result3 = tryParse(jsonCandidate);
    if (result3) return result3;
  }
  var cleanText = text.replace(/^#+\s*/gm, "").replace(/\*{1,2}/g, "").replace(/`/g, "").trim();
  var cb = cleanText.indexOf("{");
  var ce = cleanText.lastIndexOf("}");
  if (cb !== -1 && ce > cb) {
    var result4 = tryParse(cleanText.slice(cb, ce + 1));
    if (result4) return result4;
  }
  return {
    _parse_failed: true,
    raw_output: text.slice(0, 3000),
    actions: [],
    messages: [],
    internal_thought: text.slice(0, 300)
  };
}

function logg(agent, message) {
  const name = AGENT_NAMES_CN[agent] || agent;
  console.log(`[${name}] ${message}`);
}

module.exports = {
  DEEPSEEK_KEY, DEEPSEEK_API,
  ROOT_DIR, OUTPUT_DIR, LOGS_DIR, WEEKLY_DIR, RULES_DIR, PROMPTS_DIR,
  MSG_TYPES, AGENTS, AGENT_NAMES_CN,
  createInitialState, loadCurrentRules,
  loadReputation, saveReputation, updateReputation, getReputationWeight,
  createMessage,
  pushMessage,
  callDeepSeek,
  loadPrompt,
  generateRuleVersion, extractJSON,
  log: logg
};
function writeFileUTF8(filepath, content) {
  // Normalize to LF and strip BOM
  var cleanContent = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (cleanContent.charCodeAt(0) === 0xFEFF) cleanContent = cleanContent.slice(1);
  fs.writeFileSync(filepath, cleanContent, { encoding: "utf-8", flag: "w" });
  var buf = fs.readFileSync(filepath);
  if (buf.length >= 3 && buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF) {
    fs.writeFileSync(filepath, buf.slice(3));
  }
}

