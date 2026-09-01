#!/usr/bin/env bash
# radar-weekly-server-setup.sh — 在阿里云轻量服务器(Ubuntu)上部署「行业雷达 V2 周报」常驻自动运行
# 用法： 在服务器上以 root 或 sudo 执行：  bash radar-weekly-server-setup.sh
# 前提： 服务器已装 git / curl；你有 DeepSeek(或所选模型) 的 API Key；知识库 repo 可访问。
set -euo pipefail

DSH_HOME="$HOME/.dsh"
RADAR_REPO_DIR="/opt/yutata-kb"            # 知识库 repo 落点
KB_GIT_URL="https://github.com/YUTATA121386/YUTATA121386.github.io.git"
SKILLS_SRC="$RADAR_REPO_DIR/skills"
LLM_API_KEY="${DEEPSEEK_API_KEY:-}"        # 从环境变量读，勿明文写进 repo

log(){ echo "[setup] $*"; }

# 0) 依赖
log "apt 基础依赖"
apt-get update -y
apt-get install -y git curl ca-certificates

# 1) 装 Node 20+ 与 dsh
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  log "安装 Node 20"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
log "安装 dsh（最新 alpha）"
npm install -g @deepseek-ai/dsh@alpha

# 2) clone 知识库 repo（含 skills/ + scripts/ + docs/）
if [ ! -d "$RADAR_REPO_DIR" ]; then
  git clone "$KB_GIT_URL" "$RADAR_REPO_DIR"
else
  git -C "$RADAR_REPO_DIR" pull
fi

# 3) 安装「行业雷达」5 角色 + 月评 技能 到 DSH skills
mkdir -p "$DSH_HOME/skills"
for s in radar-collector radar-verifier radar-analyst radar-editor radar-memory-manager radar-monthly-review; do
  if [ -d "$SKILLS_SRC/$s" ]; then
    rm -rf "$DSH_HOME/skills/$s"
    cp -r "$SKILLS_SRC/$s" "$DSH_HOME/skills/$s"
    log "skill installed: $s"
  fi
done

# 4) 模型 Key（写在 DSH_HOME/.llm.env，仅本地、gitignore；勿提交）
if [ -n "$LLM_API_KEY" ]; then
  printf 'DEEPSEEK_API_KEY=%s\n' "$LLM_API_KEY" > "$DSH_HOME/.llm.env"
  log "key written to ~/.dsh/.llm.env"
else
  log "⚠ 未提供 DEEPSEEK_API_KEY，请手动写入 ~/.dsh/.llm.env 后重跑 schedule 安装"
fi

# 5) 安装 cron：周一 08:00 跑周报；每月首周一 09:00 跑月评
cron_file="$RADAR_REPO_DIR/deploy/radar-weekly/cron.txt"
(crontab -l 2>/dev/null | grep -v 'radar-weekly' ; cat "$cron_file") | crontab -
log "cron 已安装（见 deploy/radar-weekly/cron.txt）"

log "✅ 完成。下一份周报：周一 08:00 自动执行 run-weekly.sh"
