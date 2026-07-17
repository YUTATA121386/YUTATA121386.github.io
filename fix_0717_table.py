import sys, re
sys.stdout.reconfigure(encoding='utf-8')
content = open('docs/daily/2026-07-17.md', 'r', encoding='utf-8').read()

# Find the markdown table for reputation changes
old_table = """## 📊 今日信誉分变化

| 角色 | 分数 | 变化 | 原因 |
|------|:----:|:----:|------|
| 采集师 | 62 | -5 | 第一轮40条素材仅通过4条（通过率10%），其中36条与核心领域完全无关。这是连续多日对'核心领域'理解偏差的最高峰，需要最高幅度处罚以传递明确信号。但补采阶段15条100%通过，说明能力合格，问题出在规则清晰度。 |
| 核查师 | 92 | +2 | 预警及时且专业：在通过率10%时果断发出HIGH级别NOTIFY，使全团队第一时间了解危机。同时，在采集师改善后第一时间返还信誉分，激励了正向行为。预警与返还的完整闭环是今日纠偏成功的关键。 |
| 分析师 | 98 | +1 | 在仅14条素材的基础上产出了5条深度insight，覆盖三条主线+跨日趋势追踪。Suno争议的'侵权vs.合规化'观点冲突为日报提供了核心内容张力。补采请求方向明确，但命中率有待提升（DDEX成本数据连续两天未满足）。 |
| 编辑师 | 88 | +3 | 在素材基础极度薄弱（一度仅4条通过）的困境下，产出了结构完整、逻辑清晰、可读性强的日报。定稿1650字，三条深度解读+趋势观察+冷知识+实操建议，对素材缺口的诚实标注体现了专业操守。 |
| 记忆管理师 | 61 | — | — |"""

new_table = """## 📊 今日信誉分变化

<table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:0.9em;">
<thead><tr>
<th style="width:80px;text-align:left;padding:6px 8px;border-bottom:2px solid var(--vp-c-divider);">角色</th>
<th style="width:50px;text-align:center;padding:6px 8px;border-bottom:2px solid var(--vp-c-divider);">分数</th>
<th style="width:50px;text-align:center;padding:6px 8px;border-bottom:2px solid var(--vp-c-divider);">变化</th>
<th style="padding:6px 8px;border-bottom:2px solid var(--vp-c-divider);word-break:break-word;">原因</th>
</tr></thead>
<tbody>
<tr><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);font-weight:600;">采集师</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;">62</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;">-5</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);word-break:break-word;line-height:1.4;">第一轮40条素材仅通过4条（通过率10%），其中36条与核心领域完全无关。这是连续多日对'核心领域'理解偏差的最高峰，需要最高幅度处罚以传递明确信号。但补采阶段15条100%通过，说明能力合格，问题出在规则清晰度。</td></tr>
<tr><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);font-weight:600;">核查师</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;">92</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;">+2</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);word-break:break-word;line-height:1.4;">预警及时且专业：在通过率10%时果断发出HIGH级别NOTIFY，使全团队第一时间了解危机。同时，在采集师改善后第一时间返还信誉分，激励了正向行为。预警与返还的完整闭环是今日纠偏成功的关键。</td></tr>
<tr><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);font-weight:600;">分析师</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;">98</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;">+1</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);word-break:break-word;line-height:1.4;">在仅14条素材的基础上产出了5条深度insight，覆盖三条主线+跨日趋势追踪。Suno争议的'侵权vs.合规化'观点冲突为日报提供了核心内容张力。补采请求方向明确，但命中率有待提升（DDEX成本数据连续两天未满足）。</td></tr>
<tr><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);font-weight:600;">编辑师</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;">88</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;">+3</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);word-break:break-word;line-height:1.4;">在素材基础极度薄弱（一度仅4条通过）的困境下，产出了结构完整、逻辑清晰、可读性强的日报。定稿1650字，三条深度解读+趋势观察+冷知识+实操建议，对素材缺口的诚实标注体现了专业操守。</td></tr>
<tr><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);font-weight:600;">记忆管理师</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;">61</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;">—</td><td style="padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);word-break:break-word;line-height:1.4;">—</td></tr>
</tbody>
</table>"""

if old_table in content:
    print('Found old table, replacing...')
    content = content.replace(old_table, new_table)
    open('docs/daily/2026-07-17.md', 'w', encoding='utf-8').write(content)
    print('Done!')
else:
    print('Old table not found!')
    # Try to find it with partial match
    idx = content.find('今日信誉分变化')
    print(f'Found at {idx}:')
    print(repr(content[idx:idx+800]))
