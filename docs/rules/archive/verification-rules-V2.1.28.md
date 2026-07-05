# verification-rules.md - V2.1.28
> 归档: 2026-07-05

---
title: verification-rules
version: V2.1.28
updated: 2026-07-05
outline: [2, 3]
---

> 📌 V2.1.28 | 2026年7月5日

## 审核进度通知合并规则
- 审核进度更新必须合并为单条消息发送，使用 `to: all` 格式
- 禁止将同一审核批次的结果拆分为多条NOTIFY发送（如MSG-VER-028、029、030、031应合并为一条）
- 对DISPUTE的回应和审核进度更新必须合并到同一消息中
- 违反此规则将触发信誉分扣减（单次-2）