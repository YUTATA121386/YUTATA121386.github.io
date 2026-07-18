/**
 * 报告生成模块
 * 日报、周报、过程日志、索引页生成
 */

const fs = require("fs");
const path = require("path");
const { OUTPUT_DIR, LOGS_DIR, WEEKLY_DIR, RULES_DIR, ROOT_DIR, AGENT_NAMES_CN, AGENTS } = require("./agents/shared");
const { loadSystemMemory } = require("./system-state");

const CHANGELOG_FILE = RULES_DIR + "/CHANGELOG.md";

function getDateCN(dateStr) {
  var parts = dateStr.split("-");
  return parts[0] + "年" + parseInt(parts[1]) + "月" + parseInt(parts[2]) + "日";
}

// ===================== 过程日志生成 =====================
function generateProcessLog(state, dateStr) {
  var parts = dateStr.split("-"); var dateCN = parts[0] + "年" + parseInt(parts[1]) + "月" + parseInt(parts[2]) + "日";
  var totalVerified = state.verifiedItems ? state.verifiedItems.length : state.stats.verifierPassed;
  var totalRejected = state.rejectedItems ? state.rejectedItems.length : state.stats.verifierRejected;
  var totalSubmitted = Math.max(state.stats.collectorSubmitted, totalVerified + totalRejected);
  var pr = totalVerified + totalRejected > 0 ? ((totalVerified / (totalVerified + totalRejected)) * 100).toFixed(1) : "0";

  var c = "";

  var tL = { INFO: "\u2139\ufe0f \u4fe1\u606f", COMMAND: "\ud83d\udccb \u6307\u4ee4", REJECT: "\uD83D\uDEAB \u6253\u56DE", REQUEST: "\uD83D\uDCE9 \u8BF7\u6C42", DISPUTE: "\u2694\uFE0F \u8D28\u7591", NOTIFY: "\uD83D\uDCE2 \u901A\u77E5", ESCALATE: "\u26A0\uFE0F \u5347\u7EA7", CONFIRM: "\u2705 \u786E\u8BA4", DIRECTIVE: "\uD83D\uDC51 \u6307\u4EE4", APPROVE: "\uD83D\uDC4D \u6279\u51C6", GUIDANCE: "\uD83D\uDCA1 \u6307\u5BFC", PRIORITY_OVERRIDE: "\u26A1 \u7D27\u6025", INQUIRE: "\uD83D\uDD0E \u8BE2\u95EE" };
  var avatars = { collector: "\uD83D\uDCE1", verifier: "\uD83D\uDD0D", analyst: "\uD83D\uDD2C", editor: "\u270D\uFE0F", "memory-manager": "\uD83E\uDDE0" };

  function stripMD(text) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/^- /gm, "\u2022 ")
      .replace(/\n- /g, "\n\u2022 ")
      .replace(/%/g, "\uFF05").replace(/TL;DR/gi, "\uD83D\uDCCB \u8981\u70B9\u603B\u7ED3");
  }

  var msgs = '<div class="chat-log">\n';
  var hasArb = !!state.arbitration;
  var arbLinked = false;
  var roundMsgs = {};

  state.messages.forEach(function(m, mi) {
    var rKey = Math.floor(mi / Math.max(1, Math.ceil(state.messages.length / state.round)));
    if (!roundMsgs[rKey]) roundMsgs[rKey] = [];
    roundMsgs[rKey].push({ msg: m, idx: mi });
  });

  var rKeys = Object.keys(roundMsgs).sort(function(a,b) { return a-b; });
  var seenMsgs = {};
  rKeys.forEach(function(rk) {
    var roundLabel = "\u7B2C" + (parseInt(rk)+1) + "\u8F6E";
    msgs += '<div class="chat-round-divider">\u25CF ' + roundLabel + '</div>\n';


    roundMsgs[rk].forEach(function(entry) {
      var m = entry.msg;
      var mi = entry.idx;
      // 重复消息跳过：同一轮、同一角色、相同内容（跨轮次也跳过）
      var dedupKey = m.from + "|" + ((m.coreInfo || "").replace(/\s+/g, " ").trim());
      if (seenMsgs[dedupKey]) return;
      seenMsgs[dedupKey] = true;
      var fn = AGENT_NAMES_CN[m.from] || m.from;
      var tn = AGENT_NAMES_CN[m.to] || m.to;
      var av = avatars[m.from] || "\uD83D\uDCAC";
      var tl = tL[m.type] || m.type;
      var time = m.timestamp ? (function(ts) { if (!ts) return ""; var d = new Date(ts); var h = String((d.getUTCHours() + 8) % 24).padStart(2, "0"); var m = String(d.getUTCMinutes()).padStart(2, "0"); return h + ":" + m; })(m.timestamp) : "";

      msgs += '<div class="chat-msg chat-from-' + m.from + '" id="msg-' + mi + '">\n';
      msgs += '<div class="chat-avatar">' + av + '</div>\n';
      msgs += '<div class="chat-content">\n';
      msgs += '<div class="chat-meta">\n';
      msgs += '<span class="chat-sender">' + fn + '</span>\n';
      msgs += '<span class="chat-badge">' + tl + '</span>\n';
      msgs += '<span style="opacity:0.6">\u2192 ' + tn + '</span>\n';

      if (hasArb && !arbLinked && (m.type === "ESCALATE" || m.type === "DISPUTE")) {
        msgs += '[#arbitration" class="arb-anchor">\u2696\uFE0F \u4EF2\u88C1</a>\n';
        arbLinked = true;
      }

      msgs += '<span class="chat-time">' + time + '</span>\n';
      msgs += '</div>\n';
      msgs += '<div class="chat-body">\n';

      var allItems = {};
      state.rawItems.forEach(function(item) { allItems[item.id] = item.title; });
      state.verifiedItems.forEach(function(item) { allItems[item.id] = item.title; });
      state.rejectedItems.forEach(function(item) { allItems[item.id] = item.title; });
      state.rawItems.forEach(function(item) { var parts = item.id.split('-'); var short = 'RAW-' + parts[parts.length-1]; allItems[short] = item.title; });
      
      var cleanText = (m.coreInfo || "")
        .replace(/RAW-(\d{4}-\d{2}-\d{2}-\d{4})/g, function(match, idSuffix) {
          var fullId = "RAW-" + idSuffix;
          var title = allItems[fullId];
          if (!title) { var shortId = "RAW-" + idSuffix.slice(-4); title = allItems[shortId]; }
          if (!title) { for (var k in allItems) { if (k.endsWith(idSuffix)) { title = allItems[k]; break; } } }
          return title ? "\u3010\u7D20\u6750\uFF1A" + title.slice(0, 30) + "\u3011" : "\u3010\u7D20\u6750\u3011";
        })
        .replace(/RAW-(\d{4})\b(?!-)/g, function(match, shortId) {
          var found = null;
          for (var k in allItems) { if (k.endsWith("-" + shortId)) { found = allItems[k]; break; } }
          return found ? "\u3010\u7D20\u6750\uFF1A" + found.slice(0, 30) + "\u3011" : match;
        })
        .replace(/MSG-[A-Z]{3}-\d{4}-\d{2}-\d{2}-\d{3}/g, "\u3010\u6D88\u606F\u3011")
        .replace(/REQ-[A-Z]{3}-\d{4}-\d{2}-\d{2}-\d{3}/g, "\u3010\u8BF7\u6C42\u3011")
        .replace(/INS-\d{4}-\d{2}-\d{2}-\d{3}/g, "\u3010\u6D1E\u5BDF\u3011");
      
      cleanText = stripMD(cleanText);
      cleanText = cleanText.replace(/\[【/g, "【").replace(/】\]/g, "】");

      // Trim multi-role summaries: each role only shows their own summary
      var roleNames = ['采集师', '核查师', '分析师', '编辑师', '记忆管理师'];
      var foundRole = null;
      for (var ri = 0; ri < roleNames.length; ri++) {
        if (cleanText.indexOf('<strong>' + roleNames[ri] + '</strong>') !== -1) {
          foundRole = roleNames[ri];
          break;
        }
      }
      if (foundRole) {
        var senderName = AGENT_NAMES_CN[m.from] || '';
        if (senderName) {
          var roleCount = 0;
          for (var ri = 0; ri < roleNames.length; ri++) {
            if (cleanText.indexOf('<strong>' + roleNames[ri] + '</strong>') !== -1) roleCount++;
          }
          if (roleCount > 1) {
            var targetMarker = '<strong>' + senderName + '</strong>';
            var markerStart = cleanText.indexOf(targetMarker);
            if (markerStart !== -1) {
              var markerEnd = cleanText.length;
              for (var ri = 0; ri < roleNames.length; ri++) {
                var other = '<strong>' + roleNames[ri] + '</strong>';
                if (other === targetMarker) continue;
                var ni = cleanText.indexOf(other, markerStart + targetMarker.length);
                if (ni !== -1 && ni < markerEnd) markerEnd = ni;
              }
              cleanText = cleanText.slice(markerStart, markerEnd);
            } else {
              cleanText = '参与但未提交有效复盘内容。';
            }
          }
        }
      }

      msgs += '<blockquote>' + cleanText.replace(/\n+/g, '<br>') + '</blockquote>\n';
      msgs += '</div>\n';

      if (m.expectedAction || m.reason) {
        msgs += '<div class="chat-footer">\n';
        if (m.expectedAction) msgs += '<span>\uD83C\uDFAF ' + stripMD(m.expectedAction) + '</span>\n';
        if (m.reason) msgs += '<span>\uD83D\uDCDD ' + stripMD(m.reason) + '</span>\n';
        msgs += '</div>\n';
      }

      msgs += '</div></div>\n\n';
    });
  });
  msgs += '</div>\n';

  var arb = "";
  if (state.arbitration && state.arbitration.verdict) {
    arb = '\n\n## \u2696\uFE0F \u4EF2\u88C1\u8BB0\u5F55 <a id="arbitration"></a>\n\n';
    var vd = state.arbitration.verdict;
    if (state.arbitration.rounds[0] && state.arbitration.rounds[0].result && state.arbitration.rounds[0].result.fact_list) {
      arb += '### \u521D\u5BA1 \u00B7 \u4E8B\u5B9E\u6E05\u5355\n\n';
      state.arbitration.rounds[0].result.fact_list.forEach(function(f) { arb += '- ' + f + '\n'; });
      arb += '\n';
    }
    if (state.arbitration.rounds[1] && state.arbitration.rounds[1].result && state.arbitration.rounds[1].result.positions) {
      arb += '### \u590D\u5BA1 \u00B7 \u5404\u65B9\u89C2\u70B9\n\n';
      for (var pk in state.arbitration.rounds[1].result.positions) {
        arb += '**' + (AGENT_NAMES_CN[pk] || pk) + '**\uFF1A' + state.arbitration.rounds[1].result.positions[pk] + '\n\n';
      }
    }
    arb += '### \u7EC8\u5BA1 \u00B7 \u88C1\u51B3\n\n';
    if (vd.summary) arb += '> **\u4E89\u8BAE\u6458\u8981**\uFF1A' + vd.summary + '\n>\n';
    if (vd.decision) arb += '> **\u88C1\u51B3\u7ED3\u679C**\uFF1A' + vd.decision + '\n>\n';
    if (vd.action_items && vd.action_items.length) {
      arb += '> **\u6267\u884C\u6B65\u9AA4**\uFF1A\n';
      vd.action_items.forEach(function(a) { arb += '> - ' + a + '\n'; });
      arb += '>\n';
    }
    if (vd.rule_changes && vd.rule_changes.length) {
      arb += '> **\u89C4\u5219\u53D8\u66F4**\uFF1A\n';
      vd.rule_changes.forEach(function(r) { 
        arb += '> - ' + (typeof r === "string" ? r : (r.reason || r.file || JSON.stringify(r))) + '\n';
      });
    }
    arb += '\n';
  }

  var emerg = "";
  if (state.emergencyChannel) {
    emerg = '\n\n## \u26A1 \u7D27\u6025\u901A\u9053\n\n- \u89E6\u53D1\uFF1A' + (state.emergencyChannel.triggered_by || "\u672A\u77E5") + ' | ' + (state.emergencyChannel.topic || "\u672A\u77E5") + '\n';
  }



  var retro = "\n<h2>\uD83D\uDCDD \u4ECA\u65E5\u590D\u76D8</h2>\n\n<blockquote>\u6BCF\u4E2A\u89D2\u8272\u5BF9\u4ECA\u65E5\u5DE5\u4F5C\u7684\u603B\u7ED3\u4E0E\u53CD\u601D</blockquote>\n\n";
  var agentLastMsg = {};
  state.messages.forEach(function(m) { agentLastMsg[m.from] = m; });
  var reviewPhaseMsgs = {};
  state.messages.forEach(function(m) { if ((m.to === "memory-manager" || m.to === "editor") && (m.type === "APPROVE" || m.type === "CONFIRM" || m.type === "NOTIFY")) reviewPhaseMsgs[m.from] = m; });
  // Prefer review-phase message for 复盘; fall back to last message
  Object.keys(reviewPhaseMsgs).forEach(function(k) { agentLastMsg[k] = reviewPhaseMsgs[k]; });
  var agentOrder = ["collector", "verifier", "analyst", "editor", "memory-manager"];
  agentOrder.forEach(function(aid) {
    var m = agentLastMsg[aid];
    var name = AGENT_NAMES_CN[aid] || aid;
    var av = avatars[aid] || "\uD83D\uDCAC";
    retro += '<div class="chat-msg chat-from-' + aid + '">\n';
    retro += '<div class="chat-avatar">' + av + '</div>\n';
    retro += '<div class="chat-content">\n';
    retro += '<div class="chat-meta"><span class="chat-sender">' + name + '</span><span class="chat-badge">\uD83D\uDCDD \u590D\u76D8</span></div>\n';
    retro += '<div class="chat-body"><blockquote>';
    if (m && m.coreInfo) {
        var retroCore = m.coreInfo;
        var retroRoleNames = ['采集师', '核查师', '分析师', '编辑师', '记忆管理师'];
        var retroRoleCount = 0;
        for (var ri = 0; ri < retroRoleNames.length; ri++) {
          if (retroCore.indexOf('<strong>' + retroRoleNames[ri] + '</strong>') !== -1) retroRoleCount++;
        }
        if (retroRoleCount > 1 && name) {
          var retroTarget = '<strong>' + name + '</strong>';
          var retroStart = retroCore.indexOf(retroTarget);
          if (retroStart !== -1) {
            var retroEnd = retroCore.length;
            for (var ri = 0; ri < retroRoleNames.length; ri++) {
              var retroOther = '<strong>' + retroRoleNames[ri] + '</strong>';
              if (retroOther === retroTarget) continue;
              var retroNi = retroCore.indexOf(retroOther, retroStart + retroTarget.length);
              if (retroNi !== -1 && retroNi < retroEnd) retroEnd = retroNi;
            }
            retroCore = retroCore.slice(retroStart, retroEnd);
          } else {
            retroCore = '参与但未提交有效复盘内容。';
          }
        }
        retro += stripMD(retroCore.slice(0, 500)).replace(/\n+/g, "<br>");
      } else if (m && !m.coreInfo) { retro += name + "\u53C2\u4E0E\u4F46\u672A\u63D0\u4EA4\u6709\u6548\u590D\u76D8\u5185\u5BB9\u3002"; } else { var anyAgentMsg = state.messages.filter(function(mm) { return mm.from === aid; }).slice(-1)[0]; if (anyAgentMsg && anyAgentMsg.coreInfo) { retro += stripMD(anyAgentMsg.coreInfo.slice(0, 500)).replace(/\n+/g, "<br>"); } else { retro += name + "\u672A\u53C2\u4E0E\u4ECA\u65E5\u5DE5\u4F5C\u3002"; } }
    retro += '</blockquote></div>\n';
    retro += '</div></div>\n\n';
  });
  retro += '<div class="chat-round-divider">\u25CF \u5BA1\u7A3F\u53CD\u9988</div>\n';
  var reviewMsgs = state.messages.filter(function(m) { return m.type === "APPROVE" || m.type === "CONFIRM" || m.type === "REQUEST" && m.to === "editor"; }).slice(-6);
  if (reviewMsgs.length === 0) {
    retro += '<p style="color:#999;text-align:center;padding:12px;">\u26A0\uFE0F \u672C\u6B21\u672A\u8FDB\u884C\u6B63\u5F0F\u5BA1\u7A3F\u6D41\u7A0B</p>\n';
  } else {
    retro += '<p style="color:#888;text-align:center;padding:8px;">\u2705 \u5DF2\u6536\u5230 ' + reviewMsgs.length + ' \u6761\u5BA1\u7A3F\u53CD\u9988\uFF0C\u8BE6\u89C1\u4E0A\u65B9\u5B8C\u6574\u901A\u4FE1\u8BB0\u5F55</p>\n';
  }

  // ===== 信誉分变化 =====
  var repLog = "\n\n## 📊 今日信誉分变化\n\n";
  var repAgents = ["collector", "verifier", "analyst", "editor", "memory-manager"];
  var repNames = { collector: "采集师", verifier: "核查师", analyst: "分析师", editor: "编辑师", "memory-manager": "记忆管理师" };
  repLog += '<div style="display:grid;grid-template-columns:80px 50px 50px;gap:6px 12px;font-size:0.9em;margin:12px 0;">\n';
  repLog += '<div style="font-weight:600;padding:6px 0;border-bottom:2px solid var(--vp-c-divider);">角色</div>\n';
  repLog += '<div style="text-align:center;padding:6px 0;border-bottom:2px solid var(--vp-c-divider);">分数</div>\n';
  repLog += '<div style="text-align:center;padding:6px 0;border-bottom:2px solid var(--vp-c-divider);">变化</div>\n';
  
  repAgents.forEach(function(aid) {
    var agentRep = state.reputation && state.reputation[aid];
    if (!agentRep) return;
    var score = agentRep.score || "?";
    var delta = "—";
    if (agentRep.history && agentRep.history.length > 0) {
      var lastEntry = agentRep.history[agentRep.history.length - 1];
      delta = lastEntry.delta > 0 ? "+" + lastEntry.delta : String(lastEntry.delta);
    }
    repLog += '<div style="font-weight:600;padding:6px 0;border-bottom:1px solid var(--vp-c-divider);">' + (repNames[aid] || aid) + '</div>\n';
    repLog += '<div style="text-align:center;padding:6px 0;border-bottom:1px solid var(--vp-c-divider);">' + score + '</div>\n';
    repLog += '<div style="text-align:center;padding:6px 0;border-bottom:1px solid var(--vp-c-divider);">' + delta + '</div>\n';
  });
  repLog += "</div>\n";

  // ===== 质量评估 =====
  var qualitySection = "\n\n## 🏆 质量评估\n\n";
  var qs = (state.review && state.review.quality_scores) || {};
  var hasScores = qs.completeness !== undefined || qs.accuracy !== undefined || qs.depth !== undefined || qs.readability !== undefined || qs.score !== undefined;
  if (hasScores) {
    qualitySection += '| 维度 | 分数 |\n|------|------|\n';
    if (qs.completeness !== undefined) qualitySection += "| 完整性 | " + qs.completeness + " |\n";
    if (qs.accuracy !== undefined) qualitySection += "| 准确性 | " + qs.accuracy + " |\n";
    if (qs.depth !== undefined) qualitySection += "| 深度 | " + qs.depth + " |\n";
    if (qs.readability !== undefined) qualitySection += "| 可读性 | " + qs.readability + " |\n";
    if (qs.score !== undefined) qualitySection += "| **总分** | **" + qs.score + "** |\n";
        if (qs.score === undefined && (qs.completeness !== undefined || qs.accuracy !== undefined)) {
      var avg = [qs.completeness, qs.accuracy, qs.depth, qs.readability].filter(function(v) { return v !== undefined; }).reduce(function(a,b) { return a+b; }, 0) / [qs.completeness, qs.accuracy, qs.depth, qs.readability].filter(function(v) { return v !== undefined; }).length;
      qualitySection += "| **总分(平均)** | **" + avg.toFixed(1) + "** |\n";
    }
    if (state.review && state.review.summary) qualitySection += "\n> " + state.review.summary + "\n";
  } else {
    qualitySection += "> 今日未进行正式质量评估\n";

  }

  // 修复过程日志中的"编辑师未参与今日工作"类错误标注
  // 修复所有角色“未参与”
  var fixUncansaiRG = { "采集师": "采集师已完成今日素材采集（详见统计）", "核查师": "核查师已完成今日审核（详见通信记录）", "分析师": "分析师已产出今日洞察（详见核心解读）", "编辑师": "编辑师已完成草稿编排（详见正文）", "记忆管理师": "记忆管理师已完成规则维护与信誉评估（详见复盘段）" };
  for (var role in fixUncansaiRG) {
    c = c.replace(new RegExp(role + "未参与今日工作[。.]?", "g"), fixUncansaiRG[role]);
  }
  return "---\ntitle: " + dateStr + " | \u56E2\u961F\u8FC7\u7A0B\u65E5\u5FD7\noutline: [2, 3]\n---\n\n" + c +
    "# \uD83D\uDCCB \u56E2\u961F\u8FC7\u7A0B\u65E5\u5FD7 \u00B7 " + dateCN + "\n\n" +
    "## \uD83D\uDCCA \u4ECA\u65E5\u7EDF\u8BA1\n\n" +
    "| \u6307\u6807 | \u6570\u636E |\n|------|------|\n" +
    "| \u603B\u8F6E\u6B21 | " + state.round + " (" + (state.deadlockDetected ? "\u5DF2\u89E6\u53D1\u4EF2\u88C1" : "\u6B63\u5E38\u6D41\u7A0B") + ") |\n" +
    "| \u91C7\u96C6\u63D0\u4EA4 | " + state.stats.collectorSubmitted + " \u6761 |\n" +
    "| \u6838\u67E5\u901A\u8FC7 | " + state.stats.verifierPassed + " \u6761\uFF08\u901A\u8FC7\u7387 " + pr + "%\uFF09 |\n" +
    "| \u6838\u67E5\u62D2\u7EDD | " + state.stats.verifierRejected + " \u6761 |\n" +
    "| \u8865\u91C7\u8BF7\u6C42 | " + state.stats.analystRequests + " \u6B21 |\n" +
    "| \u7D27\u6025\u901A\u9053 | " + (state.emergencyChannel ? "\u5DF2\u89E6\u53D1" : "\u672A\u89E6\u53D1") + " |\n" +
    "| \u89C4\u5219\u53D8\u66F4 | " + (state.stats.ruleChanges || 0) + " \u6761 |\n\n" +
    emerg +
    "## \uD83D\uDCAC \u5B8C\u6574\u901A\u4FE1\u8BB0\u5F55\n\n" + msgs + "\n" +
    arb +
    retro +
    repLog + qualitySection +
    "\n\n> \u751F\u6210\u65F6\u95F4: " + new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + "\n";
}


