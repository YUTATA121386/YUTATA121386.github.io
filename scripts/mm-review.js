const https = require("https");
const fs = require("fs");
const KEY = "REMOVED";

function askDeepSeek(sys, user) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ],
      temperature: 0.8,
      max_tokens: 200
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

const summary = [
  "本周记忆管理师工作实录：",
  "- 5轮多Agent博弈，从素材采集到日报定稿全程协调",
  "- 采集师大量提交非音乐素材（36氪泛科技），核查师拒绝率达75-100%",
  "- 管理师引入36氪关键词过滤规则，问题得到解决",
  "- 管理师新增连续拒绝升级协议和自检量化标准",
  "- 修正采集规则、核查规则、排版规范共3条",
  "- 编辑师擅自调整日报结构时，管理师介入并扣3分",
  "- 推动审稿流程：四个角色对日报草稿进行反馈",
  "- 最终日报质量从灾难逆转为可圈可点"
].join("\n");

async function main() {
  const evals = [
    {
      id: "collector",
      role: "采集师",
      sys: "你是采集师。性格激进、喜欢广撒网，最烦别人拦你采集。本周管理师多次限制你的采集范围，你觉得他管太宽了，但也承认他帮你筛掉了真正的垃圾，让你后期的素材质量大幅提升。"
    },
    {
      id: "verifier",
      role: "核查师",
      sys: "你是核查师。性格保守、怀疑一切，宁缺毋滥。本周管理师在你批量拒绝采集师素材后，反而要求你提供更具体的拒绝分类和结构化反馈。你觉得他在质疑你的判断，但也承认这确实让采集师更容易理解你的标准。"
    },
    {
      id: "analyst",
      role: "分析师",
      sys: "你是分析师。追求深度、讨厌被打断。本周管理师在你还在做分析时就推动编辑定稿，你觉得深度被牺牲了。但他安排的补采流程帮你拿到了Suno艺术家反应等关键素材。"
    },
    {
      id: "editor",
      role: "编辑师",
      sys: "你是编辑师。重视排版结构，讨厌流程干预。本周你调整日报结构时被管理师扣了3分，你觉得这是合理的编辑判断，不该被罚。但审稿机制确实减少了你的返工次数。"
    }
  ];

  const scores = {};
  for (const e of evals) {
    try {
      const resp = await askDeepSeek(e.sys, summary + "\n\n你是" + e.role + "。给记忆管理师打分(0-10)，说出1个优点和1个批评。只输出JSON: {\"score\":N,\"good\":\"优点\",\"bad\":\"批评\"}");
      console.log(e.role + ": " + resp.substring(0, 180));
      const match = resp.match(/\{[\s\S]*\}/);
      if (match) {
        const obj = JSON.parse(match[0]);
        scores[e.id] = { score: obj.score, good: obj.good || "", bad: obj.bad || "" };
      }
    } catch(err) {
      console.log(e.role + ": FAIL - " + err.message);
    }
  }

  fs.writeFileSync(__dirname + "/mm-scores.json", JSON.stringify(scores, null, 2), "utf-8");
  console.log("\nDone: " + JSON.stringify(scores));
}

main().catch(console.error);
