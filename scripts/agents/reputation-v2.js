// reputation-v2.js — 改进版信誉分
// 多维度 + 证据链 + 衰减 + 采信度权重。独立模块，兼容现有 Node 管线，DSH agent 可读写。
// 用法见文件尾 DEV 自测（node scripts/agents/reputation-v2.js --demo）。
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const STORE = path.join(ROOT, 'scripts', 'reputation-v2.json');
const LEGACY = path.join(ROOT, 'scripts', 'reputation.json');   // 旧单维，仅用于初始迁移

const ROLES = ['collector', 'verifier', 'analyst', 'editor', 'memory-manager'];
const DIMS = {
  collector: ['value', 'diversity', 'precision'],
  verifier: ['discernment', 'coach', 'fairness'],
  analyst: ['insight', 'validity', 'cross_kb'],
  editor: ['readability', 'fidelity', 'edit_intent'],
  'memory-manager': ['rule_benefit', 'arb_fair', 'stability']
};
const BASE = 80;                 // 每个维度基准分
const HALF_LIFE_WEEKS = 8;       // 衰减半衰期（周）
const WATCH_N = 5;               // 每个维度保留的近期变更数

function defaultStore() {
  const store = { version: 2, updatedAt: null, roles: {} };
  ROLES.forEach(r => {
    store.roles[r] = {};
    DIMS[r].forEach(d => {
      store.roles[r][d] = { score: BASE, watch: [], updatedAt: null };
    });
  });
  return store;
}

// 尝试从旧 reputation.json 迁移单维 score 作为各维度初始值（无则用 BASE）
function migrateLegacy(store) {
  try {
    const legacy = JSON.parse(fs.readFileSync(LEGACY, 'utf-8'));
    ROLES.forEach(r => {
      const lv = legacy[r] && typeof legacy[r].score === 'number' ? legacy[r].score : BASE;
      DIMS[r].forEach(d => { store.roles[r][d].score = lv; });
    });
  } catch { /* 无旧档，保持 BASE */ }
  return store;
}

function load() {
  try { return JSON.parse(fs.readFileSync(STORE, 'utf-8')); }
  catch { return migrateLegacy(defaultStore()); }
}

function save(store) {
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(STORE, JSON.stringify(store, null, 2), 'utf-8');
}

// 衰减权重：越久远权重越低（半衰期 HALF_LIFE_WEEKS 周）
function decayWeight(ageDays) {
  return Math.pow(0.5, ageDays / (HALF_LIFE_WEEKS * 7));
}

function todayKey() { const d = new Date(); return d.toISOString().slice(0, 10); }

// 更新一个角色的一个维度：绑定证据、去重（当天同证据）、衰减、夹紧 0-100、维护 watch
function update(role, dim, delta, evidence, atDate) {
  if (!ROLES.includes(role) || !DIMS[role].includes(dim)) {
    throw new Error(`bad role/dim: ${role}/${dim}`);
  }
  const store = load();
  const dimState = store.roles[role][dim];
  const date = atDate || todayKey();

  // 去重：当天同一证据只算一次
  const dup = dimState.watch.find(w => w.date === date && w.evidence === evidence);
  if (dup) return dimState.score;

  // 引入衰减：把该维度的"有效历史分"重算 = 基础分 + 各次调整的衰减和
  let effective = BASE;
  dimState.watch.forEach(w => {
    const days = Math.max(0, (Date.now() - Date.parse(w.date)) / 86400000);
    effective += w.delta * decayWeight(days);
  });
  effective = Math.max(0, Math.min(100, effective + delta));

  dimState.score = Math.round(effective);
  dimState.watch.push({ date, delta, evidence, scoreAfter: dimState.score });
  if (dimState.watch.length > WATCH_N) dimState.watch = dimState.watch.slice(-WATCH_N);
  dimState.updatedAt = new Date().toISOString();
  save(store);
  return dimState.score;
}

// 采信度权重：由角色各维度均分换算成 0.6..2.0，用于"该角色声音在最终稿的采信/前置程度"
function trustWeight(role) {
  const store = load();
  const dims = DIMS[role];
  let sum = 0; dims.forEach(d => { sum += store.roles[role][d].score; });
  const avg = sum / dims.length;
  return 0.6 + (avg / 100) * 1.4;
}

// 组合权重：几个维度加权得到某角色的"综合采信度"
function trustWeightCombined(role, weights) {
  const store = load();
  const dims = DIMS[role];
  let sum = 0, wSum = 0;
  dims.forEach(d => {
    const w = (weights && weights[d]) || 1;
    sum += store.roles[role][d].score * w;
    wSum += w;
  });
  const avg = wSum ? sum / wSum : BASE;
  return 0.6 + (avg / 100) * 1.4;
}

module.exports = { load, save, update, trustWeight, trustWeightCombined, ROLES, DIMS, defaultStore };

// ---- DEV 自测：node scripts/agents/reputation-v2.js --demo ----
if (require.main === module && process.argv.includes('--demo')) {
  const rep = defaultStore();
  console.log('初始 collector.value =', rep.roles.collector.value.score);
  const s = update('analyst', 'insight', 8, 'evidence:insight-A-used-in-week-report', '2026-09-07');
  console.log('analyst.insight after +8 =', s, 'trustWeight=', trustWeight('analyst').toFixed(2));
  const s2 = update('analyst', 'insight', 8, 'evidence:insight-A-used-in-week-report', '2026-09-07'); // 同证据去重
  console.log('dup same evidence (should stay) =', s2);
  console.log(JSON.stringify(load().roles.analyst.insight.watch, null, 2));
}
