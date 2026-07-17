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
  var d = new Date(dateStr);
  return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日";
}

// ===================== 过程日志生成 =====================
function generateProcessLog(state, dateStr) {
  var dateCN = getDateCN(dateStr);
  var pr = state.stats.collectorSubmitted > 0 ? ((state.stats.verifierPassed / state.stats.collectorSubmitted) * 100).toFixed(1) : "0";

  var c = "";

  var tL = { INFO: "ℹ️ 信息", COMMAND: "📋 指令", REJECT: "🚫 打回", REQUEST: "📩 请求", DISPUTE: "⚔️ 质疑", NOTIFY: "📢 通知", ESCALATE: "⚠️ 升级", CONFIRM: "✅ 确认", DIRECTIVE: "👑 指令", APPROVE: "👍 批准", GUIDANCE: "💡 指导", PRIORITY_OVERRIDE: "⚡ 紧急", INQUIRE: "🔎 询问" };
  var avatars = { collector: "📡", verifier: "🔍", analyst: "🔬", editor: "✍️", "memory-manager": "🧠" };

  function stripMD(text) {
    return text
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/^- /gm, "• ")
      .replace(/\n- /g, "\n• ")
      .replace(/%/g, "％").replace(/TL;DR/gi, "📋 要点总结");
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
    var roundLabel = "第" + (parseInt(rk)+1) + "轮";
    msgs += '<div class="chat-round-divider">● ' + roundLabel + '</div>\n';
    roundMsgs[rk].forEach(function(item) {
      var m = item.msg;
      var fromName = AGENT_NAMES_CN[m.from] || m.from;
      var toName = AGENT_NAMES_CN[m.to] || m.to || "all";
      var msgKey = m.from + m.type + m.coreInfo;
      if (seenMsgs[msgKey]) return;
      seenMsgs[msgKey] = true;
      var typeLabel = tL[m.type] || m.type;
      msgs += '<div class="chat-msg">\n';
      msgs += '  <div class="chat-header"><span class="chat-from">' + (avatars[m.from] || "") + " " + fromName + '</span> → <span class="chat-to">' + toName + '</span> <span class="chat-type">' + typeLabel + '</span></div>\n';
      if (m.coreInfo) msgs += '  <div class="chat-body">' + stripMD(String(m.coreInfo)) + '</div>\n';
      if (m.reason) msgs += '  <div class="chat-reason">' + stripMD(String(m.reason)) + '</div>\n';
      msgs += '</div>\n';
    });
  });
  msgs += '</div>\n';

  var scoresContent = "";
  ["collector","verifier","analyst","editor","memory-manager"].forEach(function(aid) {
    var rep = state.reputation[aid];
    if (!rep) return;
    var todayChanges = (rep.history || []).filter(function(h) { return h.date === dateStr; });
    var deltaStr = "—";
    var reasonStr = "—";
    if (todayChanges.length > 0) {
      var lastEntry = todayChanges[todayChanges.length - 1];
      deltaStr = lastEntry.delta > 0 ? "+" + lastEntry.delta : String(lastEntry.delta);
      reasonStr = String(lastEntry.reason || "").slice(0, 150);
    }
    var name = AGENT_NAMES_CN[aid] || aid;
    scoresContent += '<div class="score-row"><span class="score-name">' + name + '</span><span class="score-val">' + rep.score + '</span><span class="score-delta">(' + deltaStr + ')</span><span class="score-reason">' + reasonStr + '</span></div>\n';
  });

  var reviewContent = "";
  if (state.review && state.review.quality_scores) {
    reviewContent += '\n\n## 质量评估\n\n| 维度 | 评分 |\n|------|------|\n';
    Object.entries(state.review.quality_scores).forEach(function(e) {
      reviewContent += '| ' + e[0] + ' | ' + e[1] + ' |\n';
    });
    if (state.review.strengths && state.review.strengths.length > 0)
      reviewContent += '\n**优势**: ' + state.review.strengths.join("、");
    if (state.review.weaknesses && state.review.weaknesses.length > 0)
      reviewContent += '\n\n**劣势**: ' + state.review.weaknesses.join("、");
  } else {
    reviewContent = "\n\n> 今日未生成回顾评估（系统运行异常或素材不足）";
  }

  c = "---\ntitle: " + dateStr + " 过程日志\noutline: [2, 3]\n---\n\n# 📋 过程日志 · " + dateCN + "\n\n## 📊 数据概要\n\n| 指标 | 数值 |\n|------|------|\n| 采集 | " + state.stats.collectorSubmitted + " 条 |\n| 通过 | " + state.stats.verifierPassed + " 条 |\n| 拒绝 | " + state.stats.verifierRejected + " 条 |\n| 通过率 | " + pr + "% |\n| 轮次 | " + state.round + "/" + state.maxRounds + " |\n| 僵局 | " + (state.deadlockDetected ? "是" : "否") + " |\n\n## 💬 通信记录\n\n" + msgs + "\n\n---\n\n## 📈 今日信誉分变化\n\n<div class=\"score-grid\">\n" + scoresContent + "</div>\n\n" + reviewContent + "\n";
  return c;
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
  var insertPos = content.lastIndexOf("<li>");
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
  var dateLink = '<li><a href="./' + dateStr + '">' + dateStr + '</a></li>\n';
  if (content.includes(dateLink.trim())) return;
  var insertPos = content.lastIndexOf("<li>");
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
  var insertPos = content.lastIndexOf("<li>");
  if (insertPos === -1) insertPos = content.lastIndexOf("</ul>");
  if (insertPos === -1) return;
  var firstPart = content.slice(0, insertPos);
  var afterPart = content.slice(insertPos);
  content = firstPart + "<li>" + linkText + "</li>\n" + afterPart;
  fs.writeFileSync(indexPath, content, "utf-8");
}

module.exports = { generateProcessLog, generateWeeklyReport, updateDailyIndex, updateLogsIndex, updateWeeklyIndex };
