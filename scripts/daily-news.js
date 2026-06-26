#!/usr/bin/env node

/**
 * YUTATA 行业雷达 v2 · AI 驱动版
 * 
 * 1. 多源 RSS 采集 (中英文)
 * 2. 全文抓取 + 关键词深度过滤
 * 3. DeepSeek AI 生成结构化中文行业报告
 * 4. 自动更新日报索引页
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ===================== 配置 =====================
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";
const OUTPUT_DIR = path.join(__dirname, "..", "docs", "daily");
const MAX_FULLTEXT = 3;      // 最多抓取全文的篇数
const MAX_PER_SOURCE = 15;
const DAYS_BACK = 1;
// ===================== 前置检查 =====================
if (!DEEPSEEK_KEY || DEEPSEEK_KEY === "") {
  console.error("❌ 错误: DEEPSEEK_API_KEY 环境变量未设置!");
  console.error("   请在 GitHub Repo → Settings → Secrets → Actions 添加 DEEPSEEK_API_KEY");
  console.error("   或在本地运行时通过环境变量传入");
  process.exit(1);
}


// ===================== RSS 源 =====================
const SOURCES = [
  // --- 英文源 ---
  { name: "Music Business Worldwide", url: "https://www.musicbusinessworldwide.com/feed/", lang: "en", weight: 10 },
  { name: "Billboard", url: "https://www.billboard.com/feed/", lang: "en", weight: 8 },
  { name: "Digital Music News", url: "https://www.digitalmusicnews.com/feed/", lang: "en", weight: 8 },
  { name: "Music Ally", url: "https://musically.com/feed/", lang: "en", weight: 9 },
  { name: "Hypebot", url: "https://hypebot.com/feed/", lang: "en", weight: 7 },
  { name: "MusicTech", url: "https://musictech.com/feed/", lang: "en", weight: 6 },
  { name: "Synchblog", url: "https://www.synchtank.com/blog/feed/", lang: "en", weight: 6 },
  { name: "Complete Music Update", url: "https://completemusicupdate.com/feed/", lang: "en", weight: 6 },
  // --- 中文源 ---
  { name: "36氪", url: "https://36kr.com/feed", lang: "zh", weight: 7 },
  { name: "Google News 音乐产业", url: "https://news.google.com/rss/search?q=音乐版权+音乐平台+AI音乐+曲库+流媒体+音乐发行&hl=zh-CN&gl=CN&ceid=CN:zh-Hans", lang: "zh", weight: 8 },
  { name: "Google News Music Industry", url: "https://news.google.com/rss/search?q=music+copyright+streaming+royalties+AI+music+DDEX+ISRC&hl=en-US&gl=US&ceid=US:en", lang: "en", weight: 7 },
  // --- 国内深度源 ---
  { name: "音乐财经", url: "https://www.musicbusiness.cn/feed/", lang: "zh", weight: 8 },
  { name: "新音乐产业观察", url: "https://www.takungpao.com.hk/special/music/feed/", lang: "zh", weight: 7 },
  { name: "Google News 音乐版权", url: "https://news.google.com/rss/search?q=音乐版权+DDEX+ISRC+曲库+版税+音乐平台&hl=zh-CN&gl=CN&ceid=CN:zh-Hans", lang: "zh", weight: 9 },
  { name: "Google News 网易云+TME", url: "https://news.google.com/rss/search?q=网易云音乐+QQ音乐+TME+腾讯音乐+汽水音乐&hl=zh-CN&gl=CN&ceid=CN:zh-Hans", lang: "zh", weight: 8 },
  { name: "Google News AI音乐中文", url: "https://news.google.com/rss/search?q=AI音乐+Suno+Udio+音乐生成+人工智能音乐&hl=zh-CN&gl=CN&ceid=CN:zh-Hans", lang: "zh", weight: 8 },
  // --- 社交媒体 ---
  { name: "Reddit Music Industry", url: "https://www.reddit.com/r/musicindustry/.rss", lang: "en", weight: 6 },
  { name: "Reddit WeAreTheMusicMakers", url: "https://www.reddit.com/r/WeAreTheMusicMakers/.rss", lang: "en", weight: 5 },
  // --- 中文综合源 ---
  { name: "知乎每日精选", url: "https://www.zhihu.com/rss", lang: "zh", weight: 5 },
  { name: "知乎热榜", url: "https://rsshub.app/zhihu/hotlist", lang: "zh", weight: 6 },
  { name: "知乎日报", url: "https://rsshub.app/zhihu/daily", lang: "zh", weight: 5 },
  { name: "微博热搜", url: "https://rsshub.app/weibo/search/hot", lang: "zh", weight: 6 },
  { name: "IT之家", url: "https://www.ithome.com/rss/", lang: "zh", weight: 5 },
  { name: "PMCAFF", url: "https://rsshub.app/pmcaff/list/2", lang: "zh", weight: 4 },
  { name: "产品经理", url: "https://www.woshipm.com/feed", lang: "zh", weight: 4 },
  { name: "潮流周刊", url: "https://weekly.tw93.fun/rss.xml", lang: "zh", weight: 4 },
  { name: "大禹治水", url: "https://droidyue.com/atom.xml", lang: "zh", weight: 3 },
  { name: "360博客", url: "https://blogs.360.net/rss.html", lang: "zh", weight: 3 },
  // --- 新闻聚合 ---
  { name: "早报实时", url: "https://plink.anyfeeder.com/zaobao/realtime/china", lang: "zh", weight: 6 },
  { name: "微博热搜(plink)", url: "https://plink.anyfeeder.com/weibo/search/hot", lang: "zh", weight: 6 },
  { name: "新华网", url: "https://plink.anyfeeder.com/newscn/whxw", lang: "zh", weight: 5 },
  { name: "央视新闻", url: "https://plink.anyfeeder.com/weixin/cctvnewscenter", lang: "zh", weight: 5 },
  { name: "中国日报", url: "https://plink.anyfeeder.com/chinadaily/china", lang: "zh", weight: 5 },
  { name: "人民日报", url: "https://plink.anyfeeder.com/people-daily", lang: "zh", weight: 5 },
  { name: "新京报", url: "https://plink.anyfeeder.com/bjnews", lang: "zh", weight: 5 },
  { name: "腾讯新闻", url: "https://plink.anyfeeder.com/qq/news/world", lang: "zh", weight: 5 },
  { name: "人民日报(微信号)", url: "https://plink.anyfeeder.com/weixin/rmrbwx", lang: "zh", weight: 5 },
];

// ===================== 关键词库 (100+) =====================
const KEYWORDS = {
  "音乐版权": [
    "copyright", "licensing", "rights", "publishing", "intellectual property",
    "infringement", "piracy", "unauthorized", "版权", "授权", "侵权", "盗版",
    "词曲著作权", "录音制作权", "邻接权", "集体管理", "音著协", "音集协",
    "ASCAP", "BMI", "SESAC", "PRS", "GEMA", "SACEM", "JASRAC", "KOMCA",
    "The MLC", "Harry Fox", "HFA", "compulsory license", "mechanical license",
    "sync license", "master use", "blanket license", "statutory rate",
    "Music Modernization Act", "MMA", "copyright office", "copyright royalty board"
  ],
  "元数据与标准": [
    "metadata", "DDEX", "Digital Data Exchange", "ERN", "RIN", "MWL",
    "ISRC", "ISWC", "IPI", "ISNI", "UPC", "EAN", "GTIN", "barcode",
    "CWR", "Common Works Registration", "identifier", "元数据", "标识符",
    "taxonomy", "ontology", "tagging", "enrichment", "data quality",
    "data governance", "master data", "MDM", "DDEX standard"
  ],
  "音乐发行": [
    "distribution", "distributor", "DistroKid", "TuneCore", "CD Baby",
    "Believe", "The Orchard", "FUGA", "Amuse", "Ditto", "LANDR", "Symphonic",
    "UnitedMasters", "Stem", "发行", "分发", "aggregator", "DIY distribution",
    "digital delivery", "supply chain", "content delivery"
  ],
  "音乐平台": [
    "Spotify", "Apple Music", "Amazon Music", "YouTube Music", "TikTok",
    "Deezer", "Tidal", "Pandora", "SoundCloud", "Bandcamp", "Audiomack",
    "网易云音乐", "QQ音乐", "汽水音乐", "酷狗", "酷我", "咪咕音乐",
    "TME", "Tencent Music", "NetEase Cloud Music", "Bytedance",
    "streaming", "platform", "DSP", "digital service provider",
    "subscriber", "ARPU", "DAU", "MAU", "churn", "retention", "平台",
    "流媒体", "订阅", "用户增长", "市场份额"
  ],
  "AI音乐": [
    "AI music", "AI generated", "Suno", "Udio", "Aimi", "Boomy", "Mubert",
    "Soundful", "Loudly", "Beatoven", "AIVA", "Amper", "Endel", "Splash",
    "Stable Audio", "MusicLM", "MusicGen", "Riffusion", "generative AI",
    "artificial intelligence music", "AI作曲", "AI生成", "AI歌手",
    "声音克隆", "voice cloning", "AI训练", "training data", "AI版权",
    "text-to-music", "prompt engineering"
  ],
  "曲库治理": [
    "catalog", "library", "ingestion", "curation", "quality", "cleanup",
    "dedup", "governance", "曲库", "资产管理", "治理", "清洗", "去重",
    "补充", "标签", "CMS", "content management", "catalog management",
    "repertoire", "database", "migration", "normalization", "enrichment"
  ],
  "版税结算": [
    "royalty", "mechanical royalty", "performance royalty", "neighboring rights",
    "PRO", "CMO", "SoundExchange", "ICE", "Kobalt", "Songtrust", "AMRA",
    "版税", "结算", "分配", "透明", "blockchain royalty", "smart contract",
    "royalty accounting", "royalty audit", "unmatched", "black box",
    "transparency", "payment", "payout", "reconciliation"
  ],
  "音乐商业": [
    "merger", "acquisition", "M&A", "investment", "funding", "valuation",
    "IPO", "market share", "revenue", "earnings", "quarterly", "annual",
    "融资", "收购", "上市", "估值", "财报", "营收", "利润",
    "catalog acquisition", "music fund", "private equity", "Hipgnosis",
    "Round Hill", "Primary Wave", "Concord", "BMG", "Warner", "Sony", "Universal"
  ],
  "技术前沿": [
    "blockchain music", "NFT music", "Web3 music", "spatial audio", "Dolby Atmos",
    "Sony 360", "hi-res", "lossless", "immersive audio", "区块链", "空间音频",
    "无损", "高解析度", "audio fingerprinting", "content ID", "audio recognition",
    "MIR", "music information retrieval", "recommendation algorithm"
  ],
  "法规政策": [
    "regulation", "legislation", "CRB", "Copyright Royalty Board", "EU Copyright",
    "DMCA", "safe harbor", "Article 17", "Digital Services Act", "DSA",
    "政策", "法规", "监管", "反垄断", "独家版权", "anti-trust", "competition",
    "FTC", "CMA", "European Commission", "investigation", "fine", "lawsuit"
  ]
};

// ===================== 工具函数 =====================

function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, {
      timeout,
      headers: { "User-Agent": "YUTATA-Radar/2.0 (AI-Powered)", "Accept": "application/rss+xml, application/xml, text/xml, */*" }
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        return fetchUrl(new URL(res.headers.location, url).href, timeout).then(resolve).catch(reject);
      }
      if (res.statusCode >= 400) { req.destroy(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function stripHtml(s) {
  return s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'").replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&#038;/g, "&").replace(/&#821[67];/g, "'").replace(/&#8211;/g, "-")
    .replace(/&#8212;/g, "--").replace(/&#8230;/g, "...").replace(/&#160;/g, " ")
    .replace(/\s+/g, " ").trim();
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRegex.exec(xml)) !== null) {
    const block = m[1];
    const title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1] || "";
    const link = (block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || [])[1] || "";
    const desc = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) || [])[1] || "";
    const pubDate = (block.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i) || [])[1]
      || (block.match(/<dc:date>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:date>/i) || [])[1] || "";
    if (title && link) {
      items.push({ title: stripHtml(title), link: link.trim(), description: stripHtml(desc).slice(0, 400), pubDate });
    }
  }
  return items;
}

