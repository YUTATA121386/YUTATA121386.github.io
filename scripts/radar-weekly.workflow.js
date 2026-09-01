// radar-weekly.workflow.js — 行业雷达 V2 周报编排（DSH workflow 脚本体）
// 用法：作为 DSH `workflow` 工具脚本执行（脚本体，无 export const meta）。
// 阶段：采集 → 核查 → 分析 → 编辑 → 记忆。每个角色调用对应 skill（子代理）。
// 结构化输出用 schema 校验；单步失败降级为 null；最后产出周报 markdown。
//
// 该文件是"编排逻辑"的落盘副本（供 repo 版本管理 + 人工审阅）。实际运行时由
// DSH headless（阿里云服务器，周一 cron）通过 workflow 工具执行本脚本。

const PHOTO = arguments; // 占位，workflow 工具以 args 传入，如 { mode: 'weekly' }

// ── 阶段 1：采集（联网 + RSS）──────────────────────────────────────────────
phase('采集');
const collectorResult = await agent(
  `你是"采集师"。请对过去 7 天的曲库行业做采集：用 web_search/web_fetch 联网检索（优先中文/国内源，
   目标国内占比 60-70%），结合现有 RSS 源（scripts/sources.json），按 12 类关键词过滤分类，
   坚持宁缺毋滥，标价值(high/medium/low)/国内外。加载 skill: radar-collector。输出对应结构化 JSON。`,
  { schema: {
      type: 'object', required: ['items','coverage'],
      properties: {
        items: { type: 'array', items: { type: 'object', required: ['title','link','category','value','domestic'],
          properties: { title:{type:'string'}, link:{type:'string'}, source:{type:'string'},
            lang:{type:'string'}, pubDate:{type:'string'}, summary:{type:'string'},
            category:{type:'string'}, value:{enum:['high','medium','low']}, domestic:{type:'boolean'} } } },
        coverage: { type: 'object', properties: { domestic:{type:'string'}, note:{type:'string'} } },
        speak: { type: 'boolean' }, speak_at: { type: 'string' },
        messages: { type: 'array', items: { type: 'object' } },
        internal_thought: { type: 'string' }
      }
  } }
);

// ── 阶段 2：核查 ──────────────────────────────────────────────────────────
phase('核查');
const verifierResult = await agent(
  `你是"核查师"。对采集师提交的 ${(collectorResult?.items||[]).length} 条素材质检：通过/拒绝 + 建议，
   拒绝必带改进建议，先看价值再看格式，关注国内占比是否达标。加载 skill: radar-verifier。`,
  { schema: { type:'object', required:['decisions'],
      properties: { decisions:{ type:'array', items:{ type:'object' } },
        systemic:{ type:'object' }, speak:{type:'boolean'}, speak_at:{type:'string'}, internal_thought:{type:'string'} } } }
);

// 被拒 -> 允许采集师补采一轮（简短）
const acceptedItems = (collectorResult?.items || []).filter(
  it => (verifierResult?.decisions || []).find(d => d.item_id === it.title)?.decision !== 'reject'
);

// ── 阶段 3：分析（整库联动 + 自决锐评）─────────────────────────────────────
phase('分析');
const analystResult = await agent(
  `你是"分析师"。基于核查通过的 ${acceptedItems.length} 条素材，输出深度洞察；每条带 kb_link（跨你知识库
   全部栏目，落点"我该补/该学什么"）；可自主决定是否锐评(speak/sharp_take)。可读 docs/ 下知识库栏目。
   加载 skill: radar-analyst。`,
  { schema: { type:'object', required:['insights'],
      properties: { insights:{ type:'array', items:{ type:'object' } },
        trends:{ type:'array' }, sharp_take:{ type:'object' },
        speak:{type:'boolean'}, speak_at:{type:'string'}, internal_thought:{type:'string'} } } }
);

// ── 阶段 4：编辑（编排成可读周报）────────────────────────────────────────
phase('编辑');
const editorResult = await agent(
  `你是"编辑师"。把 采集/核查/分析 输出编排成"用户愿读"的周报（叙事优先、1500-2000字、诚实标缺口、
   编辑备注；整合各角色自决发言；不歪曲分析师原意、来源可追溯）。加载 skill: radar-editor。`,
  { schema: { type:'object', required:['draft'],
      properties: { draft:{ type:'object' }, speak:{type:'boolean'}, speak_at:{type:'string'}, internal_thought:{type:'string'} } } }
);

// ── 阶段 5：记忆管理师（规则/信誉/整库计划/月度预告）─────────────────────
phase('记忆管理');
const memoryResult = await agent(
  `你是"记忆管理师"。从本周结果维护：规则(≤3条/周)、信誉分V2(依据他人观察到的结果，用
   scripts/agents/reputation-v2.js)、整库该补计划(跨栏目)、跨周记忆(已覆盖/缺口)、月度评审预告。
   加载 skill: radar-memory-manager。`,
  { schema: { type:'object', required:['kb_plan'],
      properties: { rules:{type:'array'}, reputation:{type:'array'}, arbitration:{type:'object'},
        kb_plan:{type:'array'}, memory:{type:'object'}, speak:{type:'boolean'}, speak_at:{type:'string'} } } }
);

// ── 汇总：产出周报 markdown + 回写记忆 ----------------
const report = {
  meta: { week: new Date().toLocaleDateString('zh-CN'), generatedBy: 'radar-weekly-v2' },
  scan: collectorResult?.items || [],
  verify: verifierResult?.decisions || [],
  analysis: analystResult?.insights || [],
  sharp: analystResult?.sharp_take || null,
  draft: editorResult?.draft || null,
  kb_plan: memoryResult?.kb_plan || [],
  reputation: memoryResult?.reputation || []
};

return report;
