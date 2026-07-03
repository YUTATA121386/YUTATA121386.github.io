const https = require("https");
const fs = require("fs");
const KEY = process.env.DEEPSEEK_API_KEY;

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
  "鏈懆璁板繂绠＄悊甯堝伐浣滃疄褰曪細",
  "- 5杞Agent鍗氬紙锛屼粠绱犳潗閲囬泦鍒版棩鎶ュ畾绋垮叏绋嬪崗璋?,
  "- 閲囬泦甯堝ぇ閲忔彁浜ら潪闊充箰绱犳潗锛?6姘硾绉戞妧锛夛紝鏍告煡甯堟嫆缁濈巼杈?5-100%",
  "- 绠＄悊甯堝紩鍏?6姘叧閿瘝杩囨护瑙勫垯锛岄棶棰樺緱鍒拌В鍐?,
  "- 绠＄悊甯堟柊澧炶繛缁嫆缁濆崌绾у崗璁拰鑷閲忓寲鏍囧噯",
  "- 淇閲囬泦瑙勫垯銆佹牳鏌ヨ鍒欍€佹帓鐗堣鑼冨叡3鏉?,
  "- 缂栬緫甯堣皟鏁存棩鎶ョ粨鏋勬椂锛岀鐞嗗笀浠嬪叆骞舵墸3鍒?,
  "- 鎺ㄥ姩瀹＄娴佺▼锛氬洓涓鑹插鏃ユ姤鑽夌杩涜鍙嶉",
  "- 鏈€缁堟棩鎶ヨ川閲忎粠鐏鹃毦閫嗚浆涓哄彲鍦堝彲鐐?
].join("\n");

const evals = [
  {
    id: "collector",
    role: "閲囬泦甯?,
    sys: "浣犳槸閲囬泦甯堛€傛€ф牸婵€杩涖€佸枩娆㈠箍鎾掔綉銆傝鎸変互涓嬩笁涓淮搴︾粰璁板繂绠＄悊甯堟墦鍒嗭紙姣忎釜0-10鍒嗭級锛?,
    dims: [
      "閲囬泦鑷敱搴︼細鏄惁缁欎簣瓒冲鐨勯噰闆嗙┖闂达紵杩囧害闄愬埗鎵ｅ垎",
      "瑙勫垯鍚堢悊鎬э細鍒跺畾鐨勮繃婊よ鍒欐槸鍚︾簿鍑嗘湁鏁堬紵璇潃濂界礌鏉愭墸鍒?,
      "娌熼€氭晥鐜囷細鎷掔粷/鍙嶉鏄惁鍙婃椂娓呮櫚锛熷惈绯婁笉娓呮墸鍒?
    ]
  },
  {
    id: "verifier",
    role: "鏍告煡甯?,
    sys: "浣犳槸鏍告煡甯堛€傛€ф牸淇濆畧銆佸畞缂烘瘚婊ャ€傝鎸変互涓嬩笁涓淮搴︾粰璁板繂绠＄悊甯堟墦鍒嗭紙姣忎釜0-10鍒嗭級锛?,
    dims: [
      "鏍囧噯鏀寔搴︼細鏄惁鍏呭垎鏀寔鎴戠殑鏍告煡鍒ゆ柇锛熻交鏄撴帹缈绘垜鐨勬嫆缁濇墸鍒?,
      "鍙嶉缁撴瀯鍖栵細瑕佹眰鐨勫弽棣堟牸寮忔槸鍚﹀悎鐞嗭紵澧炲姞涓嶅繀瑕佸伐浣滈噺鎵ｅ垎",
      "淇′换搴︼細鏄惁淇′换鎴戠殑涓撲笟鍒ゆ柇锛熼绻佽川鐤戞墸鍒?
    ]
  },
  {
    id: "analyst",
    role: "鍒嗘瀽甯?,
    sys: "浣犳槸鍒嗘瀽甯堛€傝拷姹傛繁搴︺€侀渶瑕佹椂闂淬€傝鎸変互涓嬩笁涓淮搴︾粰璁板繂绠＄悊甯堟墦鍒嗭紙姣忎釜0-10鍒嗭級锛?,
    dims: [
      "鍒嗘瀽鏃堕棿鍏呰冻搴︼細鏄惁缁欐垜瓒冲鐨勬繁搴﹀垎鏋愭椂闂达紵鍌績瀹氱鎵ｅ垎",
      "琛ラ噰鏀寔搴︼細鏄惁鏀寔鎴戣姹傝ˉ閲囩礌鏉愶紵鎷掔粷鍚堢悊琛ラ噰鎵ｅ垎",
      "娣卞害浼樺厛搴︼細鏄惁鍦ㄦ繁搴﹀拰閫熷害涔嬮棿鍋氫簡姝ｇ‘鏉冭　锛熶负璧惰繘搴︾壓鐗叉繁搴︽墸鍒?
    ]
  },
  {
    id: "editor",
    role: "缂栬緫甯?,
    sys: "浣犳槸缂栬緫甯堛€傞噸瑙嗘帓鐗堣嚜鐢卞拰瀹＄編銆傝鎸変互涓嬩笁涓淮搴︾粰璁板繂绠＄悊甯堟墦鍒嗭紙姣忎釜0-10鍒嗭級锛?,
    dims: [
      "缂栬緫鑷富鏉冿細鏄惁灏婇噸鎴戠殑鎺掔増鍜岀粨鏋勮皟鏁达紵杩囧害骞查鎵ｅ垎",
      "娴佺▼椤虹晠搴︼細瀹＄娴佺▼鏄惁椤虹晠楂樻晥锛熸祦绋嬪崱椤挎墸鍒?,
      "骞查鍚堢悊鎬э細骞查鏃舵満鍜屾柟寮忔槸鍚﹀悎鐞嗭紵涓嶅垎杞婚噸鎵ｅ垎"
    ]
  }
];

