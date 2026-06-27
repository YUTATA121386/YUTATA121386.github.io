#!/usr/bin/env node

/**
 * YUTATA 行业雷达 v3 · AI 驱动
 * 
 * 1. 多源 RSS 采集 (中英文)
 * 2. 全文抓取 + 关键词深度过滤
 * 3. 历史去重 —— 自动对比往期报告，剔除重复/相似文章
 * 4. 观点冲突检测 —— 与往期观点冲突时自动标注
 * 5. DeepSeek AI 生成结构化中文行业报告
 * 6. 自动更新日报索引页
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ===================== 配置 =====================
const DEEPSEEK_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";
const OUTPUT_DIR = path.join(__dirname, "..", "docs", "daily");
const CONFIG_FILE = path.join(__dirname, "sources.json");
const MAX_FULLTEXT = 3;
const MAX_PER_SOURCE = 15;
const DAYS_BACK = 1;
const MAX_CONFLICT_HISTORY = 7;  // 用于冲突检测的最近天数

// ===================== 前置检查 =====================
if (!DEEPSEEK_KEY || DEEPSEEK_KEY === "") {
  console.error("❌ 错误: DEEPSEEK_API_KEY 环境变量未设置");
  console.error("   请在 GitHub Repo → Settings → Secrets → Actions 添加 DEEPSEEK_API_KEY");
  console.error("   或在本地运行时通过环境变量传入");
  process.exit(1);
}

// 加载配置
let CONFIG;
try {
  CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
} catch (e) {
  console.error("❌ 无法加载 sources.json:", e.message);
  process.exit(1);
}

const SOURCES = CONFIG.sources;
const KEYWORDS = CONFIG.keywords;

// ===================== 辅助函数 =====================
// 标准化标题用于去重比较
function normalizeTitle(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 加载历史数据：已见链接、已见标题、近期报告内容
function loadHistory() {
  let files;
  try {
    files = fs.readdirSync(OUTPUT_DIR)
      .filter(f => f.endsWith(".md") && f !== "index.md" && /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort();
  } catch {
    return { seenUrls: new Set(), seenTitles: new Map(), recentReports: [] };
  }

  const seenUrls = new Set();
  const seenTitles = new Map();  // normalizedTitle -> { date, title, link }
  const recentReports = [];      // 最近 N 天的报告内容

  for (const file of files) {
    const content = fs.readFileSync(path.join(OUTPUT_DIR, file), "utf-8");
    const date = file.replace(".md", "");

    // 提取参考文献中的链接和标题
    const refRegex = /<p id="ref-\d+">\[\d+\] \*\*([^*]+)\*\*[\s\S]*?<a href="([^"]+)">/g;
    let match;
    while ((match = refRegex.exec(content)) !== null) {
      const title = match[1];
      const link = match[2].split(")")[0];
      seenUrls.add(link);
      seenTitles.set(normalizeTitle(title), { date, title, link });
    }

    // 提取降级版 / 备用格式的链接
    const fallbackRegex = /- \[\d+\] \*\*\[([^\]]+)\]\(([^)]+)\)\*\*/g;
    while ((match = fallbackRegex.exec(content)) !== null) {
      const title = match[1];
      const link = match[2].split(")")[0];
      if (!seenUrls.has(link)) {
        seenUrls.add(link);
        seenTitles.set(normalizeTitle(title), { date, title, link });
      }
    }

    // 保留最近报告内容用于冲突检测
    if (files.length - files.indexOf(file) < MAX_CONFLICT_HISTORY) {
      const body = content.replace(/---[\s\S]*?---\n/, "").substring(0, 6000);
      recentReports.push({ date, content: body });
    }
  }

  return { seenUrls, seenTitles, recentReports };
}

