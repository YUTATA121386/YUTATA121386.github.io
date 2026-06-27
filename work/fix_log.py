path = r"C:\Users\beppi\Documents\Codex\YUTATA121386.github.io\scripts\multi-agent-daily.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the msgsLog section
start_marker = "const msgsLog = state.messages.map(m => {"
start_idx = content.find(start_marker)
end_search = content.find("}).join(", start_idx)
end_idx = content.find(";\n", end_search)
if end_idx == -1:
    end_idx = content.find("\n\n", end_search)

new_block = '  const emojiMap = { collector: "📡", verifier: "🔍", analyst: "🔬", editor: "✍️", "memory-manager": "🧠" };\n  const typeEmoji = { REJECT: "🚫", REQUEST: "📩", DISPUTE: "⚔️", NOTIFY: "📢", ESCALATE: "⚠️", CONFIRM: "✅", DIRECTIVE: "👑", APPROVE: "👍", GUIDANCE: "💡" };\n  const msgsLog = state.messages.map(m => {\n    const fn = AGENT_NAMES_CN[m.from] || m.from;\n    const tn = AGENT_NAMES_CN[m.to] || m.to;\n    const em = emojiMap[m.from] || "💬";\n    const te = typeEmoji[m.type] || "💬";\n    const time = m.timestamp ? m.timestamp.slice(11, 16) : "";\n    var lines = [];\n    lines.push(\'<div class="chat-msg chat-from-\' + m.from + \'">\');\n    lines.push(\'<div class="chat-header">\' + em + \' <strong>\' + fn + \'</strong> → <strong>\' + tn + \'</strong> &nbsp; <code>\' + te + \' \' + m.type + \'</code> &nbsp; <small>\' + time + \'</small></div>\');\n    lines.push(\'<div class="chat-body">\');\n    lines.push(\'<blockquote>\' + m.coreInfo.replace(/\\n/g, "<br>") + \'</blockquote>\');\n    if (m.expectedAction) lines.push(\'<p><strong>期望</strong>: \' + m.expectedAction + \'</p>\');\n    if (m.reason) lines.push(\'<p><strong>理由</strong>: \' + m.reason + \'</p>\');\n    lines.push(\'</div></div>\');\n    return lines.join("\\n") + "\\n\\n";\n  }).join("");'

content = content[:start_idx] + new_block + content[end_idx+2:]

# Insert CSS
css_block = '  var chatCSS = "<style>\\n.chat-msg { margin: 16px 0; padding: 12px 16px; border-radius: 8px; border-left: 4px solid #888; background: #f8f9fa; }\\n.chat-from-collector { border-left-color: #e74c3c; background: #fdf2f2; }\\n.chat-from-verifier { border-left-color: #2ecc71; background: #f0faf4; }\\n.chat-from-analyst { border-left-color: #3498db; background: #eef6fd; }\\n.chat-from-editor { border-left-color: #9b59b6; background: #f6f0fa; }\\n.chat-from-memory-manager { border-left-color: #f39c12; background: #fef9ee; }\\n.chat-header { font-size: 0.9em; margin-bottom: 8px; opacity: 0.85; }\\n.chat-body blockquote { margin: 8px 0; padding: 8px 12px; border-left: 3px solid #ccc; background: rgba(0,0,0,0.03); border-radius: 0 4px 4px 0; }\\n.dark .chat-msg { background: #1e1e1e; }\\n.dark .chat-from-collector { background: #2d1a1a; }\\n.dark .chat-from-verifier { background: #1a2d1a; }\\n.dark .chat-from-analyst { background: #1a1a2d; }\\n.dark .chat-from-editor { background: #2d1a2d; }\\n.dark .chat-from-memory-manager { background: #2d2a1a; }\\n.dark .chat-body blockquote { background: rgba(255,255,255,0.05); }\\n</style>\\n\\n";\n'

ret_marker = 'return "---'
ret_idx = content.find(ret_marker, content.find('generateProcessLog'))
if ret_idx > 0:
    content = content[:ret_idx] + css_block + content[ret_idx:]
    content = content.replace('return "---', 'return chatCSS + "---', 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(content)
print("Done")
