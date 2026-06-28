const https = require("https");
const fs = require("fs");
const KEY = "sk-42aa5182bbf94e568e2297dee0f8ad67";

function askDeepSeek(sys, user) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ],
      temperature: 0.7,
      max_tokens: 300
    });
    const req = https.request({
      hostname: "api.deepseek.com", path: "/chat/completions", method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + KEY },
      timeout: 30000
    }, (res) => {
      let chunks = [];
      res.on("data", c => chunks.push(c));
      res.on("end", () => {
        try {
          const r = JSON.parse(Buffer.concat(chunks).toString("utf-8"));
          resolve(r.choices[0].message.content.trim());
        } catch(e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.write(body); req.end();
  });
}

const weekSummary = [
  "本周记忆管理师工作实录：",
  "- 5轮多Agent博弈，从素材采集到日报定稿全程协调",
  "- 采集师大量提交非音乐素材（36氪泛科技），核查师拒绝率达75-100%",
  "- 管理师引入36氪关键词过滤规则，问题得到解决",
  "- 管理师新增连续拒绝升级协议和自检量化标准",
  "- 修正采集规则、核查规则、排版规范共3条",
  "- 编辑师调整日报结构时，管理师介入并扣3分",
  "- 推动审稿流程：四个角色对日报草稿进行反馈",
  "- 最终日报质量从灾难逆转为可圈可点"
].join("\n");

const evals = [
  {
    id: "collector",
    role: "采集师",
    sys: "你是采集师。性格激进、喜欢广撒网。请按以下三个维度给记忆管理师打分（每个0-10分）：",
    dims: [
      "采集自由度：是否给予足够的采集空间？过度限制扣分",
      "规则合理性：制定的过滤规则是否精准有效？误杀好素材扣分",
      "沟通效率：拒绝/反馈是否及时清晰？含糊不清扣分"
    ]
  },
  {
    id: "verifier",
    role: "核查师",
    sys: "你是核查师。性格保守、宁缺毋滥。请按以下三个维度给记忆管理师打分（每个0-10分）：",
    dims: [
      "标准支持度：是否充分支持我的核查判断？轻易推翻我的拒绝扣分",
      "反馈结构化：要求的反馈格式是否合理？增加不必要工作量扣分",
      "信任度：是否信任我的专业判断？频繁质疑扣分"
    ]
  },
  {
    id: "analyst",
    role: "分析师",
    sys: "你是分析师。追求深度、需要时间。请按以下三个维度给记忆管理师打分（每个0-10分）：",
    dims: [
      "分析时间充足度：是否给我足够的深度分析时间？催促定稿扣分",
      "补采支持度：是否支持我要求补采素材？拒绝合理补采扣分",
      "深度优先度：是否在深度和速度之间做了正确权衡？为赶进度牺牲深度扣分"
    ]
  },
  {
    id: "editor",
    role: "编辑师",
    sys: "你是编辑师。重视排版自由和审美。请按以下三个维度给记忆管理师打分（每个0-10分）：",
    dims: [
      "编辑自主权：是否尊重我的排版和结构调整？过度干预扣分",
      "流程顺畅度：审稿流程是否顺畅高效？流程卡顿扣分",
      "干预合理性：干预时机和方式是否合理？不分轻重扣分"
    ]
  }
];

async function runEvals() {
  const allScores = {};
  
  for (const e of evals) {
    const dimList = e.dims.map((d, i) => (i+1) + ". " + d).join("\n");
    const prompt = weekSummary + "\n\n" + e.sys + "\n" + dimList + "\n\n对每个维度打分并各写一句评价。只输出JSON:\n{\"dims\":[{\"name\":\"维度名\",\"score\":N,\"comment\":\"评价\"}],\"overall\":N,\"summary\":\"一句话总评\"}";
    
    try {
      const resp = await askDeepSeek(e.sys, prompt);
      console.log(e.role + ": " + resp.substring(0, 200));
      const match = resp.match(/\{[\s\S]*\}/);
      if (match) {
        const obj = JSON.parse(match[0]);
        allScores[e.id] = obj;
        console.log("  Overall: " + obj.overall + "/10, Dims: " + (obj.dims||[]).map(d=>d.name+":"+d.score).join(", "));
      }
    } catch(err) {
      console.log(e.role + ": FAIL - " + err.message);
    }
  }
  
  // Now have memory manager respond
  console.log("\n=== 记忆管理师辩证复盘 ===\n");
  
  const feedbackSummary = evals.map(e => {
    const s = allScores[e.id];
    if (!s) return "";
    return e.role + " (" + (s.overall||"?") + "/10): " + (s.summary||"") + "\n批评点: " + (s.dims||[]).filter(d=>d.score<8).map(d=>d.name+":"+d.comment).join("; ");
  }).join("\n\n");
  
  const mmSys = "你是记忆管理师。你的职责是复盘反思，但不是一味接受批评——你需要辩证思考：哪些批评合理、哪些观点你不同意、为什么。你需要维护自己的判断同时虚心改进。";
  const mmPrompt = "收到以下反馈：\n\n" + feedbackSummary + "\n\n请对每条批评进行辩证回应（接受/部分接受/反驳，各50字内），然后给出你的下周改进计划（3条）。\n只输出JSON: {\"responses\":[{\"from\":\"角色名\",\"verdict\":\"接受或部分接受或反驳\",\"reply\":\"你的回应\"}],\"improvements\":[\"改进1\",\"改进2\",\"改进3\"]}";
  
  try {
    const mmResp = await askDeepSeek(mmSys, mmPrompt);
    console.log("管理师回应: " + mmResp.substring(0, 300));
    const match = mmResp.match(/\{[\s\S]*\}/);
    if (match) {
      allScores["memory-manager"] = JSON.parse(match[0]);
    }
  } catch(err) {
    console.log("管理师回应失败: " + err.message);
  }
  
  fs.writeFileSync("C:/Users/beppi/Documents/Codex/YUTATA121386.github.io/scripts/mm-scores.json", JSON.stringify(allScores, null, 2), "utf-8");
  console.log("\nFinal scores saved");
  return allScores;
}

runEvals().then(scores => {
  console.log("\n=== 评分汇总 ===");
  const evals2 = ["collector","verifier","analyst","editor"];
  evals2.forEach(id => {
    const s = scores[id];
    if (s) console.log(id + ": " + s.overall + "/10 - " + (s.summary||""));
  });
}).catch(console.error);
