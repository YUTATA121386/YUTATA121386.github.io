#!/usr/bin/env node

/** YUTATA Knowledge Gap Detector v1 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const DAILY_DIR = path.join(ROOT_DIR, "docs", "daily");
const SOURCES_FILE = path.join(__dirname, "sources.json");
const OUTPUT_FILE = path.join(ROOT_DIR, "docs", "daily", "knowledge-gap-report.md");
const LOOKBACK_DAYS = 7;
const MIN_GAP_HITS = 2;

const PERSONAL_SECTIONS = ["docs/general","docs/music-product","docs/user-period","docs/interview","docs/interview/campus","docs/pilgrimage","docs/growth"];

const CONFIG = JSON.parse(fs.readFileSync(SOURCES_FILE, "utf-8"));
const KEYWORDS = CONFIG.keywords;
const CATS = Object.keys(KEYWORDS);

function scanPersonalContent() {
  const cov = {};
  for (const c of CATS) cov[c] = { files: [], hitCount: 0 };
  cov.__all = [];
  for (const sec of PERSONAL_SECTIONS) {
    const dp = path.join(ROOT_DIR, sec);
    let files;
    try { files = fs.readdirSync(dp).filter(f => f.endsWith(".md")); } catch { continue; }
    for (const f of files) {
      const txt = fs.readFileSync(path.join(dp, f), "utf-8").toLowerCase();
      const rp = sec + "/" + f;
      cov.__all.push(rp);
      for (const [cat, kws] of Object.entries(KEYWORDS)) {
        const h = kws.map(k => k.toLowerCase()).filter(kw => txt.includes(kw));
        if (h.length > 0) cov[cat].files.push({ file: rp, n: h.length });
      }
    }
  }
  for (const cat of CATS) {
    const seen = new Set();
    cov[cat].files = cov[cat].files.filter(f => !f.file.endsWith("/index.md")).filter(f => { if (seen.has(f.file)) return false; seen.add(f.file); return true; });
    cov[cat].hitCount = cov[cat].files.length;
  }
  return cov;
}

function analyzeRadarReports() {
  const hits = {};
  for (const c of CATS) hits[c] = 0;
  let files;
  try {
    files = fs.readdirSync(DAILY_DIR)
      .filter(f => f.endsWith(".md") && f !== "index.md" && f !== "keywords.md")
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort().reverse().slice(0, LOOKBACK_DAYS);
  } catch { return { hits, files: [] }; }
  for (const f of files) {
    const txt = fs.readFileSync(path.join(DAILY_DIR, f), "utf-8").toLowerCase();
    for (const [cat, kws] of Object.entries(KEYWORDS)) {
      const h = kws.map(k => k.toLowerCase()).filter(kw => txt.includes(kw));
      if (h.length > 0) hits[cat] += h.length;
    }
  }
  return { hits, files };
}

function getAdvice(cat) {
  const m = {
    '音乐版权': '可以从版权方/发行方/平台方三方利益关系切入，结合网易云实践经验。',
    '元数据与DDEX': '曲库运营的基础设施，建议从 DDEX 标准体系入手。',
    'ISRC/UPC': '音乐行业基础编码体系，可整理一篇标识符速查表。',
    '音乐发行': '发行渠道演变（物理->数字->AI），可结合发行方工作经验。',
    '音乐平台': 'Spotify/Apple Music/腾讯音乐等平台的商业模式对比分析。',
    'AI音乐': 'AI生成音乐对版权、发行、平台的冲击，雷达已有大量案例可参考。',
    '曲库治理': '你的主战场，可从质检、去重、元数据标准化等维度深化整理。',
    '版税结算': '版税分账体系的复杂性，可从行政错误18年未收款案例切入。',
    '中国音乐市场': 'TME vs 网易云 vs 汽水音乐的三方格局分析。',
    '演出与现场': '票务、巡演、音乐节的经济模型，可从 CTF 公平票务案例切入。',
  };
  return m[cat] || '建议从雷达日报引用相关案例，整理一篇入门笔记。';
}

function generateReport(radar, personal) {
  const rFiles = radar.files, rHits = radar.hits;
  const cats = Object.keys(rHits);
  const gaps = [];
  for (const cat of cats) {
    const rc = rHits[cat] || 0;
    const pc = (personal[cat] && personal[cat].hitCount) || 0;
    const pf = (personal[cat] && personal[cat].files.map(f => f.file)) || [];
    const score = rc * (pc === 0 ? 3 : pc === 1 ? 2 : pc <= 2 ? 1 : 0);
    gaps.push({ cat, rc, pc, pf, score });
  }
  gaps.sort((a, b) => b.score - a.score);
  const high = gaps.filter(g => g.score >= 6);
  const mid = gaps.filter(g => g.score >= 2 && g.score < 6 && g.rc >= MIN_GAP_HITS);
  const good = gaps.filter(g => g.pc >= 2 && g.rc > 0);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const range = rFiles.length > 0 ? rFiles[rFiles.length-1].replace(".md","") + " ~ " + rFiles[0].replace(".md","") : "no reports";
  const totalKws = Object.values(KEYWORDS).flat().length;
  const allFiles = (personal.__all || []).length;

  var r = "";
  r += "---\n";
  r += "title: 知识缺口报告\n";
  r += "outline: [2, 3]\n";
  r += "---\n";
  r += "\n";
  r += "# 📋 知识缺口报告\n";
  r += "\n";
  r += "> 生成时间: " + dateStr + "\n";
  r += "> 分析范围: " + range + "（" + rFiles.length + "期行业雷达）\n";
  r += "> 覆盖 " + cats.length + " 个分类 | " + totalKws + " 个关键词\n";
  r += "> 扫描 " + allFiles + " 篇个人笔记\n";
  r += "\n---\n";
  r += "\n";
  r += "## 🔥 高优先级缺口\n";
  r += "\n";
  if (high.length === 0) { r += "暂无。\n"; }
  else {
    r += "> 这些话题在雷达中频繁出现，但你尚未系统整理。**建议优先补充**。\n";
    r += "\n";
    for (const g of high) {
      r += "### " + g.cat + "\n";
      r += "- 雷达出现 **" + g.rc + "** 次（近" + LOOKBACK_DAYS + "天）\n";
      r += "- 个人笔记: 暂无\n";
      r += "- 建议: " + getAdvice(g.cat) + "\n";
      r += "\n";
    }
  }
  r += "\n";
  r += "---\n";
  r += "\n";
  r += "## 🟡 中等优先级\n";
  r += "\n";
  if (mid.length === 0) { r += "暂无。\n"; }
  else {
    for (const g of mid) {
      r += "- **" + g.cat + "** —— 雷达 " + g.rc + " 次，笔记 " + g.pc + " 篇";
      if (g.pf.length > 0) r += "（现有: " + g.pf.join("、") + "）";
      r += "\n";
    }
  }
  r += "\n";
  r += "---\n";
  r += "\n";
  r += "## ✅ 覆盖良好\n";
  r += "\n";
  const gf = good.filter(g => g.rc >= MIN_GAP_HITS);
  if (gf.length === 0) { r += "暂无。\n"; }
  else {
    for (const g of gf) r += "- **" + g.cat + "** —— 雷达 " + g.rc + " 次 ↔ 笔记 " + g.pc + " 篇\n";
  }
  r += "\n";
  r += "---\n";
  r += "\n";
  r += "## 📊 全量覆盖一览\n";
  r += "\n";
  r += "| 状态 | 领域 | 雷达频次 | 笔记篇数 |\n";
  r += "|------|------|---------|---------|\n";
  for (const g of gaps) {
    const s = g.pc >= 2 ? "✅" : g.pc >= 1 ? "⚠️" : "🔴";
    r += "| " + s + " | **" + g.cat + "** | " + g.rc + " | " + g.pc + " |\n";
  }
  r += "\n";
  r += "## 📎 参考日报\n";
  r += "\n";
  r += '<div class="scroll-report-list">\n';
  r += "\n";
  r += "| 日期 | 日报 |\n";
  r += "|------|------|\n";
  for (const f of rFiles) {
    r += "| " + f.replace(".md","") + " | [查看](./" + f + ") |\n";
  }
  r += "\n";
  r += '</div>\n';
  r += "\n";
  r += '<style>\n';
  r += '.scroll-report-list {\n';
  r += "  max-height: 400px;\n";
  r += "  overflow-y: auto;\n";
  r += "  border: 1px solid var(--vp-c-divider);\n";
  r += "  border-radius: 4px;\n";
  r += "  padding: 4px 12px;\n";
  r += "}\n";
  r += '.scroll-report-list table {\n';
  r += "  margin: 0;\n";
  r += "}\n";
  r += '</style>\n';
  r += "\n";
  r += "> 💡 **提示**: 缺口报告只标记该领域你还没有系统笔记，不代表你必须写。决策权在你手上。\n";
  r += "> 🔄 每周自动更新，由 `scripts/gap-detector.js` 生成。\n";
  return r;
}

function main() {
  console.log("[YUTATA Gap Detection v1]");
  console.log("Analyzing last " + LOOKBACK_DAYS + " days...");
  const radar = analyzeRadarReports();
  console.log("  Read " + radar.files.length + " reports");
  const sorted = Object.entries(radar.hits).sort((a, b) => b[1] - a[1]);
  for (const [cat, c] of sorted) {
    if (c > 0) console.log("  " + cat + ": " + c + " hits");
  }
  console.log("");
  console.log("Scanning personal knowledge base...");
  const personal = scanPersonalContent();
  console.log("  Scanned " + (personal.__all || []).length + " notes");
  console.log("");
  console.log("Generating gap report...");
  const report = generateReport(radar, personal);
  fs.writeFileSync(OUTPUT_FILE, report, "utf-8");
  console.log("Report saved: " + path.relative(ROOT_DIR, OUTPUT_FILE));
  const highCount = (report.match(/^### /gm) || []).length;
  console.log("  High priority gaps: " + highCount);
}

main();