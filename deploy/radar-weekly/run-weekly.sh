#!/usr/bin/env bash
# run-weekly.sh — 周一 08:00 自动生成「行业雷达 V2 周报」并提交到知识库 repo
# 由 cron 调用；需在服务器（安装了 dsh + 技能 + LLM Key）上执行。
set -euo pipefail

REPO_DIR="/opt/yutata-kb"
cd "$REPO_DIR"

log(){ echo "[weekly $(date '+%F %T')] $*"; }
source "$HOME/.dsh/.llm.env" 2>/dev/null || true   # 读取 DEEPSEEK_API_KEY

log "pull latest"
git pull --ff-only

WEEK=$(date +%G-W%V)                    # 如 2026-W37
MONTH=$(date +%Y-%m)
log "本周: $WEEK  月份: $MONTH"

# 1) 跑编排：用 DSH headless 调 radar-weekly.workflow.js（真多 Agent）。
#    —— 具体 headless 调用按 dsh CLI 校准：下面为占位；输出写入 docs/weekly/review-<week>.md。
log "run workflow via dsh headless ..."
dsh --profile headless "读取 scripts/radar-weekly.workflow.js，加载 radar-* 技能，生成 docs/weekly/review-${WEEK}.md（多Agent周报）并回写 scripts/memories/*.json、scripts/reputation-v2.json" --cwd "$REPO_DIR" \
  || log "⚠ workflow 执行返回非零，检查 dsh headless 调用/LLM Key"

# 2) 提交
if git diff --quiet && [ -z "$(git status --porcelain)" ]; then
  log "无变更"
else
  git add docs/weekly docs/logs docs/rules scripts/memories scripts/reputation-v2.json
  git commit -m "auto: radar weekly report ${WEEK}" || true
  git push origin HEAD:main || log "⚠ push 失败（多查网络/凭证）"
fi

log "done"
