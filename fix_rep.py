import re
content = open('scripts/multi-agent-daily.js', 'r', encoding='utf-8').read()

# 1. markdown table -> HTML table
old1 = 'var repSection = "\n\n## \U0001f4ca \u4eca\u65e5\u4fe1\u8a89\u5206\u53d8\u5316\n\n| \u89d2\u8272 | \u5206\u6570 | \u53d8\u5316 | \u539f\u56e0 |\n|------|:----:|:----:|------|\n";'

new1 = 'var repSection = "\n\n## \U0001f4ca \u4eca\u65e5\u4fe1\u8a89\u5206\u53d8\u5316\n\n<table style=\"width:100%;table-layout:fixed;border-collapse:collapse;font-size:0.9em;\">\n<thead><tr>\n<th style=\"width:80px;text-align:left;padding:6px 8px;border-bottom:2px solid var(--vp-c-divider);\">\u89d2\u8272</th>\n<th style=\"width:50px;text-align:center;padding:6px 8px;border-bottom:2px solid var(--vp-c-divider);\">\u5206\u6570</th>\n<th style=\"width:50px;text-align:center;padding:6px 8px;border-bottom:2px solid var(--vp-c-divider);\">\u53d8\u5316</th>\n<th style=\"padding:6px 8px;border-bottom:2px solid var(--vp-c-divider);word-break:break-word;\">\u539f\u56e0</th>\n</tr></thead>\n<tbody>\n";'

assert old1 in content, 'old1 not found'
content = content.replace(old1, new1)

# 2. markdown row -> HTML row
old2 = 'repSection += "| " + (agentNames[aid] || aid) + " | " + score + " | " + delta + " | " + reason + " |\n";'
new2 = 'repSection += "<tr><td style=\"padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);font-weight:600;\">" + (agentNames[aid] || aid) + "</td><td style=\"padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;\">" + score + "</td><td style=\"padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);text-align:center;\">" + delta + "</td><td style=\"padding:6px 8px;border-bottom:1px solid var(--vp-c-divider);word-break:break-word;line-height:1.4;\">" + reason + "</td></tr>\n";'

assert old2 in content, 'old2 not found'
content = content.replace(old2, new2)

# 3. comment -> close tags
old3 = '// repSection uses markdown table above; style block removed (broken HTML/Vue)'
new3 = 'repSection += "</tbody></table>\n";'
assert old3 in content, 'old3 not found'
content = content.replace(old3, new3)

open('scripts/multi-agent-daily.js', 'w', encoding='utf-8').write(content)
print('OK')