async function runEvals() {
  const allScores = {};
  
  for (const e of evals) {
    const dimList = e.dims.map((d, i) => (i+1) + ". " + d).join("\n");
    const prompt = weekSummary + "\n\n" + e.sys + "\n" + dimList + "\n\n瀵规瘡涓淮搴︽墦鍒嗗苟鍚勫啓涓€鍙ヨ瘎浠枫€傚彧杈撳嚭JSON:\n{\"dims\":[{\"name\":\"缁村害鍚峔",\"score\":N,\"comment\":\"璇勪环\"}],\"overall\":N,\"summary\":\"涓€鍙ヨ瘽鎬昏瘎\"}";
    
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
  console.log("\n=== 璁板繂绠＄悊甯堣京璇佸鐩?===\n");
  
  const feedbackSummary = evals.map(e => {
    const s = allScores[e.id];
    if (!s) return "";
    return e.role + " (" + (s.overall||"?") + "/10): " + (s.summary||"") + "\n鎵硅瘎鐐? " + (s.dims||[]).filter(d=>d.score<8).map(d=>d.name+":"+d.comment).join("; ");
  }).join("\n\n");
  
  const mmSys = "浣犳槸璁板繂绠＄悊甯堛€備綘鐨勮亴璐ｆ槸澶嶇洏鍙嶆€濓紝浣嗕笉鏄竴鍛虫帴鍙楁壒璇勨€斺€斾綘闇€瑕佽京璇佹€濊€冿細鍝簺鎵硅瘎鍚堢悊銆佸摢浜涜鐐逛綘涓嶅悓鎰忋€佷负浠€涔堛€備綘闇€瑕佺淮鎶よ嚜宸辩殑鍒ゆ柇鍚屾椂铏氬績鏀硅繘銆?;
  const mmPrompt = "鏀跺埌浠ヤ笅鍙嶉锛歕n\n" + feedbackSummary + "\n\n璇峰姣忔潯鎵硅瘎杩涜杈╄瘉鍥炲簲锛堟帴鍙?閮ㄥ垎鎺ュ彈/鍙嶉┏锛屽悇50瀛楀唴锛夛紝鐒跺悗缁欏嚭浣犵殑涓嬪懆鏀硅繘璁″垝锛?鏉★級銆俓n鍙緭鍑篔SON: {\"responses\":[{\"from\":\"瑙掕壊鍚峔",\"verdict\":\"鎺ュ彈鎴栭儴鍒嗘帴鍙楁垨鍙嶉┏\",\"reply\":\"浣犵殑鍥炲簲\"}],\"improvements\":[\"鏀硅繘1\",\"鏀硅繘2\",\"鏀硅繘3\"]}";
  
  try {
    const mmResp = await askDeepSeek(mmSys, mmPrompt);
    console.log("绠＄悊甯堝洖搴? " + mmResp.substring(0, 300));
    const match = mmResp.match(/\{[\s\S]*\}/);
    if (match) {
      allScores["memory-manager"] = JSON.parse(match[0]);
    }
  } catch(err) {
    console.log("绠＄悊甯堝洖搴斿け璐? " + err.message);
  }
  
  fs.writeFileSync("C:/Users/beppi/Documents/Codex/YUTATA121386.github.io/scripts/mm-scores.json", JSON.stringify(allScores, null, 2), "utf-8");
  console.log("\nFinal scores saved");
  return allScores;
}

runEvals().then(scores => {
  console.log("\n=== 璇勫垎姹囨€?===");
  const evals2 = ["collector","verifier","analyst","editor"];
  evals2.forEach(id => {
    const s = scores[id];
    if (s) console.log(id + ": " + s.overall + "/10 - " + (s.summary||""));
  });
}).catch(console.error);
