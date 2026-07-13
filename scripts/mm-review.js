/**
 * YUTATA 记忆管理师环评系统
 * 四个角色（采集师/核查师/分析师/编辑师）对记忆管理师进行三维度评分
 * 可作为模块导入，也可独立运行
 */
const https = require("https");
const fs = require("fs");
const path = require("path");
const KEY = process.env.DEEPSEEK_API_KEY;

const ROOT = path.join(__dirname, "..");
const REPUTATION_FILE = path.join(ROOT, "scripts", "reputation.json");
const SYSTEM_MEMORY_FILE = path.join(ROOT, "scripts", "system-memory.json");
const SCORES_FILE = path.join(ROOT, "scripts", "mm-scores.json");

function askDeepSeek(sys, user) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });
    const url = new URL("https://api.deepseek.com/chat/completions");
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + KEY,
        "Content-Length": Buffer.byteLength(body)
      },
      timeout: 60000
    }, (res) => {
      let chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        try {
          const result = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
          if (result.choices && result.choices[0]) {
            resolve(result.choices[0].message.content.trim());
          } else if (result.error) {
            reject(new Error(result.error.message || "API错误"));
          } else {
            reject(new Error("未知响应格式"));
          }
        } catch(e) {
          reject(new Error("解析失败: " + e.message));
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("请求超时")); });
    req.write(body);
    req.end();
  });
}

const AGENTS = [
  {
    id: "collector",
    name: "采集师",
    personality: "性格激进、喜欢广撒网",
    sys: "你是采集师——AI日报团队的信息采集专家。",
    dims: [
      { name: "采集自由度", desc: "是否给予足够的采集空间？过度限制扣分" },
      { name: "规则合理性", desc: "制定的过滤规则是否精准有效？误杀好素材扣分" },
      { name: "沟通效率", desc: "拒绝/反馈是否及时清晰？含糊不清扣分" }
    ]
  },
  {
    id: "verifier",
    name: "核查师",
    personality: "性格保守、宁缺毋滥",
    sys: "你是核查师——AI日报团队的信息质量守门人。",
    dims: [
      { name: "标准支持度", desc: "是否充分支持核查判断？轻易推翻拒绝扣分" },
      { name: "反馈结构化", desc: "要求的反馈格式是否合理？增加不必要工作量扣分" },
      { name: "信任度", desc: "是否信任专业判断？频繁质疑扣分" }
    ]
  },
  {
    id: "analyst",
    name: "分析师",
    personality: "追求深度、需要时间",
    sys: "你是分析师——AI日报团队的信息解读者。",
    dims: [
      { name: "分析时间充足度", desc: "是否给予足够的深度分析时间？催促定稿扣分" },
      { name: "补采支持度", desc: "是否支持要求补采素材？拒绝合理补采扣分" },
      { name: "深度优先度", desc: "是否在深度和速度之间做了正确权衡？为赶进度牺牲深度扣分" }
    ]
  },
  {
    id: "editor",
    name: "编辑师",
    personality: "重视排版自由和审美",
    sys: "你是编辑师——AI日报团队的排版和叙事专家。",
    dims: [
      { name: "编辑自主权", desc: "是否尊重排版和结构调整？过度干预扣分" },
      { name: "流程顺畅度", desc: "审稿流程是否顺畅高效？流程卡顿扣分" },
      { name: "干预合理性", desc: "干预时机和方式是否合理？不分轻重扣分" }
    ]
  }
];

function loadReputation() {
  try { return JSON.parse(fs.readFileSync(REPUTATION_FILE, "utf-8")); }
  catch { return {}; }
}

function loadSystemMemory() {
  try { return JSON.parse(fs.readFileSync(SYSTEM_MEMORY_FILE, "utf-8")); }
  catch { return { entries: [] }; }
}

function buildWeekSummary() {
  const mem = loadSystemMemory();
  const rep = loadReputation();
  const entries = mem.entries || [];
  const last = entries.length > 0 ? entries[entries.length - 1] : null;
  
  const mmScore = rep["memory-manager"] ? rep["memory-manager"].score : 80;
  let summary = "本周记忆管理师工作实录：";
  summary += "\n- 当前信誉分: " + mmScore;
  summary += "\n- 系统已运行 " + entries.length + " 天";
  
  if (last) {
    if (last.weaknesses && last.weaknesses.length > 0) {
      summary += "\n- 本周弱点: " + last.weaknesses.slice(0, 2).join("; ");
    }
    if (last.rootCause) {
      summary += "\n- 根因分析: " + last.rootCause;
    }
    if (last.ruleChanges > 0) {
      summary += "\n- 规则变更: " + last.ruleChanges + " 条";
    }
    if (last.learnings) {
      summary += "\n- 经验总结: " + last.learnings.slice(0, 200);
    }
  }
  
  return summary;
}

