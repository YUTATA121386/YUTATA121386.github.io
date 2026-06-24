---
layout: page
---

<div class="home">

<header class="home-hero">
<div class="hero-mark">私人档案 · 知识手帖</div>
<h1 class="hero-name">YUTATA</h1>
<div class="hero-line">通识 · 产品 · 思考 · 记录</div>
<div class="hero-rule"></div>
</header>

<nav class="home-index">

<div class="index-section">
<div class="section-head">
<span class="section-char">卷</span>
<span class="section-label">归档 · Archive</span>
</div>

<a href="/general/" class="index-entry">
<span class="entry-num">01</span>
<div class="entry-body">
<span class="entry-title">通识积累</span>
<span class="entry-meta">影视评鉴 · 法餐考据 · 唱片评鉴 · 多方视角</span>
</div>
<span class="entry-arrow">→</span>
</a>

<a href="/pilgrimage/" class="index-entry dimmed">
<span class="entry-num">02</span>
<div class="entry-body">
<span class="entry-title">圣地巡礼</span>
<span class="entry-meta">旅行记录 · 文化考察</span>
</div>
<span class="entry-badge">施工中</span>
</a>
</div>

<div class="index-section">
<div class="section-head">
<span class="section-char">卷</span>
<span class="section-label">实践 · Practice</span>
</div>

<a href="/music-product/" class="index-entry">
<span class="entry-num">03</span>
<div class="entry-body">
<span class="entry-title">云音乐产品学习</span>
<span class="entry-meta">产品分析 · 活动运营 · 用户反馈</span>
</div>
<span class="entry-arrow">→</span>
</a>

<a href="/growth/" class="index-entry dimmed">
<span class="entry-num">04</span>
<div class="entry-body">
<span class="entry-title">上升清单</span>
<span class="entry-meta">自我剖析 · 关键决策</span>
</div>
<span class="entry-badge">施工中</span>
</a>

<a href="/interview/" class="index-entry">
<span class="entry-num">05</span>
<div class="entry-body">
<span class="entry-title">校招面试话术</span>
<span class="entry-meta">简历策略 · 高频问答 · 企业面经</span>
</div>
<span class="entry-arrow">→</span>
</a>

<a href="/daily/" class="index-entry">
<span class="entry-num">06</span>
<div class="entry-body">
<span class="entry-title">🛰️ 行业雷达</span>
<span class="entry-meta">每日自动采集 · AI 深度分析 · 曲库行业动态</span>
</div>
<span class="entry-arrow">→</span>
</a>
</div>

</nav>

<div class="home-status">
<div class="status-item">
<span class="status-count">6</span>
<span class="status-label">已归档卷宗</span>
</div>
<div class="status-divider"></div>
<div class="status-item">
<span class="status-count">2</span>
<span class="status-label">施工中</span>
</div>
<div class="status-divider"></div>
<div class="status-item">
<span class="status-count">40+</span>
<span class="status-label">收录页面</span>
</div>
</div>

<footer class="home-foot">
<p>YUTATA 私人知识档案 · 请勿转载 · 持续施工中</p>
</footer>

</div>

<style>
.home { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 5rem 2rem 3rem; max-width: 640px; margin: 0 auto; }
.home-hero { text-align: center; margin-bottom: 3rem; width: 100%; }
.hero-mark { font-size: 0.6rem; letter-spacing: 0.5em; color: var(--red); margin-bottom: 1.5rem; font-family: 'Noto Sans SC', sans-serif; font-weight: 500; }
.hero-name { font-size: 4.5rem; font-weight: 900; letter-spacing: 0.32em; margin: 0 0 0.6rem; color: var(--ink-deep); font-family: 'Noto Serif SC', serif; line-height: 1; }
.hero-line { font-size: 0.82rem; color: var(--ink-light); letter-spacing: 0.14em; margin: 0 0 0.6rem; font-family: 'Noto Serif SC', serif; }
.hero-rule { width: 3rem; height: 2px; background: linear-gradient(to right, transparent, var(--gold), transparent); margin: 2.2rem auto 0; }
.home-index { width: 100%; display: flex; flex-direction: column; gap: 2.4rem; margin-bottom: 2rem; }
.section-head { display: flex; align-items: center; gap: 8px; margin-bottom: 0.9rem; padding-left: 2px; }
.section-char { font-family: 'Noto Serif SC', serif; font-size: 0.65rem; color: var(--red); border: 1px solid var(--red-soft); padding: 0 5px; line-height: 1.5; letter-spacing: 0.1em; }
.section-label { font-size: 0.58rem; letter-spacing: 0.25em; color: var(--ink-light); font-family: 'Noto Sans SC', sans-serif; text-transform: uppercase; }
.index-entry { display: flex; align-items: center; gap: 1rem; padding: 1.2rem 0; border-bottom: 1px solid var(--line-soft); text-decoration: none !important; color: var(--ink) !important; transition: all var(--transition-smooth); position: relative; }
.index-entry:hover { padding-left: 1.2rem; background: linear-gradient(to right, var(--tea-wash), transparent); }
.index-entry:first-of-type { border-top: 1px solid var(--line-soft); }
.index-entry.dimmed { opacity: 0.3; }
.index-entry.dimmed:hover { opacity: 0.55; padding-left: 0; }
.entry-num { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 0.62rem; color: var(--ink-faint); width: 1.8rem; flex-shrink: 0; }
.entry-body { flex: 1; display: flex; flex-direction: column; gap: 3px; }
.entry-title { font-size: 1rem; font-weight: 700; letter-spacing: 0.06em; color: var(--ink); }
.entry-meta { font-size: 0.66rem; color: var(--ink-light); letter-spacing: 0.05em; font-family: 'Noto Sans SC', sans-serif; }
.entry-arrow { font-size: 0.8rem; color: var(--ink-faint); flex-shrink: 0; transition: transform var(--transition-fast), color var(--transition-fast); }
.index-entry:hover .entry-arrow { transform: translateX(4px); color: var(--red); }
.entry-badge { font-size: 0.52rem; letter-spacing: 0.12em; color: var(--ink-light); border: 1px solid var(--line); padding: 2px 8px; flex-shrink: 0; font-family: 'Noto Sans SC', sans-serif; border-radius: 2px; }
.home-status { display: flex; align-items: center; gap: 1.2rem; padding: 1.8rem 0; width: 100%; justify-content: center; }
.status-item { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.status-count { font-family: 'JetBrains Mono', 'Courier New', monospace; font-size: 1.2rem; font-weight: 500; color: var(--ink); }
.status-label { font-size: 0.58rem; letter-spacing: 0.1em; color: var(--ink-light); font-family: 'Noto Sans SC', sans-serif; }
.status-divider { width: 1px; height: 30px; background: var(--line-soft); }
.home-foot { text-align: center; margin-top: 1.8rem; padding-top: 1.8rem; border-top: 1px solid var(--line-soft); width: 100%; }
.home-foot p { font-size: 0.58rem; color: var(--ink-faint); letter-spacing: 0.2em; margin: 0; font-family: 'Noto Sans SC', sans-serif; }
@media (max-width: 768px) { .home { padding: 3rem 1.2rem 2rem; } .hero-name { font-size: 2.8rem; letter-spacing: 0.24em; } .entry-meta { display: none; } .index-entry { padding: 0.9rem 0; } }
</style>
