#!/usr/bin/env bash
# run-monthly.sh — 每月首周一 09:00 跑「行业雷达·月度评审」并提交
set -euo pipefail
REPO_DIR="/opt/yutata-kb"
cd "$REPO_DIR"
source "$HOME/.dsh/.llm.env" 2>/dev/null || true
log(){ echo "[monthly $(date '+%F %T')] $*"; }

git pull --ff-only
MONTH=$(date +%Y-%m)
log "月评: $MONTH"

dsh --profile headless "加载 skill: radar-monthly-review，读本月 docs/weekly/* 与 docs/logs/*，产出 docs/radar-v2/monthly-${MONTH}.md（含质量分/改进计划/信誉调整，回写 scripts/reputation-v2.json）" --cwd "$REPO_DIR" \
  || log "⚠ 月评执行非零，检查"

git add docs/radar-v2 scripts/reputation-v2.json docs/rules
git commit -m "auto: radar monthly review ${MONTH}" || true
git push origin HEAD:main || log "⚠ push 失败"
log "done"
