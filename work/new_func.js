function generateProcessLog(state, dateStr) {
  var dateCN = new Date(dateStr).getFullYear() + "年" + (new Date(dateStr).getMonth() + 1) + "月" + new Date(dateStr).getDate() + "日";
  var pr = state.stats.collectorSubmitted > 0 ? ((state.stats.verifierPassed / state.stats.collectorSubmitted) * 100).toFixed(1) : "0";

  // CSS for chat dialog
  var c = "<style>\n" +
    ".chat-log { max-width: 860px; margin: 0 auto; }\n" +
    ".chat-msg { display: flex; gap: 12px; margin: 0 0 1px 0; padding: 14px 16px; transition: background 0.15s; border-radius: 6px; }\n" +
    ".chat-msg:hover { background: rgba(0,0,0,0.02); }\n" +
    ".chat-avatar { flex-shrink: 0; width: 38px; height: 38px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; }\n" +
    ".chat-from-collector .chat-avatar { background: #fde8e8; }\n" +
    ".chat-from-verifier .chat-avatar { background: #e6f9ed; }\n" +
    ".chat-from-analyst .chat-avatar { background: #e3f0fc; }\n" +
    ".chat-from-editor .chat-avatar { background: #f3eafa; }\n" +
    ".chat-from-memory-manager .chat-avatar { background: #fef3d5; }\n" +
    ".chat-content { flex: 1; min-width: 0; }\n" +
    ".chat-meta { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 0.85em; flex-wrap: wrap; }\n" +
    ".chat-sender { font-weight: 600; }\n" +
    ".chat-from-collector .chat-sender { color: #c0392b; }\n" +
    ".chat-from-verifier .chat-sender { color: #1e8449; }\n" +
    ".chat-from-analyst .chat-sender { color: #2471a3; }\n" +
    ".chat-from-editor .chat-sender { color: #7d3c98; }\n" +
    ".chat-from-memory-manager .chat-sender { color: #b7950b; }\n" +
    ".chat-badge { display: inline-block; padding: 1px 7px; border-radius: 3px; font-size: 0.75em; font-weight: 500; background: #eee; color: #555; white-space: nowrap; }\n" +
    ".chat-time { color: #999; font-size: 0.8em; margin-left: auto; }\n" +
    ".chat-body { font-size: 0.93em; line-height: 1.6; color: #333; }\n" +
    ".chat-body blockquote { margin: 4px 0 0 0; padding: 2px 0 2px 10px; border-left: 2px solid #ddd; color: #555; }\n" +
    ".chat-footer { margin-top: 6px; font-size: 0.8em; color: #888; display: flex; gap: 12px; flex-wrap: wrap; }\n" +
    ".arb-anchor { display: inline-block; padding: 1px 8px; border-radius: 3px; font-size: 0.8em; background: #fdebd0; color: #b7950b; text-decoration: none; font-weight: 600; }\n" +
    ".dark .chat-msg:hover { background: rgba(255,255,255,0.03); }\n" +
    ".dark .chat-from-collector .chat-avatar { background: #3d1a1a; }\n" +
    ".dark .chat-from-verifier .chat-avatar { background: #1a3d1a; }\n" +
    ".dark .chat-from-analyst .chat-avatar { background: #1a1a3d; }\n" +
    ".dark .chat-from-editor .chat-avatar { background: #3d1a3d; }\n" +
    ".dark .chat-from-memory-manager .chat-avatar { background: #3d3a1a; }\n" +
    ".dark .chat-from-collector .chat-sender { color: #e74c3c; }\n" +
    ".dark .chat-from-verifier .chat-sender { color: #2ecc71; }\n" +
    ".dark .chat-from-analyst .chat-sender { color: #3498db; }\n" +
    ".dark .chat-from-editor .chat-sender { color: #a569bd; }\n" +
    ".dark .chat-from-memory-manager .chat-sender { color: #f1c40f; }\n" +
    ".dark .chat-body { color: #ccc; }\n" +
    ".dark .chat-badge { background: #333; color: #aaa; }\n" +
    ".dark .chat-body blockquote { border-left-color: #444; color: #999; }\n" +
    ".dark .chat-footer { color: #777; }\n" +
    ".dark .arb-anchor { background: #3d3500; }\n" +
    "</style>\n\n";

  // Type labels
  var tL = { REJECT: "\ud83d\udeab \u6253\u56de", REQUEST: "\ud83d\udce9 \u8bf7\u6c42", DISPUTE: "\u2694\ufe0f \u8d28\u7591", NOTIFY: "\ud83d\udce2 \u901a\u77e5", ESCALATE: "\u26a0\ufe0f \u5347\u7ea7", CONFIRM: "\u2705 \u786e\u8ba4", DIRECTIVE: "\ud83d\udc51 \u6307\u4ee4", APPROVE: "\ud83d\udc4d \u6279\u51c6", GUIDANCE: "\ud83d\udca1 \u6307\u5bfc", PRIORITY_OVERRIDE: "\u26a1 \u7d27\u6025" };
  var avatars = { collector: "\ud83d\udce1", verifier: "\ud83d\udd0d", analyst: "\ud83d\udd2c", editor: "\u270d\ufe0f", "memory-manager": "\ud83e\udde0" };

  // Messages
  var msgs = '<div class="chat-log">\n';
  var hasArb = !!state.arbitration;
  var arbLinked = false;

  state.messages.forEach(function(m, mi) {
    var fn = AGENT_NAMES_CN[m.from] || m.from;
    var tn = AGENT_NAMES_CN[m.to] || m.to;
    var av = avatars[m.from] || "\ud83d\udcac";
    var tl = tL[m.type] || m.type;
    var time = m.timestamp ? m.timestamp.slice(11, 16) : "";

    msgs += '<div class="chat-msg chat-from-' + m.from + '" id="msg-' + mi + '">\n';
    msgs += '<div class="chat-avatar">' + av + '</div>\n';
    msgs += '<div class="chat-content">\n';
    msgs += '<div class="chat-meta">\n';
    msgs += '<span class="chat-sender">' + fn + '</span>\n';
    msgs += '<span class="chat-badge">' + tl + '</span>\n';
    msgs += '<span style="opacity:0.6">\u2192 ' + tn + '</span>\n';

    if (hasArb && !arbLinked && (m.type === "ESCALATE" || (m.type === "REJECT" && mi > state.messages.length * 0.55))) {
      msgs += '<a href="#arbitration" class="arb-anchor">\u2696\ufe0f \u4ef2\u88c1\u8bb0\u5f55</a>\n';
      arbLinked = true;
    }

    msgs += '<span class="chat-time">' + time + '</span>\n';
    msgs += '</div>\n';
    msgs += '<div class="chat-body">\n';

    var cleanText = m.coreInfo
      .replace(/RAW-\d{4}-\d{2}-\d{2}-\d{4}/g, "\u3010\u7d20\u6750\u3011")
      .replace(/MSG-[A-Z]{3}-\d{4}-\d{2}-\d{2}-\d{3}/g, "\u3010\u6d88\u606f\u3011")
      .replace(/REQ-[A-Z]{3}-\d{4}-\d{2}-\d{2}-\d{3}/g, "\u3010\u8bf7\u6c42\u3011")
      .replace(/INS-\d{4}-\d{2}-\d{2}-\d{3}/g, "\u3010\u6d1e\u5bdf\u3011")
      .replace(/%/g, "\uff05");

    msgs += '<blockquote>' + cleanText.replace(/\n/g, '<br>') + '</blockquote>\n';
    msgs += '</div>\n';

    if (m.expectedAction || m.reason) {
      msgs += '<div class="chat-footer">\n';
      if (m.expectedAction) msgs += '<span>\ud83c\udfaf ' + m.expectedAction + '</span>\n';
      if (m.reason) msgs += '<span>\ud83d\udcdd ' + m.reason + '</span>\n';
      msgs += '</div>\n';
    }

    msgs += '</div></div>\n\n';
  });
  msgs += '</div>\n';

  // Arbitration
  var arb = "";
  if (state.arbitration && state.arbitration.verdict) {
    arb = '\n---\n\n## \u2696\ufe0f \u4ef2\u88c1\u8bb0\u5f55 <a id="arbitration"></a>\n\n';
    var vd = state.arbitration.verdict;
    
    if (state.arbitration.rounds[0] && state.arbitration.rounds[0].result && state.arbitration.rounds[0].result.fact_list) {
      arb += '### \u521d\u5ba1 \u00b7 \u4e8b\u5b9e\u6e05\u5355\n\n';
      state.arbitration.rounds[0].result.fact_list.forEach(function(f) { arb += '- ' + f + '\n'; });
      arb += '\n';
    }
    
    if (state.arbitration.rounds[1] && state.arbitration.rounds[1].result && state.arbitration.rounds[1].result.positions) {
      arb += '### \u590d\u5ba1 \u00b7 \u5404\u65b9\u89c2\u70b9\n\n';
      for (var pk in state.arbitration.rounds[1].result.positions) {
        arb += '**' + (AGENT_NAMES_CN[pk] || pk) + '**\uff1a' + state.arbitration.rounds[1].result.positions[pk] + '\n\n';
      }
    }
    
    arb += '### \u7ec8\u5ba1 \u00b7 \u88c1\u51b3\n\n';
    if (vd.summary) arb += '> **\u4e89\u8bae\u6458\u8981**\uff1a' + vd.summary + '\n>\n';
    if (vd.decision) arb += '> **\u88c1\u51b3\u7ed3\u679c**\uff1a' + vd.decision + '\n>\n';
    if (vd.action_items && vd.action_items.length) {
      arb += '> **\u6267\u884c\u6b65\u9aa4**\uff1a\n';
      vd.action_items.forEach(function(a) { arb += '> - ' + a + '\n'; });
      arb += '>\n';
    }
    if (vd.rule_changes && vd.rule_changes.length) {
      arb += '> **\u89c4\u5219\u53d8\u66f4**\uff1a\n';
      vd.rule_changes.forEach(function(r) { 
        arb += '> - ' + (typeof r === "string" ? r : (r.reason || r.file || JSON.stringify(r))) + '\n';
      });
    }
    arb += '\n';
  }

  // Emergency
  var emerg = "";
  if (state.emergencyChannel) {
    emerg = '\n---\n\n## \u26a1 \u7d27\u6025\u901a\u9053\n\n- \u89e6\u53d1\uff1a' + (state.emergencyChannel.triggered_by || "\u672a\u77e5") + ' | ' + (state.emergencyChannel.topic || "\u672a\u77e5") + '\n';
  }

  return c +
    "---\ntitle: " + dateStr + " | \u56e2\u961f\u8fc7\u7a0b\u65e5\u5fd7\noutline: [2, 3]\n---\n\n" +
    "# \ud83d\udccb \u56e2\u961f\u8fc7\u7a0b\u65e5\u5fd7 \u00b7 " + dateCN + "\n\n" +
    "## \ud83d\udcca \u4eca\u65e5\u7edf\u8ba1\n\n" +
    "| \u6307\u6807 | \u6570\u636e |\n|------|------|\n" +
    "| \u603b\u8f6e\u6b21 | " + state.round + " (" + (state.deadlockDetected ? "\u5df2\u89e6\u53d1\u4ef2\u88c1" : "\u6b63\u5e38\u6d41\u7a0b") + ") |\n" +
    "| \u91c7\u96c6\u63d0\u4ea4 | " + state.stats.collectorSubmitted + " \u6761 |\n" +
    "| \u6838\u67e5\u901a\u8fc7 | " + state.stats.verifierPassed + " \u6761\uff08\u901a\u8fc7\u7387 " + pr + "%\uff09 |\n" +
    "| \u6838\u67e5\u62d2\u7edd | " + state.stats.verifierRejected + " \u6761 |\n" +
    "| \u8865\u91c7\u8bf7\u6c42 | " + state.stats.analystRequests + " \u6b21 |\n" +
    "| \u7d27\u6025\u901a\u9053 | " + (state.emergencyChannel ? "\u5df2\u89e6\u53d1" : "\u672a\u89e6\u53d1") + " |\n" +
    "| \u89c4\u5219\u53d8\u66f4 | " + (state.stats.ruleChanges || 0) + " \u6761 |\n\n" +
    emerg +
    "## \ud83d\udcac \u5b8c\u6574\u901a\u4fe1\u8bb0\u5f55\n\n" + msgs + "\n" +
    arb +
    "\n---\n> \u751f\u6210\u65f6\u95f4: " + new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + "\n";
}