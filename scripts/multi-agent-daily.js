#function updateDailyIndex(dateStr) {
  var indexPath = path.join(OUTPUT_DIR, "index.md");
  var content;
  try { content = fs.readFileSync(indexPath, "utf-8"); } catch (e) { return; }

  if (content.indexOf(dateStr) < 0) {
    var marker = '<div class="scroll-list">';
    var insertPos = content.indexOf(marker);
    if (insertPos > 0) {
      var lineStart = content.indexOf("\n", insertPos) + 1;
      var newEntry = "- [" + dateStr + "](./" + dateStr + ".md)\n";
      content = content.substring(0, lineStart) + newEntry + content.substring(lineStart);
      writeFileUTF8(indexPath, content);
    }
  }

  // Also update logs index
  var logsIdxPath = path.join(LOGS_DIR, "index.md");
  try {
    var logsContent = fs.readFileSync(logsIdxPath, "utf-8");
    if (logsContent.indexOf(dateStr) < 0) {
      var lMarker = '<div class="scroll-list">';
      var lPos = logsContent.indexOf(lMarker);
      if (lPos > 0) {
        var lLineStart = logsContent.indexOf("\n", lPos) + 1;
        var lEntry = "- [" + dateStr + "](./" + dateStr + ".md)\n";
        logsContent = logsContent.substring(0, lLineStart) + lEntry + logsContent.substring(lLineStart);
        writeFileUTF8(logsIdxPath, logsContent);
      }
    }
  } catch (e) {}

  // Update weekly index (on Sundays)
  var now = new Date();
  if (now.getDay() === 0) {
    var wkIdxPath = path.join(WEEKLY_DIR, "index.md");
    try {
      var wkContent = fs.readFileSync(wkIdxPath, "utf-8");
      var weekNum = (function(d) { var start = new Date(d.getFullYear(), 0, 1); var days = Math.floor((d - start) / 86400000); return Math.ceil((days + start.getDay() + 1) / 7); })(now);
      var wkFileName = "review-" + dateStr.slice(0, 4) + "-W" + String(weekNum).padStart(2, "0");
      var wkLabel = dateStr.slice(0, 4) + "??" + weekNum + "?";
      if (wkContent.indexOf(wkFileName) < 0) {
        var wMarker = '<div class="scroll-list">';
        var wPos = wkContent.indexOf(wMarker);
        if (wPos > 0) {
          var wLineStart = wkContent.indexOf("\n", wPos) + 1;
          var wEntry = "- [" + wkLabel + "](./" + wkFileName + ".md)\n";
          wkContent = wkContent.substring(0, wLineStart) + wEntry + wkContent.substring(wLineStart);
          writeFileUTF8(wkIdxPath, wkContent);
        }
      }
    } catch (e) {}
  }
}function updateDailyIndex(dateStr) {
  var indexPath = path.join(OUTPUT_DIR, "index.md");
  var content;
  try { content = fs.readFileSync(indexPath, "utf-8"); } catch (e) { return; }

  // Check if entry already exists to avoid duplicates
  if (content.indexOf(dateStr) >= 0) return;

  // Insert new entry in the scroll-list div
  var marker = '<div class="scroll-list">';
  var insertPos = content.indexOf(marker);
  if (insertPos > 0) {
    var lineStart = content.indexOf("\n", insertPos) + 1;
    var newEntry = "- [" + dateStr + "](./" + dateStr + ".md)\n";
    content = content.substring(0, lineStart) + newEntry + content.substring(lineStart);
    fs.writeFileSync(indexPath, content, "utf-8");
  }
}
// ===================== 主流程 =====================
async function main() {
  const now = new Date();
  const dateStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0") + "-" + String(now.getDate()).padStart(2, "0");
  const dateCN = now.getFullYear() + "年" + (now.getMonth() + 1) + "月" + now.getDate() + "日";

  console.log("\n🤖 YUTATA 多Agent日报系统 v4");
  console.log("📅 " + dateCN + " | " + dateStr);
  console.log("👥 五个角色: 采集师 · 核查师 · 分析师 · 编辑师 · 记忆管理师\n");

  // ===== 初始化 =====
  log("system", "阶段0: 初始化");
  const state = createInitialState(dateStr);
  state.phase = "init";

  // ===== 首次抓取 =====
  log("system", "阶段1: 首次抓取");
  state.phase = "collecting";
  const history = loadHistory();
  log("system", "历史去重: " + history.seenUrls.size + " URL");

  const rssResults = await Promise.all(SOURCES.map(src => fetchRSS(src)));
  let idCounter = 0;
  for (let i = 0; i < SOURCES.length; i++) {
    for (const item of rssResults[i]) {
      if (history.seenUrls.has(item.link)) continue;
      const nt = normalizeTitle(item.title);
      if (history.seenTitles.has(nt)) continue;
      const kw = matchKeywords(item.title + " " + item.summary);
      idCounter++;
      state.rawItems.push({
        id: "RAW-" + dateStr + "-" + String(idCounter).padStart(4, "0"),
        ...item, keywords_matched: kw,
        category: kw.length > 0 ? kw[0] : "其他", status: "pending"
      });
    }
  }
  state.stats.collectorSubmitted = state.rawItems.length;
  log("collector", "首次抓取: " + state.rawItems.length + " 条新内容");

  state.messages.push(createMessage("collector", "verifier", "NOTIFY",
    "首次采集完成，" + state.rawItems.length + " 条待审核", "请开始核查", "今日基础素材", "high"));

  // ===== 多轮博弈 =====
  for (let round = 1; round <= state.maxRounds; round++) {
    state.round = round;
    log("system", "\n━━━ 第 " + round + "/" + state.maxRounds + " 轮 ━━━");

    const agentsToRun = [];
    const hasPendingSupp = state.supplementRequests.some(r => r.status === "pending");
    const hasDisputes = state.messages.slice(-10).some(m => m.type === "DISPUTE" && m.to === "collector");
    if ((hasPendingSupp || hasDisputes || round <= 2) && round <= 4) agentsToRun.push("collector");
    if (state.rawItems.some(i => i.status === "pending") && round <= 4) agentsToRun.push("verifier");
    if (state.verifiedItems.length > 0 && round <= 4) agentsToRun.push("analyst");
    if (round >= 2 && state.verifiedItems.length > 0 && round <= 5) agentsToRun.push("editor");
    if (round >= 2 || state.deadlockDetected) agentsToRun.push("memory-manager");

    if (agentsToRun.length === 0) { log("system", "第" + round + "轮跳过"); continue; }
    log("system", "参与: " + agentsToRun.map(a => AGENT_NAMES_CN[a]).join("、"));

    const agentResults = {};
    await Promise.all(agentsToRun.map(async (agentId) => {
      agentResults[agentId] = await runAgent(agentId, state);
    }));

    // 处理输出
    for (const [agentId, result] of Object.entries(agentResults)) {
      if (!result || result.error) continue;

      if (agentId === "collector" && result.actions) {
        for (const action of result.actions) {
          if (action.type === "collect" && action.items) {
            for (const item of action.items) {
              idCounter++;
              const kw = matchKeywords(item.title + " " + (item.summary || ""));
              state.rawItems.push({
                id: "RAW-" + dateStr + "-" + String(idCounter).padStart(4, "0"),
                ...item, keywords_matched: kw,
                category: kw.length > 0 ? kw[0] : "其他", status: "pending"
              });
            }
            state.stats.collectorSubmitted += (action.items?.length || 0);
          }
          if (action.type === "supplement_collect" && action.response_to_request) {
            const req = state.supplementRequests.find(r => r.request_id === action.response_to_request);
            if (req) { req.status = "fulfilled"; state.stats.analystHitRate += 10; }
          }
        }
      }

      if (agentId === "verifier" && result.actions) {
        for (const action of result.actions) {
          if (action.type === "verify" && action.item_id) {
            const item = state.rawItems.find(i => i.id === action.item_id);
            if (!item) continue;
            item.status = action.decision;
            item.verify_reason = action.reason;
            item.category = action.category || item.category;
            if (action.decision === "pass") { state.verifiedItems.push(item); state.stats.verifierPassed++; }
            else { state.rejectedItems.push(item); state.stats.verifierRejected++; }
          }
        }
      }

      if (agentId === "analyst" && result.actions) {
        for (const action of result.actions) {
          if (action.type === "analyze" && action.insight) {
            state.insights.push({ id: "INS-" + dateStr + "-" + String(state.insights.length + 1).padStart(3, "0"), ...action.insight });
          }
          if (action.type === "request_supplement" && action.request) {
            state.supplementRequests.push({
              request_id: "REQ-" + dateStr + "-" + String(state.supplementRequests.length + 1).padStart(3, "0"),
              ...action.request, status: "pending", requested_by: "analyst"
            });
            state.stats.analystRequests++;
          }
        }
      }

      if (agentId === "editor" && result.actions) {
        for (const action of result.actions) {
          if (action.type === "draft_update" && action.draft) state.draft = action.draft;
        }
      }
      // Editor fallback: if _parse_failed, try to extract draft from raw output
      if (agentId === "editor" && result._parse_failed && result.raw_output) {
        const raw = result.raw_output;
        // Try to extract markdown sections
        const sections = [];
        const sectionRegex = /##\s+(.+?)\n\n([\s\S]*?)(?=\n##\s|\n---\s|\n$)/g;
        let match;
        while ((match = sectionRegex.exec(raw)) !== null) {
          sections.push({ title: match[1].trim(), content: match[2].trim(), referenced_items: [], referenced_insights: [] });
        }
        if (sections.length > 0) {
          state.draft = { sections, word_count_estimate: raw.length };
          log("editor", "从原始输出恢复草稿: " + sections.length + " 个章节");
        }
      }

      if (agentId === "memory-manager" && result.actions) {
        for (const action of result.actions) {
          if (action.type === "update_rule") state.stats.ruleChanges = (state.stats.ruleChanges || 0) + 1;
          if (action.type === "update_reputation") {
            updateReputation(action.agent, action.delta, action.reason);
            state.reputation = require("./agents/shared").loadReputation();
          }
        }
        if (result.review) state.review = result.review;
      }
    }

    state.round = round;
    state.stats.roundExecuted = round;

    // 检测僵局
    if (round >= 3 && detectDeadlock(state)) {
      state.deadlockDetected = true;
      log("system", "⚠️ 僵局触发");
      if (state.messages.some(m => m.type === "PRIORITY_OVERRIDE")) {
        const emResult = await handleEmergencyChannel(state);
        state.emergencyChannel = emResult;
      }
      const verdict = await runArbitration(state);
      if (verdict && verdict.action_items) {
        for (const item of verdict.action_items) log("system", "📋 执行: " + item);
      }
      break;
    }
  }

  // ===== 收敛: 最终复盘 =====
  log("system", "\n━━━ 收敛阶段 ━━━");
  state.phase = "convergence";

  const finalInst = "## 最终复盘\n你是记忆管理师，今日" + dateCN + "。评估日报质量（完整性/准确性/深度/可读性0-10分）、优缺点、规则修改建议、信誉分调整。\n输出: { \"review\": { \"quality_scores\": {...}, \"strengths\": [...], \"weaknesses\": [...], \"root_cause\": \"...\" }, \"actions\": [{\"type\":\"update_rule\",\"rule_file\":\"...\",\"change_type\":\"add/modify\",\"after\":\"...\",\"reason\":\"...\"}], \"internal_thought\": \"...\" }";
  const finalReview = await runAgent("memory-manager", state, finalInst);

  if (finalReview.actions) {
    for (const action of finalReview.actions) {
      if (action.type === "update_rule" && action.rule_file) {
        const version = generateRuleVersion(dateStr);
        const rulePath = path.join(RULES_DIR, action.rule_file);
        const archivePath = path.join(RULES_DIR, "archive", action.rule_file.replace(".md", "-" + version + ".md"));
        try {
          const oldContent = fs.readFileSync(rulePath, "utf-8");
          fs.writeFileSync(archivePath, "# " + action.rule_file + " - " + version + "\n> 归档: " + dateStr + "\n\n" + oldContent, "utf-8");
        } catch {}
        const header = "---\ntitle: " + action.rule_file.replace(".md", "") + "\nversion: " + version + "\nupdated: " + dateStr + "\noutline: [2, 3]\n---\n\n> 📌 " + version + " | " + dateCN + "\n\n";
        writeFileUTF8(rulePath, header + (action.after || ""));
        log("memory-manager", "规则更新: " + action.rule_file + " → " + version);
      }
      if (action.type === "update_reputation" && action.agent) {
        updateReputation(action.agent, action.delta, action.reason);
      }
    }
  }
  state.review = finalReview.review || state.review;

  // ===== 生成日报 =====
  log("system", "\n━━━ 生成日报 ━━━");
  let report;
  if (state.draft && state.draft.sections) {
    const filteredSections = state.draft.sections.filter(function(s) { return !s.title || !/[\u53C2\u8003\u94FE\u63A5]/.test(s.title.replace(/[^\u4e00-\u9fff]/g, "")); });
    const sections = filteredSections.map(s => "## " + s.title + "\n\n" + s.content + "\n").join("\n---\n\n");
    report = "---\ntitle: " + dateStr + " | 行业雷达日报\noutline: [2, 3]\n---\n\n# 📡 行业雷达 · " + dateCN + "\n\n> 📮 采集 " + state.rawItems.length + " 篇 | 命中 " + state.verifiedItems.length + " 篇 | 多Agent博弈生成\n> 🤖 采集师·核查师·分析师·编辑师·记忆管理师\n\n" + sections + "\n---\n\n## 📮 参考链接\n\n<div class=\"ref-scroll\">\n" + state.verifiedItems.map((item, idx) => "<p id=\"ref-" + (idx + 1) + "\">[" + (idx + 1) + "] **" + item.title + "** · " + item.source + " · <a href=\"" + item.link + "\">链接</a></p>").join("\n") + "\n</div>\n\n---\n\n## 📊 数据统计\n\n| 来源 | 语言 | 采集数 |\n|------|------|--------|\n" + [...new Set(state.rawItems.map(i => i.source))].map(src => "| " + src + " | " + (state.rawItems.find(i => i.source === src)?.lang === "zh" ? "中文" : "EN") + " | " + state.rawItems.filter(i => i.source === src).length + " |").join("\n") + "\n\n> 生成时间: " + now.toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) + "\n> [查看过程日志](../logs/" + dateStr + ".md)\n";
  } else {
    report = "---\ntitle: " + dateStr + " | 行业雷达日报\noutline: [2, 3]\n---\n\n# 📡 行业雷达 · " + dateCN + "\n\n> ⚠️ 今日多Agent系统未产出完整日报\n> [查看过程日志](../logs/" + dateStr + ".md)\n\n## 采集概况\n- 采集 " + state.rawItems.length + " 篇 | 通过 " + state.verifiedItems.length + " 篇\n";
  }
  writeFileUTF8(path.join(OUTPUT_DIR, dateStr + ".md"), report);
  log("system", "日报已保存: " + dateStr + ".md");

  // ===== 过程日志 =====
  log("system", "\n━━━ 生成过程日志 ━━━");
  writeFileUTF8(path.join(LOGS_DIR, dateStr + ".md"), generateProcessLog(state, dateStr));
  log("system", "日志已保存: logs/" + dateStr + ".md");

  updateDailyIndex(dateStr);

  // ===== 周报 =====
  if (now.getDay() === 0) {
    log("system", "\n━━━ 生成周报 ━━━");
    const wn = (function(d) { const start = new Date(d.getFullYear(), 0, 1); const days = Math.floor((d - start) / 86400000); return Math.ceil((days + start.getDay() + 1) / 7); })(now);
    writeFileUTF8(path.join(WEEKLY_DIR, "review-" + dateStr.slice(0, 4) + "-W" + String(wn).padStart(2, "0") + ".md"), generateWeeklyReport(state, dateStr));
    log("system", "周报已保存");
  }

  console.log("\n✅ 多Agent日报系统完成");
  console.log("   📰 docs/daily/" + dateStr + ".md");
  console.log("   📋 docs/logs/" + dateStr + ".md");
  console.log("   ⚖️ 仲裁: " + (state.deadlockDetected ? "触发" : "未触发"));
  console.log("   ⚡ 紧急: " + (state.emergencyChannel ? "触发" : "未触发"));
  console.log("   📝 规则变更: " + (state.stats.ruleChanges || 0) + " 条\n");
}

main().catch((err) => {
  console.error("致命错误:", err);
  process.exit(1);
});
