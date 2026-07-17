import sys
sys.stdout.reconfigure(encoding='utf-8')
lines = open('scripts/multi-agent-daily.js', 'r', encoding='utf-8').readlines()

# Line 1290 (index 1289): Replace markdown table header with HTML table
lines[1289] = '        var repSection = \"\\n\\n## 📊 今日信誉分变化\\n\\n<table style=\\\"width:100%;table-layout:fixed;border-collapse:collapse;font-size:0.9em;\\\">\\n<thead><tr>\\n<th style=\\\"width:80px;text-align:left;padding:6px 8px;border-bottom:2px solid var(--vp-c-divider);\\\">角色</th>\\n<th style=\\\"width:50px;text-align:center;padding:6px 8px;border-bottom:2px solid var(--vp-c-divider);\\\">分数</th>\\n<th style=\\\"width:50px;text-align:center;padding:6px 8px;border-bottom:2px solid var(--vp-c-divider);\\\">变化</th>\\n<th style=\\\"padding:6px 8px;border-bottom:2px solid var(--vp-c-divider);word-break:break-word;\\\">原因</th>\\n</tr></thead>\\n<tbody>\\n\";\n'

# Line 1300 (index 1299): Replace markdown row with HTML tr
lines[1299] = '          repSection += \"<tr><td style=\\\"padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);font-weight:600;\\\">\" + (agentNames[aid] || aid) + \"</td><td style=\\\"padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;\\\">\" + score + \"</td><td style=\\\"padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;\\\">\" + delta + \"</td><td style=\\\"padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);word-break:break-word;line-height:1.4;\\\">\" + reason + \"</td></tr>\\n\";\n'

# Line 1302 (index 1301): Replace comment with closing tbody+table
lines[1301] = '        repSection += \"</tbody></table>\\n\";\n'

open('scripts/multi-agent-daily.js', 'w', encoding='utf-8').write(''.join(lines))
print('OK - lines 1290, 1300, 1302 replaced!')
# Verify
for line in open('scripts/multi-agent-daily.js', 'r', encoding='utf-8').readlines()[1288:1303]:
    print(repr(line[:100]))
