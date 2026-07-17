import sys
sys.stdout.reconfigure(encoding='utf-8')
lines = open('scripts/multi-agent-daily.js', 'r', encoding='utf-8').readlines()
print(f'Total lines: {len(lines)}')
# Find the relevant lines
for i, line in enumerate(lines):
    if 'var repSection' in line and '今日信誉分' in line:
        print(f'Line {i+1}: {repr(line[:120])}')
    if 'repSection += \"| \"' in line:
        print(f'Line {i+1}: {repr(line[:120])}')
    if 'old comment marker' in line.lower():
        print(f'Line {i+1}: {repr(line[:120])}')
    if 'repSection uses markdown' in line:
        print(f'Line {i+1}: {repr(line[:120])}')