async function runEvals() {
  if (!KEY) { throw new Error("DEEPSEEK_API_KEY 未设置"); }
  
  const allScores = {};
  const weekSummary = buildWeekSummary();
  
  for (const agent of AGENTS) {
    const dimList = agent.dims.map((d, i) => (i + 1) + ". " + d.name + "：" + d.desc).join("\n");
    const prompt = [
      "## 本周工作背景",
      weekSummary,
      "",
      "## 评价任务",
      "你是" + agent.name + "，" + agent.personality + "。",
      "请从以下三个维度给记忆管理师打分（每个0-10分）：",
      dimList,
      "",
      '只输出JSON，不要其他内容：',
      JSON.stringify({
        dims: agent.dims.map(d => ({ name: d.name, score: 0, comment: "你的评价" })),
        overall: 0,
        summary: "一句话总评"
      })
    ].join("\n");
    
    try {
      const resp = await askDeepSeek(agent.sys, prompt);
      console.log(agent.name + " 评价完成");
      const match = resp.match(/\{[\s\S]*\}/);
      if (match) {
        let obj = null;
        // Try standard parse first
        try {
          obj = JSON.parse(match[0]);
        } catch (parseErr) {
          // Auto-repair: try stripping invisible chars and common issues
          try {
            const cleaned = match[0].replace(/[\u0000-\u001F\u007F-\u009F]/g, '').replace(/\r?\n/g, ' ').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
            // Fix missing closing ] for array if a string property follows the last array element
            const cleaned2 = cleaned.replace(/\}(["'\x60]\s*[,:]\s*["'\x60])/g, '}]$1');
            obj = JSON.parse(cleaned2);
          } catch (e2) {
            // Try fixing unbalanced brackets: count opens vs closes
            try {
              let fixed = match[0];
              let opens = (fixed.match(/\{/g) || []).length;
              let closes = (fixed.match(/\}/g) || []).length;
              let arrayOpens = (fixed.match(/\[/g) || []).length;
              let arrayCloses = (fixed.match(/\]/g) || []).length;
              while (opens > closes) { fixed += '}'; closes++; }
              while (arrayOpens > arrayCloses) { fixed += ']'; arrayCloses++; }
              fixed = fixed.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').replace(/\r?\n/g, ' ').replace(/,\s*}/g, '}').replace(/,\s*\]/g, ']');
              obj = JSON.parse(fixed);
            } catch (e3) {
              console.log("  解析失败，保存原始响应");
              allScores[agent.id] = { _raw: resp.slice(0, 2000), dims: [], overall: 0, summary: "" };
            }
          }
        }
        if (obj) {
          allScores[agent.id] = obj;
          console.log("  综合: " + obj.overall + "/10");
          if (obj.dims) {
            obj.dims.forEach(function(d) { console.log("  " + d.name + ": " + d.score); });
          }
        }
      }
    } catch(err) {
      console.log(agent.name + " 失败: " + err.message);
    }
  }
  
  // Memory manager responds
  console.log("\n=== 记忆管理师辩证复盘 ===\n");
  
  const feedbackLines = [];
  for (const agent of AGENTS) {
    const s = allScores[agent.id];
    if (!s) continue;
    const dimComments = (s.dims || []).filter(function(d) { return d.score < 8; })
      .map(function(d) { return d.name + "(" + d.score + "):" + (d.comment || ""); }).join("; ");
    feedbackLines.push(agent.name + " (" + (s.overall || "?") + "/10): " + (s.summary || ""));
    if (dimComments) feedbackLines.push("  批评点: " + dimComments);
  }
  
  const mmPrompt = [
    "收到以下反馈：\n",
    feedbackLines.join("\n\n"),
    "",
    "请对每条批评进行辩证回应（接受/部分接受/反驳，各50字内），然后给出下周改进计划（3条）。",
    '只输出JSON：{"responses":[{"from":"角色名","verdict":"接受或部分接受或反驳","reply":"你的回应"}],"improvements":["改进1","改进2","改进3"]}'
  ].join("\n");
  
  const mmSys = "你是记忆管理师。你的职责是复盘反思，但不是一味接受批评——你需要辩证思考：哪些批评合理、哪些观点你不同意、为什么。你需要维护自己的判断同时虚心改进。";
  
  try {
    const mmResp = await askDeepSeek(mmSys, mmPrompt);
    console.log("记忆管理师回应完成");
    const match = mmResp.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        allScores["memory-manager"] = JSON.parse(match[0]);
      } catch (e) {
        allScores["memory-manager"] = { responses: [], improvements: [], _raw: mmResp.slice(0, 500) };
      }
    }
  } catch(err) {
    console.log("记忆管理师回应失败: " + err.message);
  }
  
  fs.writeFileSync(SCORES_FILE, JSON.stringify(allScores, null, 2), "utf-8");
  console.log("\n环评结果已保存至 mm-scores.json");
  return allScores;
}

// 独立运行时直接执行
if (require.main === module) {
  runEvals().then(function(scores) {
    console.log("\n=== 评分汇总 ===");
    AGENTS.forEach(function(a) {
      const s = scores[a.id];
      if (s) console.log(a.name + ": " + (s.overall || "?") + "/10 - " + (s.summary || ""));
    });
  }).catch(function(err) {
    console.error("环评失败:", err.message);
    process.exit(1);
  });
}

module.exports = { runEvals, AGENTS };
