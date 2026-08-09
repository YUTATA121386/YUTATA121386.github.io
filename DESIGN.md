# DESIGN.md — 拾光声学档案（已批准视觉世界 v2）

> 本文件记录已获用户批准的视觉世界（概念稿 visual-mock-v2，2026-07-21）。迁移到 VitePress 时忠实继承；打磨仅限 craft-floor 质量底线，不改变方向。

## 概念
黑胶唱片机 × 私人档案 × 东京大饭店式杂志感。把热爱刻成唱片，把思考留在纹槽里。

## 三档（taste-skill）
- VARIANCE 8（唱片机首页是创意锚点）
- MOTION 5（唱臂落针/唱片旋转/猫头鹰瞳孔/羽毛视差，全部 rAF 节流或 CSS 变换）
- DENSITY 4（编辑式留白 + 档案密度）

## 字体
- Fraunces：展示数字（时钟、统计数字）
- Noto Serif SC：中文正文/标题（文章阅读）
- Noto Sans SC：UI 标签/正文辅助
- JetBrains Mono：代码/数据/标签/罗马数字

## 时段配色（data-palette 属性，auto 按小时）
- morning 5-11 / noon 11-17 / dusk 17-21 / night 其余（night 同时启用 VitePress .dark）
- 每时段定义：--bg、--blob1-3（背景光斑）、--flute1-3（竖条光纹）、--glow、--ink/--ink2/--ink3、--accent（唯一强调色）、--live（直播红）、--glass-*（玻璃高光/边框/高光描边）、--shadow
- 强调色：morning 金 #a8761f / noon 青蓝 #2b6f8f / dusk 陶红 #b04a30 / night 暖金 #caa14f

## 组件语言
- 玻璃卡 `.glass`：135deg 渐变（高光→低光）+ 1px 高光边框 + 内侧高光描边；仅顶栏和 player-info 使用 backdrop-blur(10px)，卡片无 blur（性能）
- 背景 `.bg`：4 层 fixed（wash 光斑 / flute 竖纹漂移 / light 跟随鼠标 / grain 噪点）
- 顶栏：悬浮胶囊玻璃条（12px 上间距、圆角 18px），左猫头鹰+品牌，右时段切换
- 猫头鹰：几何风（金圈眼+三角喙），瞳孔 rAF 跟随鼠标，夜间发光
- 唱片机：6 卷按钮 → 唱针落下（0.55s 弹性）+ 唱片旋转（4.5s/圈，悬停 1.5s 后 12s/圈），唱片标签反向旋转 counterSpin，标签色 = 各卷主色
- 此刻 Bento：时钟（Fraunces 大数字）+ 最近更新 + ABOUT + 统计
- 文章页：右侧圆点导航（hover 显示章节名、当前章节常驻高亮，<900px 隐藏）+ 8 片羽毛滚动视差（金色渐变、drop-shadow）
- 栏目落地页：罗马数字卷号 + EN 标题 + 描述 + 玻璃卡片网格

## 运动与性能红线
- 只用 transform/opacity 动画；rAF 节流 JS；will-change 仅唱臂与瞳孔
- backdrop-filter 仅顶栏与 player-info
- prefers-reduced-motion 全部降级
- 卡片 hover 仅 translateY + 阴影

## 打磨决策（craft-floor 对齐）
- 顶栏/侧边栏导航去掉 emoji，用纯文字排版（杂志感）
- 落地卡片 emoji 图标替换为统一 SVG 线稿（组件内新卡片）；正文内容里既有 emoji 保留（内容而非界面装饰）
- 文本对比度：正文 ink 于 --bg 上 ≥7:1，次要文字 ink2 ≥4.5:1；极小标注 ink3 仅用于元信息
- 焦点环/滚动条/选区/下划线偏移按时段配色主题化
