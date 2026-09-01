# 行业雷达 V2 · 阿里云服务器部署运行手册

把"行业雷达周报"变成**周一自动、月度评审**的常驻服务。

## 前置
- 阿里云轻量服务器（Ubuntu 22.04），已装 git；能访问 GitHub（repo `YUTATA121386/YUTATA121386.github.io`）。
- 服务器有 LLM 的 API Key（DeepSeek 或所选模型）。

## 一键部署（服务器上）
```bash
# 克隆本 repo 到服务器（或直接拉取含 deploy/ 的最新版本）
git clone https://github.com/YUTATA121386/YUTATA121386.github.io.git /opt/yutata-kb
cd /opt/yutata-kb/deploy/radar-weekly

# 以 root/sudo 运行（会装 node/dsh、clone、装技能、写 key、装 cron）
DEEPSEEK_API_KEY=你的Key bash setup.sh
```

## 自动调度（setup.sh 已装）
- **周一 08:00** → `run-weekly.sh`：pull → dsh headless 跑 `radar-weekly.workflow.js`（多 Agent）→ 写 `docs/weekly/review-W##.md` + 回写记忆/信誉 → commit+push。
- **每月首周一 09:00** → `run-monthly.sh`：加载 `radar-monthly-review` 技能 → 月评 → 写 `docs/radar-v2/monthly-<月>.md`。

## 关键文件
| 文件 | 作用 |
|---|---|
| `deploy/radar-weekly/setup.sh` | 服务器一键部署 |
| `deploy/radar-weekly/run-weekly.sh` | 周一周报运行器 |
| `deploy/radar-weekly/run-monthly.sh` | 月度评审运行器 |
| `deploy/radar-weekly/cron.txt` | cron 条目 |
| `scripts/radar-weekly.workflow.js` | DSH 编排脚本 |
| `scripts/agents/reputation-v2.js` | 改进版信誉分 |
| `skills/radar-*` | 5 角色 + 月评技能 |

## 注意
- **LLM Key** 只写 `~/.dsh/.llm.env`（gitignore），不进 repo。
- `run-weekly.sh` / `run-monthly.sh` 里 `dsh --profile headless ...` 那行的**调用方式**需按你 dsh 版本校准（dsh headless 跑 workflow 的具体 CLI 我在本机无法完整验证，出问题时看 `run-weekly.log`）。
- 服务器端 dsh 更新：先停 cron 的 dsh 进程，再 `npm install -g @deepseek-ai/dsh@alpha`（参考 repo 里另一套 upgrade-dsh.ps1 的"先停服再装"教训）。
- 前端站点构建/部署仍由 repo 的 GH Actions 负责（周报 md 提交后自动触发）。
