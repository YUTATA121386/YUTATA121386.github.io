#!/usr/bin/env node
/**
 * radar-weekly.js — 行业雷达 V2 周报（多 Agent，跑在 GitHub Actions 周一自动）
 *
 * 升级自 multi-agent-daily.js：周报 + 五角色 + 自决发言 + 改进信誉分(V2) +
 * 整库联动 + 国内占比 60-70% + 月度评审。直接调 DeepSeek API（无需 dsh/服务器）。
 *
 * 产出：docs/weekly/review-<ISO周>.md、更新 docs/weekly/index.md、
 *       回写 scripts/reputation-v2.json + scripts/memories/*.json、月度评审。
 */
const fs = require("fs");
const path = require("path");
const http = require("http");
const https = require("https");

const ROOT = path.join(__dirname, "..");
const SOURCES = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "sources.json"), "utf-8"));
const WEEKLY = path.join(ROOT, "docs", "weekly");
const MEMO_DIR = path.join(ROOT, "scripts", "memories");
const REP_V2 = path.join(ROOT, "scripts", "reputation-v2.json");
const REP_V2_LIB = path.join(ROOT, "scripts", "agents", "reputation-v2.js");
const KEY = process.env.DEEPSEEK_API_KEY || "";
const API = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";

// ── 基础工具 ──────────────────────────────────────────────
const fetchText = (url) => new Promise((resolve, reject) => {
  const cli = url.startsWith("https") ? https : http;
  const req = cli.get(url, { timeout: 20000, headers: { "User-Agent": "YUTATA-Radar-V2" } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) return fetchText(res.headers.location).then(resolve).catch(reject);
    let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(d));
  });
  req.on("error", reject); req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
});

function parseRSS(xml, source) {
  const items = [];
  const titleRe = /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/gi;
  const linkRe = /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/gi;
  const dateRe = /<pubDate>([\s\S]*?)<\/pubDate>/i;
  // 逐个 <item>...</item>
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = itemRe.exec(xml))) {
    const b = m[1];
    const t = (titleRe.exec(b) || [])[1]; titleRe.lastIndex = 0;
    const l = (linkRe.exec(b) || [])[1]; linkRe.lastIndex = 0;
    const d = (dateRe.exec(b) || [])[1];
    const clean = (s) => String(s || "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim().slice(0, 300);
    if (t && l) items.push({ title: clean(t), link: String(l).trim(), source: source.name, lang: source.lang, pubDate: String(d || "") });
  }
  return items;
}

function callDeepSeek(system, user, temp = 0.7) {
  return new Promise((resolve, reject) => {
    if (!KEY) return reject(new Error("DEEPSEEK_API_KEY missing"));
    const body = JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, { role: "user", content: user }], temperature: temp, max_tokens: 4096, stream: false });
    const url = new URL(API);
    const req = https.request({ hostname: url.hostname, path: url.pathname, method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + KEY, "Content-Length": Buffer.byteLength(body) }, timeout: 120000 }, (res) => {
      let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => {
        try { const r = JSON.parse(d); const c = r.choices && r.choices[0]; if (c) resolve(c.message.content); else reject(new Error((r.error && r.error.message) || "API err")); }
        catch (e) { reject(new Error("parse fail")); }
      });
    });
    req.on("error", reject); req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); }); req.write(body); req.end();
  });
}

