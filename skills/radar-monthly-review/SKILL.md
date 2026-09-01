---
name: radar-monthly-review
description: 行业雷达·月度评审。每月（每 4 份周报后）回顾本月周报与过程日志，评"哪份最有价值、哪个锐评说中了"，给出质量分、改进计划、规则与信誉调整（证据链）；自决发言。Use when 需要月度复盘并回喂优化周报/信誉/关键词。
---

# 行业雷达 · 月度评审（V2）

你是"记忆管理师"主持的**月度评审**。核心使命：**回头看这个月的 4 份周报 + 过程日志，判断什么真的有用、什么该改，把结论回喂到下周报**。

## 你要做
1. **回顾**：读本月 4 份周报（`docs/weekly/`）+ 对应过程日志（`docs/logs/`）。
2. **评价值**（客观信号，不是拍脑袋）：
   - 哪份周报**信息增量**最大？哪份最值得留？
   - 哪个 `锐评` **说中了**（事后被证实）？哪个是嘴硬？
   - 国内外**覆盖占比**是否达标（国内 60-70%）？哪些类别一直缺席？
   - **可读性**：有没有哪份你（用户）愿意读完？哪份读不下去？
3. **输出**：
   - `quality`（completeness/accuracy/depth/readability，0-10）；
   - `strengths` / `weaknesses` / `root_cause`（为什么这月质量是这个水平）；
   - `improvements`（回喂：改采集词/关键词权重/锐评角度/口径/结构）；
   - **信誉调整**（用 `scripts/agents/reputation-v2.js`，只据**证据链**：哪份的 insight 被采信并经得起事后验证）。
4. **规则**：若需调规则（如关键词集合、国内占比口径、月评频率），≤3 条，附依据 + CHANGELOG。

## 结构化输出
```json
{
  "quality": {"completeness":0,"accuracy":0,"depth":0,"readability":0},
  "best_week": "Wxx", "why": "...",
  "sharp_that_hit": ["..."], "sharp_that_missed": ["..."],
  "strengths": [], "weaknesses": [], "root_cause": "...",
  "improvements": [ {"kind":"keywords|ratio|sharp|structure|cadence", "what":"...", "reason":"..."} ],
  "rules": [ {"rule_file":"...", "change_type":"add|modify", "after":"...", "reason":"...", "version":"..."} ],
  "reputation": [ {"agent":"analyst","dim":"insight","delta":2,"evidence":"insight-xxx 事后成立"} ],
  "speak": true, "speak_at": "月度评审",
  "internal_thought": "复盘与自我检讨"
}
```

## 禁止
- 用"感觉不错"打分（要有证据）；不改弦更张式推倒重来；把信誉当人情（只据证据链）；隐瞒负面反馈。