function isRecent(dateStr, daysBack) {
  if (!dateStr) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  return d >= cutoff;
}

function matchAny(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw.toLowerCase()));
}

function classifyItem(item) {
  const text = item.title + " " + item.description;
  for (const [cat, kws] of Object.entries(KEYWORDS)) {
    if (matchAny(text, kws)) return cat;
  }
  return "其他";
}

// 抓取文章全文 (简单版：取 <article> 或 <body> 的前半部分)
async function fetchArticleText(url) {
  try {
    const html = await fetchUrl(url, 8000);
    let text = html;
    // 尝试提取 article 内容
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) text = articleMatch[1];
    // 去掉 script/style
    text = text.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "");
    text = stripHtml(text);
    return text.slice(0, 4000); // 前4000字符
  } catch {
    return "";
  }
}

// ===================== AI 报告生成 =====================

async function generateReport(dateCN, categorized, fullTexts) {
  // 构建上下文
  let newsContext = "";
  let refIndex = 1;
  const refs = [];

  for (const [cat, items] of Object.entries(categorized)) {
    if (items.length === 0) continue;
    newsContext += `\n## ${cat}\n`;
    for (const item of items.slice(0, 8)) {
      newsContext += `- [${refIndex}] ${item.title}\n  来源: ${item.source}\n  摘要: ${item.description.slice(0, 200)}\n`;
      refs.push({ num: refIndex, title: item.title, link: item.link, source: item.source });
      refIndex++;
    }
  }

  // 加入全文内容（精选几篇）
  let fulltextContext = "";
  if (fullTexts.length > 0) {
    fulltextContext = "\n\n=== 部分文章全文内容（供深度分析） ===\n";
    for (const ft of fullTexts.slice(0, MAX_FULLTEXT)) {
      fulltextContext += `\n[${ft.title}] (${ft.source})\n${ft.text.slice(0, 1000)}\n---\n`;
    }
  }

  const prompt = `你是一位资深音乐产业分析师，请根据以下行业新闻撰写一份中文日报。

## 写作要求

### 1. 口吻
专业但不枯燥，幽默有网感，像朋友聊天但信息密度高。适当使用网络热梗但不过度。敢于表达观点和预判。

### 2. 内容深度（极其重要！）
每一条深度解读必须包含：背景→经过→结果/影响。不能只是标题复述。
- 如果是诉讼：谁告谁、为什么告、索赔多少、目前阶段、行业影响
- 如果是收购：买家/卖家/金额/标的/战略意图
- 如果是技术：解决了什么问题、和现有方案对比、适用场景
- 如果是数据：数字对比、趋势分析、背后的原因
每个小节至少150-300字，让读者看完就能跟同事讲清楚这件事。

### 3. 引用格式（严格遵守！）
- 文中引用使用HTML角标格式：<sup><a href="#ref-编号">[编号]</a></sup>
- 例如：SZA直接在社交媒体上开怼<sup><a href="#ref-19">[19]</a></sup>
- 一个观点引用多个来源时连写

### 4. 结构要求
- 💬 今日引言：一句话点出今天最有价值的事，带点幽默
- 📌 一页总结 (TL;DR)：5条核心要点，每条一行
- 🔍 深度解读：3-5个主题小节，每节150-300字，有背景经过结果
- 🎯 曲库人必看：3条对曲库运营最相关的实操建议
- 😄 冷知识 / 趣闻：1-2条轻松但有信息量的内容
- 📎 参考链接：使用HTML滚动框格式

### 5. 参考链接格式（严格遵守！）
\`\`\`html
<div class="ref-scroll">

[1] **标题** — 来源 · YYYY-MM-DD · [链接](URL)
[2] **标题** — 来源 · YYYY-MM-DD · [链接](URL)
...
</div>\n\`\`\`
每个引用一行，包含标题、来源、发布日期、链接。必须按编号顺序排列。每个引用项必须用<p id=\"ref-N\">包裹，如<p id=\"ref-1\">[1] **标题** ...</p>

### 6. 长度
总计1200-2000字。

## 行业背景
用户是网易云音乐的曲库内容产品运营，关注音乐版权、元数据规范(DDEX)、ISRC/UPC标识符、音乐发行、流媒体平台、AI音乐、曲库治理、版税结算。

## 今日新闻素材
${newsContext}
${fulltextContext}

## 重要提醒
- 每个引用必须在文中至少出现一次
- 引用角标格式必须是<sup><a href="#ref-N">[N]</a></sup>
- 参考链接必须有发布日期（从原文标题或URL推断近似日期）
- 参考链接必须放在<div class="ref-scroll">中
- 深度解读要有背景、经过、结果，不能浮于表面

⚠️ 不要生成报告大标题（如\"音乐产业日报\"），直接从💬今日引言开始输出。\n\n现在开始生成今日报告。`;

  const resp = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${DEEPSEEK_KEY}`
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
      temperature: 0.8
    })
  });

  if (!resp.ok) throw new Error(`DeepSeek API error: ${resp.status}`);
  const data = await resp.json();
  const usage_in = data.usage ? data.usage.prompt_tokens || 0 : 0;
  const usage_out = data.usage ? data.usage.completion_tokens || 0 : 0;
  console.log(`[Token] 输入: ${usage_in} | 输出: ${usage_out} | 总计: ${usage_in + usage_out}`);
  return data.choices[0].message.content;
}

// ===================== 主流程 =====================

async function main() {
  console.log("🚀 YUTATA 行业雷达 v2 · AI 驱动");
  console.log("=".repeat(45));
  console.log(`📡 信息源: ${SOURCES.length} 个 (EN + ZH)`);
  console.log(`🏷️  关键词: ${Object.values(KEYWORDS).reduce((s, a) => s + a.length, 0)} 个`);
  console.log(`🤖 AI 引擎: DeepSeek V3`);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ========== 阶段1: 采集 ==========
  const allItems = [];

  for (const source of SOURCES) {
    process.stdout.write(`  ⏳ ${source.name} ...`);
    try {
      const xml = await fetchUrl(source.url);
      const items = parseRSS(xml);
      const recent = items.filter(i => isRecent(i.pubDate, DAYS_BACK)).slice(0, MAX_PER_SOURCE);
      console.log(` ✅ ${recent.length}篇`);
      for (const item of recent) {
        allItems.push({ ...item, source: source.name, weight: source.weight, lang: source.lang });
      }
    } catch (err) {
      console.log(` ❌ ${err.message}`);
    }
  }

  console.log(`\n📊 总计采集: ${allItems.length} 篇`);

  // ========== 阶段2: 分类 ==========
  const categorized = {};
  for (const cat of Object.keys(KEYWORDS)) categorized[cat] = [];
  categorized["其他"] = [];

  for (const item of allItems) {
    const cat = classifyItem(item);
    categorized[cat].push(item);
  }

  // 去重 + 排序
  for (const [cat, items] of Object.entries(categorized)) {
    const seen = new Set();
    for (let i = items.length - 1; i >= 0; i--) {
      const key = items[i].title.slice(0, 80).toLowerCase();
      if (seen.has(key)) items.splice(i, 1);
      else seen.add(key);
    }
    items.sort((a, b) => b.weight - a.weight);
  }

  // ========== 阶段3: 抓取精选全文 ==========
  const topItems = Object.entries(categorized)
    .filter(([k]) => k !== "其他")
    .flatMap(([, items]) => items)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_FULLTEXT);

  console.log(`\n📖 抓取 ${topItems.length} 篇全文...`);
  const fullTexts = [];
  for (const item of topItems) {
    process.stdout.write(`  ⏳ ${item.title.slice(0, 50)}... `);
    const text = await fetchArticleText(item.link);
    console.log(text.length > 100 ? `✅ ${text.length}字` : "⚠️ 空");
    if (text.length > 100) fullTexts.push({ title: item.title, source: item.source, text, link: item.link });
  }

  // ========== 阶段4: AI 生成报告 ==========
  const now = new Date();
  const dateCN = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${["日","一","二","三","四","五","六"][now.getDay()]}`;
  const dateStr = now.toISOString().slice(0, 10);

  console.log(`\n🤖 DeepSeek 正在撰写报告...`);
  let report;
  try {
    report = await generateReport(dateCN, categorized, fullTexts);
    
  // Post-process: strip AI-generated title if present
  report = report.replace(/^# 音乐产业日报.*\n+/m, '');
  report = report.replace(/^# .*日报.*\n+/m, '');
  
  // Post-process: ensure reference items have id attributes
  report = report.replace(/<div class="ref-scroll">([\s\S]*?)<\/div>/g, function(match, inner) {
    return '<div class="ref-scroll">' + inner.replace(/<p>\s*\[(\d+)\]/g, '<p id="ref-$1">[$1]') + '</div>';
  });

  console.log(`✅ AI 报告生成完成 (${report.length} 字)`);
  } catch (err) {
    console.log(`❌ AI 生成失败: ${err.message}`);
    console.log(`⚠️  降级为纯链接模式`);
    report = generateFallbackReport(dateCN, categorized);
  }

  // ========== 阶段5: 组装完整 Markdown ==========
  const totalMatched = Object.values(categorized)
    .filter((_, i) => i < Object.keys(KEYWORDS).length)
    .reduce((s, a) => s + a.length, 0);

  const topCats = Object.entries(categorized)
    .filter(([k]) => k !== "其他" && categorized[k].length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([k, v]) => `${k}(${v.length}篇)`)
    .join("、");

  const md = `---
title: ${dateStr} | 行业雷达日报
outline: [2, 3]
---

# 🛰️ 行业雷达 · ${dateCN}

> 📊 今日采集 ${allItems.length} 篇 | 命中 ${totalMatched} 篇 | AI 筛选引用并深度分析 | 热点集中在 ${topCats}

${report}

---

## 📊 数据统计

| 来源 | 语言 | 采集数 |
|------|------|--------|
${[...new Set(allItems.map(i => i.source))].map(src => {
  const cnt = allItems.filter(i => i.source === src).length;
  return `| ${src} | ${allItems.find(i => i.source === src)?.lang === "zh" ? "中文" : "EN"} | ${cnt} |`;
}).join("\n")}


> 生成时间: ${now.toLocaleString('zh-CN', {timeZone: 'Asia/Shanghai'})}
`;

  // 写入
  const filename = `${dateStr}.md`;
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, md, "utf-8");
  console.log(`\n✅ 报告已保存: ${filename}`);

  // ========== 阶段6: 更新索引页 ==========
  updateIndex(dateStr);
  console.log(`✅ 索引页已更新`);

  // 统计输出
  console.log(`\n📊 分类统计:`);
  for (const [cat, items] of Object.entries(categorized)) {
    if (items.length > 0) console.log(`   ${cat}: ${items.length} 篇`);
  }

  return { filename, itemCount: allItems.length, matched: totalMatched };
}

// ===================== 降级报告 =====================
function generateFallbackReport(dateCN, categorized) {
  let md = `### 💬 今日引言\n> AI 引擎暂时离线，以下为今日行业动态汇总。\n\n`;
  for (const [cat, items] of Object.entries(categorized)) {
    if (items.length === 0) continue;
    md += `### ${cat}\n`;
    items.slice(0, 6).forEach((item, i) => {
      md += `- [${i + 1}] **[${item.title}](${item.link})** — *${item.source}*\n`;
    });
    md += `\n`;
  }
  return md;
}

// ===================== 索引页更新 =====================
function updateIndex(latestDate) {
  const indexDir = OUTPUT_DIR;
  const files = fs.readdirSync(indexDir)
    .filter(f => f.endsWith(".md") && f !== "index.md" && /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse();

  let list = "";
  for (const f of files.slice(0, 30)) {
    const date = f.replace(".md", "");
    const items = files.length;
    list += `| ${date} | [📄 查看日报](./${f}) |\n`;
  }

  const indexMd = `---
title: 行业雷达
---

# 🛰️ 行业雷达

> 🤖 AI 驱动 · 每日 12:00 自动更新
> 覆盖音乐版权、元数据标准、AI音乐、曲库治理等领域

---

## 📡 数据源

| 来源 | 语言 | 类型 |
|------|------|------|
| Music Business Worldwide | EN | 音乐商业 |
| Billboard | EN | 榜单与行业 |
| Digital Music News | EN | 产业新闻 |
| Music Ally | EN | 数字音乐 |
| Hypebot / MusicTech | EN | 音乐科技 |
| 36氪 | 中文 | 科技创投 |
| Google News | 中/EN | 综合新闻 |

## 🏷️ 关键词覆盖

${Object.entries(KEYWORDS).map(([cat, kws]) => `- **${cat}**：${kws.length} 个关键词`).join("\n")}

---

## 📰 历史日报

| 日期 | 日报 |
|------|------|
${list}

> 💡 日报由 DeepSeek V3 自动生成，每日中午更新。
`;

  fs.writeFileSync(path.join(indexDir, "index.md"), indexMd, "utf-8");
}

main().catch((err) => {
  console.error("❌ 致命错误:", err);
  process.exit(1);
});
