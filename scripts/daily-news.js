#!/usr/bin/env node

/**
 * YUTATA 行业雷达 · 每日新闻采集脚本
 * 
 * 从国内外音乐行业媒体拉取最新新闻，
 * 按关键词分类过滤，生成结构化日报。
 * 
 * 触发方式：GitHub Actions 定时任务 (每日 12:00 CST)
 * 输出：docs/daily/YYYY-MM-DD-摘要.md
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// ===================== 配置 =====================

const SOURCES_FILE = path.join(__dirname, "sources.json");
const OUTPUT_DIR = path.join(__dirname, "..", "docs", "daily");
const MAX_ITEMS_PER_FEED = 20;
const MAX_REPORT_ITEMS = 30;
const DAYS_BACK = 1; // 只看最近1天

// ===================== 工具函数 =====================

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    const req = client.get(url, { timeout: 15000, headers: { "User-Agent": "YUTATA-Radar/1.0" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function stripHtml(html) {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'").replace(/&ldquo;/g, '"').replace(/&rdquo;/g, '"')
    .replace(/&#038;/g, "&").trim();
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
    
    if (title && link) {
      items.push({
        title: stripHtml(title),
        link: link.trim(),
        description: stripHtml(desc).slice(0, 300),
        pubDate: dateStr,
      });
    }
  }
  return items;
}

function isRecent(dateStr, daysBack) {
  if (!dateStr) return true; // 无日期默认纳入
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysBack);
  return d >= cutoff;
}

function matchKeywords(text, keywords) {
  const lower = text.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
}

// ===================== 主流程 =====================

async function main() {
  console.log("🚀 YUTATA 行业雷达 · 启动");
  console.log("=" .repeat(40));

  // 加载配置
  const config = JSON.parse(fs.readFileSync(SOURCES_FILE, "utf-8"));
  console.log(`📡 信息源: ${config.sources.length} 个`);

  // 确保输出目录存在
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // ========== 采集阶段 ==========
  const allItems = [];

  for (const source of config.sources) {
    console.log(`  ⏳ ${source.name} ...`);
    try {
      const xml = await fetchUrl(source.url);
      const items = simpleParseRSS(xml);
      const recent = items
        .filter((item) => isRecent(item.pubDate, DAYS_BACK))
        .slice(0, MAX_ITEMS_PER_FEED);

      console.log(`  ✅ ${source.name}: ${recent.length} 篇 (共 ${items.length} 篇)`);

      for (const item of recent) {
        allItems.push({ ...item, source: source.name, weight: source.weight, lang: source.lang });
      }
    } catch (err) {
      console.log(`  ❌ ${source.name}: ${err.message}`);
    }
  }

  console.log(`\n📊 总计采集: ${allItems.length} 篇`);

  // ========== 分类阶段 ==========
  const categories = {};
  for (const [catName, keywords] of Object.entries(config.keywords)) {
    categories[catName] = [];
  }
  categories["其他"] = [];

  for (const item of allItems) {
    const text = item.title + " " + item.description;
    let matched = false;
    for (const [catName, keywords] of Object.entries(config.keywords)) {
      if (matchKeywords(text, keywords)) {
        categories[catName].push(item);
        matched = true;
        break;
      }
    }
    if (!matched) {
      categories["其他"].push(item);
    }
  }

  // 去重（按标题相似度）
  for (const cat of Object.values(categories)) {
    const seen = new Set();
    cat.forEach((item) => {
      const key = item.title.slice(0, 60).toLowerCase();
      if (seen.has(key)) {
        item._dup = true;
      } else {
        seen.add(key);
      }
    });
    // 原地去重
    const idx = cat.findIndex((i) => i._dup);
    if (idx >= 0) {
      for (let i = cat.length - 1; i >= 0; i--) {
        if (cat[i]._dup) cat.splice(i, 1);
      }
    }
  }

  // 按来源权重排序，限制总数
  for (const cat of Object.values(categories)) {
    cat.sort((a, b) => b.weight - a.weight);
  }

  // ========== 生成报告 ==========
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const dateCN = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
  const weekDay = ["日", "一", "二", "三", "四", "五", "六"][now.getDay()];

  // 生成摘要标题
  const totalMatched = Object.entries(categories)
    .filter(([k]) => k !== "其他")
    .reduce((sum, [, items]) => sum + items.length, 0);

  const topCats = Object.entries(categories)
    .filter(([k]) => k !== "其他" && categories[k].length > 0)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 3)
    .map(([k, v]) => `${k}(${v.length}篇)`)
    .join("、");

  const summaryTitle = topCats 
    ? `今日热点集中在${topCats}等领域，共收录${totalMatched}篇行业动态`
    : "今日暂无重大行业动态";

  let md = `---
title: ${dateStr} | ${summaryTitle.slice(0, 50)}
outline: [2, 3]
---

# 🛰️ 行业雷达 · ${dateCN} 周${weekDay}

> ${summaryTitle}

`;

  // 各分类内容
  for (const [catName, items] of Object.entries(categories)) {
    if (items.length === 0 && catName !== "其他") continue;
    if (catName === "其他" && items.length === 0) continue;

    const emoji = {
      "音乐版权": "©️", "元数据与DDEX": "🏷️", "ISRC/UPC": "🔢",
      "音乐发行": "📦", "音乐平台": "🎧", "AI音乐": "🤖",
      "曲库治理": "🗂️", "版税结算": "💰", "其他": "📌"
    }[catName] || "📌";

    md += `## ${emoji} ${catName}\n\n`;

    for (const item of items) {
      const sourceTag = item.source;
      md += `- **[${item.title}](${item.link})**\n`;
      md += `  *${sourceTag}*`;
      if (item.description) {
        md += ` — ${item.description.slice(0, 120)}`;
      }
      md += `\n`;
    }
    md += `\n`;
  }

  // 信息来源统计
  const sourceStats = {};
  allItems.forEach((item) => {
    sourceStats[item.source] = (sourceStats[item.source] || 0) + 1;
  });

  md += `---\n\n`;
  md += `## 📊 数据统计\n\n`;
  md += `| 来源 | 采集数 |\n`;
  md += `|------|--------|\n`;
  for (const [source, count] of Object.entries(sourceStats).sort((a, b) => b[1] - a[1])) {
    md += `| ${source} | ${count} |\n`;
  }

  md += `\n> 🤖 本文由 [YUTATA 行业雷达] 自动生成，每日 12:00 更新\n`;
  md += `> 生成时间: ${now.toISOString()}\n`;

  // ========== 写入文件 ==========
  const filename = `${dateStr}.md`;
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, md, "utf-8");

  console.log(`\n✅ 报告已生成: ${filename}`);
  console.log(`📁 路径: ${filepath}`);
  console.log(`📝 总大小: ${md.length} 字符`);
  console.log(`🏷️  分类统计:`);
  for (const [cat, items] of Object.entries(categories)) {
    if (items.length > 0) console.log(`   ${cat}: ${items.length} 篇`);
  }

  return { filename, filepath, itemCount: allItems.length };
}

main().catch((err) => {
  console.error("❌ 脚本失败:", err);
  process.exit(1);
});
