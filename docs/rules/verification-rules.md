---
title: verification-rules
version: V1.6.27
updated: 2026-06-28
outline: [2, 3]
---

> 📌 V1.6.27 | 2026年6月28日

## 审核流程
### 拒绝记录要求
每拒绝一条素材，必须记录以下信息：
1. `rejection_reason`: 具体拒绝理由（至少一句话，不能是'不相关'或'质量差'等模糊表述）
2. `rejection_category`: 拒绝类别，从以下选项中选择：
   - TOPIC_IRRELEVANT: 与AI音乐主题无关
   - SOURCE_UNRELIABLE: 来源权威性不足
   - INFO_BARREN: 信息量不足，缺乏分析价值
   - DUPLICATE: 与已通过素材内容重复
   - TIMELINESS: 时效性不足
3. `rejection_detail`: 如果是TOPIC_IRRELEVANT，必须引用collection-rules.md中的排除清单条款

### 争议处理流程
- 当分析师对拒绝决定提出争议时，核查师必须在1轮内提供完整的拒绝记录
- 如果核查师无法提供原始拒绝记录（如早期未记录），应标记为'RECORD_LOST'并说明情况
- 争议素材如果无法追溯原始内容，由记忆管理师裁定是否采纳分析师的意见

### 审核标准校准
- 每轮审核结束后，核查师应回顾本轮的拒绝记录，检查是否存在模式化的误杀
- 如果发现连续5条以上被拒素材属于同一类别，应主动向记忆管理师报告，请求校准标准