// 去重：过滤掉历史中已出现的文章
function deduplicateItems(items, history, dateStr) {
  const newItems = [];
  const skipped = [];

  for (const item of items) {
    // 精确 URL 去重
    if (history.seenUrls.has(item.link)) {
      skipped.push({ title: item.title, link: item.link, reason: "链接重复" });
      continue;
    }

    // 标题相似度去重
    const norm = normalizeTitle(item.title);
    if (history.seenTitles.has(norm)) {
      const matched = history.seenTitles.get(norm);
      skipped.push({ title: item.title, link: item.link, reason: `与 ${matched.date} 报道相似: ${matched.title}` });
      continue;
    }

    // 标题前 40 个字符重叠检测（处理同一事件不同标题）
    const shortKey = item.title.slice(0, 40).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
    let isDuplicate = false;
    for (const [key, matched] of history.seenTitles) {
      const matchedShort = matched.title.slice(0, 40).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]/g, "");
      // 如果标题前 40 字符有 70% 以上相似
      let common = 0;
      for (let i = 0; i < Math.min(shortKey.length, matchedShort.length); i++) {
        if (shortKey[i] === matchedShort[i]) common++;
      }
      const maxLen = Math.max(shortKey.length, matchedShort.length);
      if (maxLen > 0 && common / maxLen > 0.7) {
        skipped.push({ title: item.title, link: item.link, reason: `与 ${matched.date} 话题高度相似` });
        isDuplicate = true;
        break;
      }
    }
    if (isDuplicate) continue;

    newItems.push(item);
  }

  console.log(`📊 去重统计: 新增 ${newItems.length} 篇, 跳过重复 ${skipped.length} 篇`);
  if (skipped.length > 0) {
    console.log("   跳过的文章:");
    skipped.forEach(s => console.log(`   - [重复] ${s.title.slice(0, 60)} (${s.reason})`));
  }

  return { newItems, skipped };
}

// ===================== RSS 采集 =====================
function fetchUrl(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout, headers: { "User-Agent": "YUTATA-Radar/3.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(new URL(res.headers.location, url).href, timeout).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", chunk => data += chunk.toString("utf-8"));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function simpleParseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1] || "";
    const link = (block.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || [])[1] || "";
    const desc = (block.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i) || [])[1] || "";
    const pubDate = (block.match(/<pubDate>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/pubDate>/i) || [])[1] || "";
    const dcDate = (block.match(/<dc:date>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/dc:date>/i) || [])[1] || "";
    const dateStr = pubDate || dcDate || "";
    if (title && link) items.push({ title, link, description: desc.replace(/<[^>]*>/g, "").trim(), pubDate: dateStr });
  }
  return items;
}

function fetchArticleText(url) {
  return new Promise((resolve) => {
    const html = fetchUrl(url, 8000);
    html.then(text => {
      const bodyMatch = text.match(/<article[\s\S]*?<\/article>/i) ||
                        text.match(/<body[\s\S]*?<\/body>/i) ||
                        text.match(/<main[\s\S]*?<\/main>/i) ||
                        text.match(/<div[^>]*content[^>]*>[\s\S]*?<\/div>/i);
      const content = bodyMatch ? bodyMatch[0] : text;
      const clean = content.replace(/<script[\s\S]*?<\/script>/gi, "")
                           .replace(/<style[\s\S]*?<\/style>/gi, "")
                           .replace(/<[^>]*>/g, "")
                           .replace(/\s+/g, " ")
                           .trim();
      resolve(clean);
    }).catch(() => resolve(""));
  });
}

