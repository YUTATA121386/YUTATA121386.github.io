  const emojiMap = { collector: "📡", verifier: "🔍", analyst: "🔬", editor: "✍️", "memory-manager": "🧠" };
  const typeEmoji = { REJECT: "🚫", REQUEST: "📩", DISPUTE: "⚔️", NOTIFY: "📢", ESCALATE: "⚠️", CONFIRM: "✅", DIRECTIVE: "👑", APPROVE: "👍", GUIDANCE: "💡" };
  const msgsLog = state.messages.map(m => {
    const fn = AGENT_NAMES_CN[m.from] || m.from;
    const tn = AGENT_NAMES_CN[m.to] || m.to;
    const em = emojiMap[m.from] || "💬";
    const te = typeEmoji[m.type] || "💬";
    const time = m.timestamp ? m.timestamp.slice(11, 16) : "";
    var lines = [];
    lines.push('<div class="chat-msg chat-from-' + m.from + '">');
    lines.push('<div class="chat-header">' + em + ' <strong>' + fn + '</strong> → <strong>' + tn + '</strong> &nbsp; <code>' + te + ' ' + m.type + '</code> &nbsp; <small>' + time + '</small></div>');
    lines.push('<div class="chat-body">');
    lines.push('<blockquote>' + m.coreInfo.replace(/\n/g, "<br>") + '</blockquote>');
    if (m.expectedAction) lines.push('<p><strong>期望</strong>: ' + m.expectedAction + '</p>');
    if (m.reason) lines.push('<p><strong>理由</strong>: ' + m.reason + '</p>');
    lines.push('</div></div>');
    return lines.join("\n") + "\n\n";
  }).join("");