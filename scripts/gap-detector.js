#!/usr/bin/env node

/** YUTATA Knowledge Gap Detector v1 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const DAILY_DIR = path.join(ROOT_DIR, 'docs', 'daily');
const SOURCES_FILE = path.join(__dirname, 'sources.json');
const OUTPUT_FILE = path.join(ROOT_DIR, 'docs', 'daily', 'knowledge-gap-report.md');
const LOOKBACK_DAYS = 7;
const MIN_GAP_HITS = 2;

const PERSONAL_SECTIONS = [
  'docs/general','docs/music-product','docs/user-period',
  'docs/interview','docs/interview/campus',
  'docs/pilgrimage','docs/growth',
];

const CONFIG = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf-8'));
const KEYWORDS = CONFIG.keywords;
const CATEGORY_NAMES = Object.keys(KEYWORDS);

function scanPersonalContent() {
  const cov = {};
  for (const c of CATEGORY_NAMES) cov[c] = { files: [], hitCount: 0 };
  cov.__all_files = [];
  for (const sec of PERSONAL_SECTIONS) {
    const dp = path.join(ROOT_DIR, sec);
    let files;
    try { files = fs.readdirSync(dp).filter(f => f.endsWith('.md')); } catch { continue; }
    for (const f of files) {
      const content = fs.readFileSync(path.join(dp, f), 'utf-8').toLowerCase();
      const rp = sec + '/' + f;
      cov.__all_files.push(rp);
      for (const [cat, kws] of Object.entries(KEYWORDS)) {
        const hits = kws.map(k => k.toLowerCase()).filter(kw => content.includes(kw));
        if (hits.length > 0) cov[cat].files.push({ file: rp, matched: hits.length });
      }
}}
  for (const cat of CATEGORY_NAMES) {
    const seen = new Set();
    cov[cat].files = cov[cat].files.filter(f => !f.file.endsWith('/index.md')).filter(f => { if (seen.has(f.file)) return false; seen.add(f.file); return true; });
    cov[cat].hitCount = cov[cat].files.length;
  }
  return cov;
}

function analyzeRadarReports() {
  const hits = {};
  for (const c of CATEGORY_NAMES) hits[c] = 0;
  let files;
  try {
    files = fs.readdirSync(DAILY_DIR)
      .filter(f => f.endsWith('.md') && f !== 'index.md' && f !== 'keywords.md')
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort().reverse().slice(0, LOOKBACK_DAYS);
  } catch { return { hits, files: [] }; }
  for (const f of files) {
    const c = fs.readFileSync(path.join(DAILY_DIR, f), 'utf-8').toLowerCase();
    for (const [cat, kws] of Object.entries(KEYWORDS)) {
      const hits2 = kws.map(k => k.toLowerCase()).filter(kw => c.includes(kw));
      if (hits2.length > 0) hits[cat] += hits2.length;
}}
  return { hits, files };
}

function getAdvice(cat) {
  const m = {
    '\u97f3\u4e50\u7248\u6743': '\u53ef\u4ee5\u4ece\u7248\u6743\u65b9/\u53d1\u884c\u65b9/\u5e73\u53f0\u65b9\u4e09\u65b9\u5229\u76ca\u5173\u7cfb\u5207\u5165\uff0c\u7ed3\u5408\u7f51\u6613\u4e91\u5b9e\u8df5\u7ecf\u9a8c\u3002',
    '\u5143\u6570\u636e\u4e0eDDEX': '\u66f2\u5e93\u8fd0\u8425\u7684\u57fa\u7840\u8bbe\u65bd\uff0c\u5efa\u8bae\u4ece DDEX \u6807\u51c6\u4f53\u7cfb\u5165\u624b\u3002',
    'ISRC/UPC': '\u97f3\u4e50\u884c\u4e1a\u57fa\u7840\u7f16\u7801\u4f53\u7cfb\uff0c\u53ef\u6574\u7406\u4e00\u7bc7\u6807\u8bc6\u7b26\u901f\u67e5\u8868\u3002',
    '\u97f3\u4e50\u53d1\u884c': '\u53d1\u884c\u6e20\u9053\u6f14\u53d8\uff08\u7269\u7406->\u6570\u5b57->AI\uff09\uff0c\u53ef\u7ed3\u5408\u53d1\u884c\u65b9\u5de5\u4f5c\u7ecf\u9a8c\u3002',
    '\u97f3\u4e50\u5e73\u53f0': 'Spotify/Apple Music/\u817e\u8baf\u97f3\u4e50\u7b49\u5e73\u53f0\u7684\u5546\u4e1a\u6a21\u5f0f\u5bf9\u6bd4\u5206\u6790\u3002',
    'AI\u97f3\u4e50': 'AI\u751f\u6210\u97f3\u4e50\u5bf9\u7248\u6743\u3001\u53d1\u884c\u3001\u5e73\u53f0\u7684\u51b2\u51fb\uff0c\u96f7\u8fbe\u5df2\u6709\u5927\u91cf\u6848\u4f8b\u53ef\u53c2\u8003\u3002',
    '\u66f2\u5e93\u6cbb\u7406': '\u4f60\u7684\u4e3b\u6218\u573a\uff0c\u53ef\u4ece\u8d28\u68c0\u3001\u53bb\u91cd\u3001\u5143\u6570\u636e\u6807\u51c6\u5316\u7b49\u7ef4\u5ea6\u6df1\u5316\u6574\u7406\u3002',
    '\u7248\u7a0e\u7ed3\u7b97': '\u7248\u7a0e\u5206\u8d26\u4f53\u7cfb\u7684\u590d\u6742\u6027\uff0c\u53ef\u4ece\u884c\u653f\u9519\u8bef18\u5e74\u672a\u6536\u6b3e\u6848\u4f8b\u5207\u5165\u3002',
    '\u4e2d\u56fd\u97f3\u4e50\u5e02\u573a': 'TME vs \u7f51\u6613\u4e91 vs \u6c7d\u6c34\u97f3\u4e50\u7684\u4e09\u65b9\u683c\u5c40\u5206\u6790\u3002',
    '\u6f14\u51fa\u4e0e\u73b0\u573a': '\u7968\u52a1\u3001\u5de1\u6f14\u3001\u97f3\u4e50\u8282\u7684\u7ecf\u6d4e\u6a21\u578b\uff0c\u53ef\u4ece CTF \u516c\u5e73\u7968\u52a1\u6848\u4f8b\u5207\u5165\u3002',
  };
  return m[cat] || '\u5efa\u8bae\u4ece\u96f7\u8fbe\u65e5\u62a5\u5f15\u7528\u76f8\u5173\u6848\u4f8b\uff0c\u6574\u7406\u4e00\u7bc7\u5165\u95e8\u7b14\u8bb0\u3002';
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
  const range = rFiles.length > 0
    ? rFiles[rFiles.length-1].replace('.md','') + ' ~ ' + rFiles[0].replace('.md','')
    : '暂无数据';
  const totalKws = Object.values(KEYWORDS).flat().length;
  const allFiles = (personal.__all_files || []).length;

  var r = '';
r += '---\ntitle: 知识缺口报告\noutline: [2, 3]\n---\n\n';
r += '# 📋 知识缺口报告\n\n';
r += '> 生成时间: ' + dateStr + '\n';
r += '> 分析范围: ' + range + '（' + rFiles.length + '期行业雷达）\n';
r += '> 覆盖 ' + cats.length + ' 个分类 | ' + totalKws + ' 个关键词\n';
r += '> 扫描 ' + allFiles + ' 篇个人笔记\n\n---\n\n';

r += '## 🔥 高优先级缺口\n\n';
if (high.length === 0) r += '暂无。当前知识库覆盖跟上了行业动态。\n\n';
else {
  r += '> 这些话题在雷达中频繁出现，但你尚未系统整理。**建议优先补充**。\n\n';
  for (const g of high) {
    r += '### ' + g.cat + '\n';
    r += '- 雷达出现 **' + g.rc + '** 次（近' + LOOKBACK_DAYS + '天）\n';
    r += '- 个人笔记: 暂无\n';
    r += '- 建议: ' + getAdvice(g.cat) + '\n\n';
  }
}

r += '---\n\n## 🟡 中等优先级\n\n';
if (mid.length === 0) r += '暂无。\n\n';
else {
  for (const g of mid) {
    r += '- **' + g.cat + '** —— 雷达 ' + g.rc + ' 次，笔记 ' + g.pc + ' 篇';
    if (g.pf.length > 0) r += '（现有: ' + g.pf.join('、') + '）';
    r += '\n';
  }
  r += '\n';
}

r += '---\n\n## ✅ 覆盖良好\n\n';
const gf = good.filter(g => g.rc >= MIN_GAP_HITS);
if (gf.length === 0) r += '暂无。\n\n';
else {
  for (const g of gf) r += '- **' + g.cat + '** —— 雷达 ' + g.rc + ' 次 ↔ 笔记 ' + g.pc + ' 篇\n';
  r += '\n';
}

r += '---\n\n## 📊 全量覆盖一览\n\n';
r += '| 状态 | 领域 | 雷达频次 | 笔记篇数 | 相关文件 |\n';
r += '|------|------|---------|---------|---------|\n';
for (const g of gaps) {
  const s = g.pc >= 2 ? '✅' : g.pc >= 1 ? '⚠️' : '🔴';
  const files = g.pf.length > 0 ? g.pf.map(f => '`' + f + '`').join(' ') : '—';
  r += '| ' + s + ' | **' + g.cat + '** | ' + g.rc + ' | ' + g.pc + ' | ' + files + ' |\n';
}

r += '\n## 📎 参考日报\n\n| 日期 | 日报 |\n|------|------|\n';
for (const f of rFiles) {
  r += '| ' + f.replace('.md','') + ' | [查看](./' + f + ') |\n';
}

r += '\n> 💡 **提示**: 缺口报告只标记该领域你还没有系统笔记，不代表你必须写。决策权在你手上。\n';
r += '> 🔄 每周自动更新，由 `scripts/gap-detector.js` 生成。\n';
  return r;
}


function main() {
  console.log('[YUTATA Gap Detection v1]');
  console.log('Analyzing last ' + LOOKBACK_DAYS + ' days...');

  const radar = analyzeRadarReports();
  console.log('  Read ' + radar.files.length + ' reports');
  const sorted = Object.entries(radar.hits).sort((a, b) => b[1] - a[1]);
  for (const [cat, c] of sorted) {
    if (c > 0) console.log('  ' + cat + ': ' + c + ' hits');
  }

  console.log('');
  console.log('Scanning personal knowledge base...');
  const personal = scanPersonalContent();
  console.log('  Scanned ' + (personal.__all_files || []).length + ' notes');

  console.log('');
  console.log('Generating gap report...');
  const report = generateReport(radar, personal);
  fs.writeFileSync(OUTPUT_FILE, report, 'utf-8');
  console.log('Report saved: ' + path.relative(ROOT_DIR, OUTPUT_FILE));
  const highCount = (report.match(/^### /gm) || []).length;
  console.log('  High priority gaps: ' + highCount);
}

main();