// ===================== AI 报告生成 =====================
async function generateReport(dateCN, categorized, fullTexts, history) {
  let newsContext = "";
  let refIndex = 1;
  const refs = [];

  for (const [cat, items] of Object.entries(categorized)) {
    if (items.length === 0) continue;
    newsContext += "\n## " + cat + "\n";
    for (const item of items) {
      if (refIndex > 60) break;
      newsContext += "- [" + refIndex + "] " + item.title + "\n  来源: " + item.source + "\n  摘要: " + item.description.slice(0, 200) + "\n";
      refs.push({ num: refIndex, title: item.title, link: item.link, source: item.source });
      refIndex++;
    }
  }

  let fullTextContext = "";
  if (fullTexts.length > 0) {
    fullTextContext += "\n## 深度文章全文\n";
    for (const ft of fullTexts.slice(0, MAX_FULLTEXT)) {
      fullTextContext += "\n--- " + ft.title + " (" + ft.source + ") ---\n" + ft.text.slice(0, 2000) + "\n";
    }
  }

  let historyContext = "";
  if (history.recentReports.length > 0) {
    historyContext += "\n## 往期重要观点回顾\n";
    for (const r of history.recentReports.slice(0, 5)) {
      const introMatch = r.content.match(/\*\u7528\u65e5\u5f15\u8a00\*\*[\uff1a:]([^#\n]+)/);
      const keyPoints = r.content.match(/TL;DR[\s\S]*?(?=##|\ud83d\udd0d|$)/);
      historyContext += "\n--- " + r.date + " \u62a5\u544a ---\n";
      if (introMatch) historyContext += "\u6838\u5fc3\u89c2\u70b9: " + introMatch[1].trim() + "\n";
      if (keyPoints) {
        const lines = keyPoints[0].split("\n").filter(l => l.trim().match(/^\d+\./));
        historyContext += lines.map(l => l.trim()).join("\n") + "\n";
      }
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

### 5. 去重与冲突检测（重要！）
- 如果某条新闻在往期报告中已报道过（同一件事的最新进展），在文中注明"*本文是对 [往期日期] 报道的后续跟进*"
- 如果今日信息与往期报告的观点存在矛盾或重大变化，用 ⚠️ 标出并说明：*这与 [往期日期] 的报道观点不同，当时认为...*
- 如果只是重复信息没有新进展，不要大篇幅描述，只做简要提及

### 6. 参考链接格式（严格遵守！）
<div class="ref-scroll">
[1] **标题** — 来源 · YYYY-MM-DD · [链接](URL)
[2] **标题** — 来源 · YYYY-MM-DD · [链接](URL)
...
</div>
每个引用一行，包含标题、来源、发布日期、链接。必须按编号顺序排列。

### 7. 长度
总计1200-2000字。

## 今日新闻

${historyContext}

${newsContext}
${fullTextContext}`;

  const body = JSON.stringify({
    model: "deepseek-chat",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 4096,
    temperature: 0.8
  });

  const resp = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + DEEPSEEK_KEY
    },
    body
  });

  if (!resp.ok) throw new Error("DeepSeek API error: " + resp.status);
  const data = await resp.json();
  const usage_in = data.usage ? data.usage.prompt_tokens || 0 : 0;
  const usage_out = data.usage ? data.usage.completion_tokens || 0 : 0;
  console.log("[Token] 输入: " + usage_in + " | 输出: " + usage_out + " | 总计: " + (usage_in + usage_out));

  let report = data.choices[0].message.content;

  if (refs.length > 0) {
    report += "\n\n📎 **参考链接**\n\n<div class=\"ref-scroll\">\n";
    for (const r of refs) {
      report += '<p id="ref-' + r.num + '">[' + r.num + '] **' + r.title + '** — ' + r.source + ' · <a href="' + r.link + '">链接</a></p>\n';
    }
    report += "</div>";
  }

  return report;
}

function generateFallbackReport(dateCN, categorized) {
  let md = `### 💰 今日引言\n> AI 引擎暂时离线，以下为今日行业动态汇总。\n\n`;
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
  const files = fs.readdirSync(OUTPUT_DIR)
    .filter(f => f.endsWith(".md") && f !== "index.md" && /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .reverse();

  let list = "";
  for (const f of files.slice(0, 30)) {
    const date = f.replace(".md", "");
    list += `| ${date} | [📫 查看日报](./${f}) |\n`;
  }

  const indexMd = `---
title: 行业雷达
---

# 🌶️ 行业雷达

> 🚻 AI 驱动 · 每日 12:00 自动更新
> 覆盖音乐版权、元数据标准、AI音乐、曲库治理等领域
> v3: 自动去重 + 观点冲突检测 + 国内源增强

---

## 📗 数据源

| 来源 | 语言 | 类型 |
|------|------|------|
| Music Business Worldwide | EN | 音乐商业 |
| Billboard | EN | 榜单与行业 |
| Digital Music News | EN | 产业新闻 |
| Music Ally | EN | 数字音乐 |
| Hypebot / MusicTech | EN | 音乐科技 |
| 36氪 | 中文 | 科技创投 |
| 虎嗅 | 中文 | 科技商业 |
| 音乐财经 | 中文 | 音乐产业 |
| Google News | 中/EN | 综合新闻 |

## 🔏 关键词覆盖

${Object.entries(KEYWORDS).map(([cat, kws]) => `- **${cat}**：${kws.length} 个关键词`).join("\n")}

---

## 📪 历史日报

| 日期 | 日报 |
|------|------|
${list}

> 📕 日报由 DeepSeek V3 自动生成，每日中午更新。
> 已自动去重，并检测与往期报道的观点冲突。
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, "index.md"), indexMd, "utf-8");
}

// ===================== 主流程 =====================
async function main() {
  console.log("🚀 YUTATA 行业雷达 v3 · AI 驱动");
  console.log("=============================================");
  console.log(`📡 信息源: ${SOURCES.length} 个 (EN + ZH)`);
  console.log(`🏷️  关键词: ${Object.values(KEYWORDS).flat().length} 个`);
  console.log(`🤖 AI 引擎: DeepSeek V3`);
  console.log(`🔁 去重与冲突检测: 已启用`);

  // ========== 阶段1: 加载历史数据 ==========
  console.log(`\n📚 加载历史报告...`);
  const history = loadHistory();
  console.log(`   已收录 ${history.seenUrls.size} 篇历史文章, ${history.recentReports.length} 篇近期报告`);

  // ========== 阶段2: 采集 RSS ==========
  const allItems = [];
  for (const source of SOURCES) {
    process.stdout.write(`  ⏳ ${source.name} ... `);
    try {
      const xml = await fetchUrl(source.url);
      const items = simpleParseRSS(xml);
      const recent = items
        .filter(i => {
          if (!i.pubDate) return true;
          const d = new Date(i.pubDate);
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - DAYS_BACK);
          return d >= cutoff;
        })
        .slice(0, MAX_PER_SOURCE);
      recent.forEach(i => { i.source = source.name; i.lang = source.lang; });
      allItems.push(...recent);
      console.log(`✅ ${recent.length}篇`);
    } catch (err) {
      console.log(`❌ ${err.message}`);
    }
  }

  console.log(`\n📊 总计采集: ${allItems.length} 篇`);

  // ========== 阶段3: 去重 ==========
  const { newItems, skipped } = deduplicateItems(allItems, history);
  if (newItems.length === 0) {
    console.log("⚠️  所有文章均为历史重复，AI 生成跳过。生成仅含汇总的简报。");
  }

  // ========== 阶段4: 关键词分类 ==========
  const categorized = {};
  for (const cat of Object.keys(KEYWORDS)) categorized[cat] = [];
  categorized["其他"] = [];

  for (const item of newItems) {
    const text = item.title + " " + item.description;
    let matched = false;
    for (const [catName, keywords] of Object.entries(KEYWORDS)) {
      const lower = text.toLowerCase();
      if (keywords.some(kw => lower.includes(kw.toLowerCase()))) {
        categorized[catName].push(item);
        matched = true;
        break;
      }
    }
    if (!matched) categorized["其他"].push(item);
  }

  // ========== 阶段5: 去重后的分类内部去重 ==========
  for (const [cat, items] of Object.entries(categorized)) {
    const seen = new Set();
    categorized[cat] = items.filter(item => {
      const key = item.title.slice(0, 60).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ========== 阶段6: 获取 TOP 文章全文 ==========
  const topItems = Object.entries(categorized)
    .filter(([k]) => k !== "其他")
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .flatMap(([, items]) => items);

  const fullTexts = [];
  console.log(`\n📖 抓取 ${MAX_FULLTEXT} 篇全文...`);
  for (const item of topItems.slice(0, MAX_FULLTEXT)) {
    process.stdout.write(`  ⏳ ${item.title.slice(0, 50)}... `);
    const text = await fetchArticleText(item.link);
    if (text.length > 100) {
      fullTexts.push({ title: item.title, source: item.source, text, link: item.link });
      console.log(`✅ ${text.length}字`);
    } else {
      console.log(`⚠️  太短(${text.length}字)`);
    }
  }

  // ========== 阶段7: AI 生成报告 ==========
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const dateCN = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  console.log(`\n🤖 DeepSeek 正在撰写报告...`);
  let report;
  try {
    report = await generateReport(dateCN, categorized, fullTexts, history);

    // 后处理：清理 AI 可能自带的标题
    report = report.replace(/^# 音乐产业日报.*\n+/m, "");
    report = report.replace(/^# .*日报.*\n+/m, "");

    // 后处理：确保 ref-scroll 中的 id 属性
    report = report.replace(/<div class="ref-scroll">([\s\S]*?)<\/div>/g, function(match, inner) {
      return '<div class="ref-scroll">' + inner.replace(/<p>\s*\[(\d+)\]/g, '<p id="ref-$1">[$1]') + '</div>';
    });

    const reportBody = report.replace(/<div class="ref-scroll">[\s\S]*?<\/div>/, "").trim();
    console.log(`✅ AI 报告生成完成 (${reportBody.length} 字)`);
  } catch (err) {
    console.log(`❌ AI 生成失败: ${err.message}`);
    console.log(`⬇️  降级为纯链接模式`);
    report = generateFallbackReport(dateCN, categorized);
  }

  // ========== 阶段8: 组装完整 Markdown ==========
  const totalMatched = Object.values(categorized)
    .reduce((s, a) => s + a.length, 0);

  const topCats = Object.entries(categorized)
    .filter(([k]) => k !== "其他" && categorized[k].length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([k, v]) => `${k}(${v.length}篇)`)
    .join("、");

  // 去重统计信息
  const dedupNote = skipped.length > 0
    ? `⚠️ 本次去重过滤 ${skipped.length} 篇重复报道（共采集 ${allItems.length} 篇，新增 ${newItems.length} 篇）`
    : "";

  const md = `---
title: ${dateStr} | 行业雷达日报
outline: [2, 3]
---

# 🌶️ 行业雷达 · ${dateCN}

> 📳 今日采集 ${allItems.length} 篇 | 命中 ${totalMatched} 篇 | 新增 ${newItems.length} 篇 | AI 筛选引用并深度分析 | 热点集中在 ${topCats}
${dedupNote ? `> ${dedupNote}` : ""}

${report}

---

## 📳 数据统计

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

  // ========== 阶段9: 更新索引页 ==========
  updateIndex(dateStr);
  console.log(`✅ 索引页已更新`);

  // ========== 阶段10: 统计输出 ==========
  console.log(`\n📊 分类统计:`);
  for (const [cat, items] of Object.entries(categorized)) {
    if (items.length > 0) console.log(`   ${cat}: ${items.length} 篇`);
  }

  return { filename, itemCount: allItems.length, matched: totalMatched, newItems: newItems.length, skipped: skipped.length };
}

main().catch((err) => {
  console.error("❌ 致命错误:", err);
  process.exit(1);
});
