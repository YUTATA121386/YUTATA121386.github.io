---
layout: page
---

<div class="home">

<header class="home-hero">
<div class="hero-mark">私人档案馆 · 知识手帖</div>
<h1 class="hero-name">YUTATA</h1>
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
<span class="entry-meta">日剧评级 · 法餐技法 · 唱片评价 · 曲库运营</span>
</div>
<span class="entry-arrow">→</span>
</a>

<a href="/pilgrimage/" class="index-entry dimmed">
<span class="entry-num">02</span>
<div class="entry-body">
<span class="entry-title">圣地巡礼</span>
<span class="entry-meta">足迹 · 取景地 · 文化见闻</span>
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
<span class="entry-meta">年报 · 翻译编辑部 · AI 项目 · H5 活动 · 线下活动 · 用户时期</span>
</div>
<span class="entry-arrow">→</span>
</a>

<a href="/growth/" class="index-entry dimmed">
<span class="entry-num">04</span>
<div class="entry-body">
<span class="entry-title">上升清单</span>
<span class="entry-meta">成长轨迹 · 自我剖析 · 关键决策</span>
</div>
<span class="entry-badge">施工中</span>
</a>

<a href="/interview/" class="index-entry">
<span class="entry-num">05</span>
<div class="entry-body">
<span class="entry-title">校招面试话术</span>
<span class="entry-meta">实习准备 · 通用高频题 · 六家公司面经</span>
</div>
<span class="entry-arrow">→</span>
</a>
</div>

</nav>

<div class="home-status">
<div class="status-item">
<span class="status-count">5</span>
<span class="status-label">已归档卷册</span>
</div>
<div class="status-divider"></div>
<div class="status-item">
<span class="status-count">3</span>
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

<!-- ═══════════════════════════════
    首页 · 垂直索引式
    ═══════════════════════════════ -->

<style>
.home {
min-height: 100vh;
display: flex;
flex-direction: column;
align-items: center;
padding: 4rem 2rem 3rem;
max-width: 640px;
margin: 0 auto;
}

.home-hero {
text-align: center;
margin-bottom: 2.5rem;
width: 100%;
}

.hero-mark {
font-size: 0.65rem;
letter-spacing: 0.4em;
color: var(--red);
margin-bottom: 1.2rem;
font-family: 'Noto Serif SC', serif;
}

.hero-name {
font-size: 4rem;
font-weight: 900;
letter-spacing: 0.28em;
margin: 0 0 0.6rem;
color: var(--ink);
font-family: 'Noto Serif SC', serif;
line-height: 1;
}

.hero-line {
font-size: 0.9rem;
color: var(--ink-soft);
letter-spacing: 0.12em;
margin: 0 0 0.6rem;
font-family: 'Noto Serif SC', serif;
}

.hero-desc {
font-size: 0.8rem;
line-height: 2.1;
color: var(--ink-light);
letter-spacing: 0.04em;
margin: 0;
}

.hero-rule {
width: 40px;
height: 3px;
background: var(--gold);
margin: 2rem auto 0;
}

.home-index {
width: 100%;
display: flex;
flex-direction: column;
gap: 2.2rem;
margin-bottom: 2rem;
}

.section-head {
display: flex;
align-items: center;
gap: 8px;
margin-bottom: 0.8rem;
padding-left: 2px;
}

.section-char {
font-family: 'Noto Serif SC', serif;
font-size: 0.7rem;
color: var(--red);
border: 1px solid var(--red);
padding: 0 5px;
line-height: 1.4;
}

.section-label {
font-size: 0.62rem;
letter-spacing: 0.22em;
color: var(--ink-light);
font-family: 'Noto Serif SC', serif;
}

.index-entry {
display: flex;
align-items: center;
gap: 1rem;
padding: 1.1rem 0;
border-bottom: 1px solid var(--line);
text-decoration: none !important;
color: var(--ink) !important;
transition: all 0.25s ease;
}

.index-entry:hover {
padding-left: 1rem;
background: rgba(0,0,0,0.008);
}

.index-entry:first-of-type { border-top: 1px solid var(--line); }

.index-entry.dimmed { opacity: 0.35; }
.index-entry.dimmed:hover { opacity: 0.6; padding-left: 0; }

.entry-num {
font-family: 'Courier New', monospace;
font-size: 0.66rem;
color: var(--ink-light);
width: 1.6rem;
flex-shrink: 0;
}

.entry-body {
flex: 1;
display: flex;
flex-direction: column;
gap: 2px;
}

.entry-title {
font-size: 1rem;
font-weight: 700;
letter-spacing: 0.06em;
}

.entry-meta {
font-size: 0.68rem;
color: var(--ink-light);
letter-spacing: 0.04em;
}

.entry-arrow {
font-size: 0.9rem;
color: var(--ink-light);
flex-shrink: 0;
transition: transform 0.2s;
}

.index-entry:hover .entry-arrow {
transform: translateX(4px);
color: var(--red);
}

.entry-badge {
font-size: 0.55rem;
letter-spacing: 0.1em;
color: var(--ink-light);
border: 1px solid var(--line);
padding: 2px 8px;
flex-shrink: 0;
}

.home-status {
display: flex;
align-items: center;
gap: 1rem;
padding: 1.5rem 0;
width: 100%;
justify-content: center;
}

.status-item {
display: flex;
flex-direction: column;
align-items: center;
gap: 2px;
}

.status-count {
font-family: 'Courier New', monospace;
font-size: 1.1rem;
font-weight: 700;
color: var(--ink);
}

.status-label {
font-size: 0.6rem;
letter-spacing: 0.08em;
color: var(--ink-light);
}

.status-divider {
width: 1px;
height: 28px;
background: var(--line);
}

.home-foot {
text-align: center;
margin-top: 1.5rem;
padding-top: 1.5rem;
border-top: 1px solid var(--line);
width: 100%;
}

.home-foot p {
font-size: 0.6rem;
color: var(--ink-light);
letter-spacing: 0.18em;
margin: 0;
}

@media (max-width: 768px) {
.home { padding: 2.5rem 1.2rem 2rem; }
.hero-name { font-size: 2.6rem; letter-spacing: 0.2em; }
.entry-meta { display: none; }
.index-entry { padding: 0.9rem 0; }
.hero-desc br { display: none; }
}
</style>