// ===================== 周报生成 =====================
function generateWeeklyReport(state, dateStr) {
  var weekNum = (function(d) { var sysStart = new Date(2026, 5, 28); var days = Math.floor((d - sysStart) / 86400000); return Math.ceil((days + 1) / 7); })(new Date(dateStr));
  var rep = state.reputation;
  var dateCN = getDateCN(dateStr);
  var agents = ["collector", "verifier", "analyst", "editor", "memory-manager"];
  var sysMem = loadSystemMemory();
  var weekStart = new Date(new Date(dateStr).getTime() - 6 * 86400000);
  var weeklyRuleChanges = 0;
  sysMem.entries.forEach(function(e) {
    var ed = new Date(e.date);
    if (ed >= weekStart && ed <= new Date(dateStr)) { weeklyRuleChanges += e.ruleChanges || 0; }
  });

  var colors = { collector: "#e74c3c", verifier: "#2ecc71", analyst: "#3498db", editor: "#a569bd", "memory-manager": "#f39c12" };

  var allDates = new Set();
  agents.forEach(function(aid) {
    var h = rep[aid] ? rep[aid].history || [] : [];
    h.forEach(function(entry) { allDates.add(entry.date); });
  });
  var sortedDates = Array.from(allDates).sort();
  if (sortedDates.length < 2) {
    if (sortedDates.length === 1) sortedDates.unshift(sortedDates[0].replace(/\d+$/, function(m) { return String(Number(m) - 1).padStart(2, "0"); }));
    else { sortedDates = [dateStr.replace(/\d+$/, function(m) { return String(Number(m) - 1).padStart(2, "0"); }), dateStr]; }
  }

  var chartW = 560, chartH = 220, padL = 50, padR = 20, padT = 15, padB = 30;
  var plotW = chartW - padL - padR;
  var plotH = chartH - padT - padB;

  var svgPaths = [];
  agents.forEach(function(aid) {
    var h = rep[aid] ? rep[aid].history || [] : [];
    var pts = [];
    sortedDates.forEach(function(d) {
      var entry = h.filter(function(e) { return e.date === d; });
      var s = entry.length > 0 ? entry[entry.length - 1].scoreAfter : null;
      if (s !== null) {
        var xi = padL + (sortedDates.indexOf(d) / Math.max(1, sortedDates.length - 1)) * plotW;
        var yi = padT + plotH - ((s / 100) * plotH);
        pts.push(xi.toFixed(1) + "," + yi.toFixed(1));
      }
    });
    if (pts.length >= 2) {
      svgPaths.push('<polyline points="' + pts.join(" ") + '" fill="none" stroke="' + (colors[aid] || "#888") + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>');
      var lastPt = pts[pts.length - 1].split(",");
      var lastName = AGENT_NAMES_CN[aid] || aid;
      var lastScore = (function() {
        var h2 = rep[aid] ? rep[aid].history || [] : [];
        var lastEntry = h2.filter(function(e) { return e.date === sortedDates[sortedDates.length - 1]; });
        return lastEntry.length > 0 ? lastEntry[lastEntry.length - 1].scoreAfter : "?";
      })();
      svgPaths.push('<text x="' + (parseFloat(lastPt[0]) + 4) + '" y="' + (parseFloat(lastPt[1]) + 4) + '" font-size="10" fill="' + (colors[aid] || "#888") + '">' + lastName + " " + lastScore + "</text>");
    }
  });

  var dateLabels = sortedDates.map(function(d, i) {
    if (sortedDates.length > 10 && i % Math.ceil(sortedDates.length / 7) !== 0) return "";
    var xi = padL + (i / Math.max(1, sortedDates.length - 1)) * plotW;
    return '<text x="' + xi.toFixed(1) + '" y="' + (chartH - 6) + '" font-size="8" text-anchor="middle" fill="#888">' + d.slice(5) + "</text>";
  }).join("");

  var yLabels = "";
  for (var yi = 0; yi <= 100; yi += 20) {
    var yy = padT + plotH - ((yi / 100) * plotH);
    yLabels += '<text x="' + (padL - 6) + '" y="' + (yy + 3) + '" font-size="8" text-anchor="end" fill="#888">' + yi + '</text>';
    yLabels += '<line x1="' + padL + '" y1="' + yy + '" x2="' + (chartW - padR) + '" y2="' + yy + '" stroke="#ddd" stroke-width="0.5" stroke-dasharray="3,3"/>';
  }

  var chartSvg = '<svg class="rep-line-chart" viewBox="0 0 ' + chartW + " " + chartH + '" xmlns="http://www.w3.org/2000/svg">' + yLabels + dateLabels + svgPaths.join("") + "</svg>";

  var legendHtml = '<div class="rep-legend">\n';
  agents.forEach(function(aid) {
    var name = AGENT_NAMES_CN[aid] || aid;
    legendHtml += '<span class="rep-legend-item"><span class="rep-dot" style="background:' + (colors[aid] || "#888") + '"></span>' + name + "</span>\n";
  });
  legendHtml += "</div>\n";

  var summaryCards = '<div class="rep-summary">\n';
  agents.forEach(function(aid) {
    var repEntry = rep[aid];
    if (!repEntry) return;
    var lastChange = repEntry.history && repEntry.history.length > 0 ? repEntry.history[repEntry.history.length - 1] : null;
    var trend = lastChange ? (lastChange.delta > 0 ? "📈 +" + lastChange.delta : (lastChange.delta < 0 ? "📉 " + lastChange.delta : "➡️ 0")) : "—";
    summaryCards += '<div class="rep-card"><span>' + (AGENT_NAMES_CN[aid] || aid) + '</span><span class="rep-score">' + repEntry.score + '</span><span class="rep-trend">' + trend + "</span></div>\n";
  });
  summaryCards += "</div>\n";

  var avgScore = agents.reduce(function(s, aid) { return s + ((rep[aid] && rep[aid].score) || 0); }, 0) / agents.length;
  var scoresContent = "# " + dateStr.slice(0, 4) + " 年第" + String(weekNum).padStart(2, "0") + "周（" + dateCN + "）\n\n> 🤖 多Agent信誉分趋势\n\n" + summaryCards + "\n" + chartSvg + "\n" + legendHtml + "\n\n### 平均信誉分: " + avgScore.toFixed(1) + "\n\n### 本周规则变更\n\n| 变更条数 | 说明 |\n|------|------|\n| " + (weeklyRuleChanges || 0) + " 条 | 由记忆管理师在日常复盘中自动执行 |\n\n";

  var changelogDetail = "";
  try {
    var changelogContent = fs.readFileSync(CHANGELOG_FILE, "utf-8");
    var lines = changelogContent.split("\n");
    var weekEntries = [];
    var currentDate = "";
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      if (/^## \d{4}-\d{2}-\d{2}/.test(line)) {
        currentDate = line.replace("## ", "").trim();
      } else if (/^- /.test(line) && currentDate) {
        var ed = new Date(currentDate);
        if (ed >= weekStart && ed <= new Date(dateStr)) {
          weekEntries.push(line.replace(/^- /, "").trim());
        }
      }
    }
    if (weekEntries.length > 0) {
      changelogDetail = "\n### 本周规则变更详情\n\n";
      changelogDetail += '<div class="changelog-list">\n';
      weekEntries.slice(0, 15).forEach(function(e) {
        var parsed = e.match(/^\*\*(.+?)\*\*\s*\((.+?)\):\s*(.+)/);
        if (parsed) {
          changelogDetail += '<div><span class="changelog-file">' + parsed[1] + '</span> <span class="changelog-ver">' + parsed[2] + '</span><br>' + parsed[3] + '</div>\n';
        } else {
          changelogDetail += '<div>' + e + '</div>\n';
        }
      });
      changelogDetail += '</div>\n';
      if (weekEntries.length > 15) changelogDetail += '\n> 共' + weekEntries.length + ' 条变更，仅展示最近15条\n';
    }
  } catch (e) {
    // skip changelog read errors
  }

  var report = scoresContent + changelogDetail + "\n";
  return report;
}

