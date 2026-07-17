import sys
sys.stdout.reconfigure(encoding='utf-8')
content = open('scripts/multi-agent-daily.js', 'r', encoding='utf-8').read()
idx = content.find('var repSection')
snippet = content[idx:idx+100]
print('snippet length:', len(snippet))
for i in range(min(100, len(snippet))):
    c = snippet[i]
    if c == '\n':
        print(f'  {i}: NEWLINE')
    elif ord(c) == 92:  # backslash
        print(f'  {i}: BACKSLASH')
    elif c == 'n':
        print(f'  {i}: letter-n (after backslash?)')
    elif c == '\\"':
        print(f'  {i}: escaped-quote')
print()
print('Full repr:')
print(repr(snippet[:80]))