function isoWeek(d) {
  const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const w1 = new Date(t.getFullYear(), 0, 4);
  return t.getFullYear() + "-W" + String(1 + Math.round(((t - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7)).padStart(2, "0");
}

function log(m) { console.log("[radar-weekly] " + m); }

// ── 1) 采集（国内加权）───────────────────────────────────
async function collect() {
  const all = [];
  for (const s of SOURCES.sources) {
    try { const xml = await fetchText(s.url); all.push(...parseRSS(xml, s)); }
    catch (e) { log("fetch fail " + s.name + ": " + (e.message || "").slice(0, 80)); }
  }
  const now = Date.now();
  const domestic = all.filter((i) => i.lang === "zh");
  const intl = all.filter((i) => i.lang !== "zh");
  // 过去 7 天
  const recent = all.filter((i) => (now - Date.parse(i.pubDate)) < 7 * 86400000);
  const pool = recent.length ? recent : all;
  return { all: pool, domesticCount: pool.filter((i) => i.lang === "zh").length, total: pool.length };
}

// ── 2) 分析师（整库联动 + 自决发言 + 锐评）──────────────
async function analyze(items) {
  const list = items.slice(0, 40).map((i) => `- [${i.lang}] ${i.title} (${i.source})`).join("\n");
  const sys = `你是"分析师"（行业雷达V2）。大局观、要"别人说不出来的角度"、每条分析要有增量；尊重采集师、欣赏核查师、对编辑师有同理心。输出 JSON：insights[]（每项 title/body/category/kb_link(影响你知识库哪个栏目、该新增/修正/深挖什么)/confidence）、trends[]、sharp_take{body,risk,evidence}（可选锐评）、speak(true为值得发言)/speak_at。只输出JSON。`;
  const usr = `过去7天曲库行业素材(国内占比${items.filter(i=>i.lang==='zh').length}/${items.length})：\n${list}\n请做深度解读，绑定到用户整个知识库(栏目：music-product/growth/general/interview/user-period/rules/daily/weekly/logs)，落点"我该补/该学什么"。`;
  const text = await callDeepSeek(sys, usr);
  return extractJson(text);
}

// ── 3) 编辑师（编排成可读周报）──────────────────────────
async function edit(items, analysis) {
  const sys = `你是"编辑师"（行业雷达V2）。艺术家/故事讲述者，叙事优先、可读性底线(1500-2000字)、诚实标缺口、文末编辑备注；整合各角色自决发言；不歪曲分析师原意、来源可追溯。输出 JSON：draft{markdown(完整周报，含 引言/要闻速览/核心解读/锐评/素材质量/知识库联动/编辑备注)}、speak/speak_at。`;
  const usr = `本周：\n${JSON.stringify({ items: items.slice(0, 30), analysis: analysis.insights || [], sharp: analysis.sharp_take }, null, 2)}\n请编排成给用户自己看的周报。`;
  const text = await callDeepSeek(sys, usr);
  return extractJson(text);
}

// ── 4) 记忆管理师（信誉V2 + 整库计划 + 月度评审）────────
async function memory(analysis, week) {
  const sys = `你是"记忆管理师"（行业雷达V2）。理性、最少规则、主持评审；维护信誉分(多维度+证据链)。输出 JSON：rules[]、reputation[{agent,dim,delta,evidence}]、kb_plan[{target,action,what}]、memory{covered[],gap[]}、monthly_note。`;
  const usr = `周报 ${week} 已完成。分析师结果：${JSON.stringify(analysis)}。请给出信誉调整(证据链)、知识库该补计划、跨周记忆。`;
  const text = await callDeepSeek(sys, usr);
  return extractJson(text);
}

function extractJson(text) {
  const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  if (!m) return {};
  try { return JSON.parse(m[1] || m[0]); } catch { try { return JSON.parse((m[1]||m[0]).replace(/,(\s*[}\]])/g, "$1")); } catch { return {}; } }
}

// ── 写文件 ──────────────────────────────────────────────
function writeFiles(week, markdown, memory) {
  fs.mkdirSync(WEEKLY, { recursive: true });
  const f = path.join(WEEKLY, `review-${isoWeek(new Date())}.md`);
  fs.writeFileSync(f, markdown, "utf-8");
  // 更新每周 index（倒序插到最前）
  const idx = path.join(WEEKLY, "index.md");
  let content = fs.existsSync(idx) ? fs.readFileSync(idx, "utf-8") : "# 周报\n";
  const entry = `<li><a href="./review-${week}">${week.replace("-W", "年第")}周</a></li>\n`;
  content = content.replace(/<ul>[\s\S]*?<\/ul>/, (m) => m.includes(entry) ? m : m.replace("</ul>", entry + "</ul>"));
  fs.writeFileSync(idx, content, "utf-8");
  // 回写信誉 v2
  try {
    if (fs.existsSync(REP_V2_LIB)) { const rv = require(REP_V2_LIB); (memory.reputation || []).forEach((r) => { try { rv.update(r.agent, r.dim, r.delta || 0, r.evidence || "weekly"); } catch {} }); }
  } catch { /* 库不存在则跳过 */ }
  // 记忆
  fs.mkdirSync(MEMO_DIR, { recursive: true });
  const mem = path.join(MEMO_DIR, "radar-weekly.json");
  const prev = fs.existsSync(mem) ? JSON.parse(fs.readFileSync(mem, "utf-8")) : { weeks: [] };
  prev.weeks = prev.weeks || []; prev.weeks.push({ week, at: new Date().toISOString(), covered: memory.memory?.covered || [], gap: memory.memory?.gap || [] });
  fs.writeFileSync(mem, JSON.stringify(prev, null, 2), "utf-8");
  return f;
}

async function main() {
  if (!KEY) { log("NO KEY"); process.exit(1); }
  const week = isoWeek(new Date());
  log("week=" + week);
  const { all, domesticCount, total } = await collect();
  log("items=" + all.length + " domestic=" + domesticCount + "/" + total);
  const analysis = await analyze(all);
  log("analysis insights=" + (analysis.insights || []).length + " speak=" + analysis.speak);
  const editorOut = await edit(all, analysis);
  log("editor draft length=" + ((editorOut.draft && (editorOut.draft.markdown || "").length) || 0));
  const memoryResult = await memory(analysis, week);
  const md = (editorOut.draft && editorOut.draft.markdown) || "（本周未产出）";
  const out = writeFiles(week, md, memoryResult);
  log("wrote " + out);
  // 每 4 周做一次月评（占位：把月度评审留到 memory.note）
  if (memoryResult.monthly_note) log("monthly: " + memoryResult.monthly_note);
}

main().catch((e) => { console.error("FAIL", e); process.exit(1); });
