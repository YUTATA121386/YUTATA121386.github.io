/**
 * 多 Agent 日报系统 - 共享模块
 * 状态管理、消息总线、信誉系统、DeepSeek API 调用
 */

const fs = require("fs");
const path = require("path");
const https = require("https");

// ===================== 配置 =====================
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";
const ROOT_DIR = path.join(__dirname, "..", "..");
const OUTPUT_DIR = path.join(ROOT_DIR, "docs", "daily");
const LOGS_DIR = path.join(ROOT_DIR, "docs", "logs");
const WEEKLY_DIR = path.join(ROOT_DIR, "docs", "weekly");
const RULES_DIR = path.join(ROOT_DIR, "docs", "rules");
const PROMPTS_DIR = path.join(__dirname, "..", "prompts");
const REPUTATION_FILE = path.join(ROOT_DIR, "scripts", "reputation.json");

// ===================== 消息协议 =====================
const MSG_TYPES = ["REJECT", "REQUEST", "DISPUTE", "NOTIFY", "ESCALATE", "CONFIRM", "PRIORITY_OVERRIDE", "COMMAND", "DIRECTIVE", "APPROVE", "GUIDANCE", "INQUIRE", "INFO"];
const AGENTS = ["collector", "verifier", "analyst", "editor", "memory-manager"];
const AGENT_NAMES_CN = {
  collector: "采集师",
  verifier: "核查师",
  analyst: "分析师",
  editor: "编辑师",
  "memory-manager": "记忆管理师"
};

// ===================== 状态管理 =====================
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
  const ruleFiles = ["collection-rules.md", "verification-rules.md", "style-guide.md"];
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

// ===================== 信誉系统 =====================
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

function updateReputation(agentId, delta, reason) {
  if (!agentId || !AGENTS.includes(agentId)) { console.log('[warn] updateReputation: invalid agentId=' + agentId); return 80; }
  const rep = loadReputation();
  const entry = rep[agentId];
  if (!entry) { console.log('[warn] updateReputation: no entry for ' + agentId); return 80; }
  const now = new Date(); const today = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  
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

// ===================== 消息总线 =====================
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
  // 去重：检查最近10条消息中是否有完全相同 from+type+coreInfo 的消息
  var isDup = state.messages.slice(-10).some(function(m) {
    return m.from === msg.from && m.type === msg.type && m.coreInfo === msg.coreInfo;
  });
  if (isDup) {
    return false;
  }
  state.messages.push(msg);
  return true;
}

// ===================== DeepSeek API 调用（含自动重试） =====================
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
        if (!DEEPSEEK_KEY) { reject(new Error("DEEPSEEK_API_KEY 未设置")); return; }
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
                reject(new Error(result.error.message || "API 错误"));
              } else {
                reject(new Error("未知 API 响应格式"));
              }
            } catch (e) {
              reject(new Error("解析响应失败: " + e.message));
            }
          });
        });
        req.on("error", function(e) { reject(new Error("网络错误: " + e.message)); });
        req.on("timeout", function() { req.destroy(); reject(new Error("请求超时")); });
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
// ===================== 加载 Prompt =====================
function loadPrompt(agentId) {
  const filepath = path.join(PROMPTS_DIR, `${agentId}.md`);
  return fs.readFileSync(filepath, "utf-8");
}

// ===================== 规则版本号生成 =====================
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

// ===================== 提取 JSON =====================
function extractJSON(text) {
  // Try ```json ... ``` block
  const blockMatch = text.match(/```json\s*([\s\S]*?)```/);
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1]); } catch (e) {
      // Try fixing common issues: unescaped quotes, trailing commas
      try {
        let fixed = blockMatch[1].replace(/,(\s*[}\]])/g, "$1");
        return JSON.parse(fixed);
      } catch {}
    }
  }
  // Try ``` ... ``` (no language tag)
  const anyBlock = text.match(/```\s*([\s\S]*?)```/);
  if (anyBlock && anyBlock[1].includes("{")) {
    try { return JSON.parse(anyBlock[1]); } catch {}
  }
  // Try raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch (e) {
      // Fix trailing commas
      try {
        let fixed = jsonMatch[0].replace(/,(\s*[}\]])/g, "$1");
        return JSON.parse(fixed);
      } catch {}
    }
  }
  // If nothing worked, return a minimal fallback with the raw text
  return {
    _parse_failed: true,
    raw_output: text.slice(0, 2000),
    actions: [],
    messages: [],
    internal_thought: text.slice(0, 200)
  };
}

// ===================== 日志记录 =====================
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