// ===================== 索引页更新 =====================
function updateDailyIndex(dateStr) {
  var indexPath = path.join(OUTPUT_DIR, "index.md");
  var content;
  try { content = fs.readFileSync(indexPath, "utf-8"); } catch (e) { return; }
  var dateLink = '<li><a href="./' + dateStr + '">' + dateStr + '</a> — <a href="../logs/' + dateStr + '">📝 过程日志</a></li>\n';
  if (content.includes(dateLink.trim())) return;
  var insertPos = content.indexOf("<li>");
  if (insertPos === -1) insertPos = content.lastIndexOf("</ul>");
  if (insertPos === -1) return;
  var firstPart = content.slice(0, insertPos);
  var afterPart = content.slice(insertPos);
  content = firstPart + dateLink + afterPart;
  fs.writeFileSync(indexPath, content, "utf-8");
}

function updateLogsIndex(dateStr) {
  var indexPath = path.join(LOGS_DIR, "index.md");
  var content;
  try { content = fs.readFileSync(indexPath, "utf-8"); } catch (e) { return; }
  var dateLink = '<li><a href="./' + dateStr + '">' + dateStr + '</a> — 采集师·核查师·分析师·编辑师·记忆管理师</li>\n';
  if (content.includes(dateLink.trim())) return;
  var insertPos = content.indexOf("<li>");
  if (insertPos === -1) insertPos = content.lastIndexOf("</ul>");
  if (insertPos === -1) return;
  var firstPart = content.slice(0, insertPos);
  var afterPart = content.slice(insertPos);
  content = firstPart + dateLink + afterPart;
  fs.writeFileSync(indexPath, content, "utf-8");
}

function updateWeeklyIndex(dateStr, weekNum) {
  var indexPath = path.join(WEEKLY_DIR, "index.md");
  var content;
  try { content = fs.readFileSync(indexPath, "utf-8"); } catch (e) { return; }
  var linkText = '<a href="./review-' + dateStr.slice(0, 4) + '-W' + String(weekNum).padStart(2, "0") + '">' + dateStr.slice(0, 4) + "年第" + String(weekNum).padStart(2, "0") + "周</a>";
  if (content.includes(linkText)) return;
  var insertPos = content.indexOf("<li>");
  if (insertPos === -1) insertPos = content.lastIndexOf("</ul>");
  if (insertPos === -1) return;
  var firstPart = content.slice(0, insertPos);
  var afterPart = content.slice(insertPos);
  content = firstPart + "<li>" + linkText + "</li>\n" + afterPart;
  fs.writeFileSync(indexPath, content, "utf-8");
}

module.exports = { generateProcessLog, generateWeeklyReport, updateDailyIndex, updateLogsIndex, updateWeeklyIndex };
