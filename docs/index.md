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

<nav class="home-grid">

<a href="/growth/" class="home-card highlight">
<div class="card-emoji">📈</div>
<div class="card-num">01</div>
<h3 class="card-title">上升清单</h3>
<p class="card-desc">自我剖析 · 关键决策</p>
<span class="card-badge live">LIVE</span>
</a>

<a href="/daily/" class="home-card highlight">
<div class="card-emoji">🛰️</div>
<div class="card-num">02</div>
<h3 class="card-title">行业雷达</h3>
<p class="card-desc">每日自动采集 · AI 深度分析 · 曲库行业动态</p>
<span class="card-badge live">LIVE</span>
</a>

<a href="/music-product/" class="home-card">
<div class="card-emoji">🎵</div>
<div class="card-num">03</div>
<h3 class="card-title">云音乐产品学习</h3>
<p class="card-desc">产品分析 · 活动运营 · 用户反馈</p>
</a>

<a href="/general/" class="home-card">
<div class="card-emoji">📚</div>
<div class="card-num">04</div>
<h3 class="card-title">通识积累</h3>
<p class="card-desc">影视评鉴 · 法餐考据 · 唱片评鉴 · 多方视角</p>
</a>

<a href="/pilgrimage/" class="home-card dimmed">
<div class="card-emoji">🚅</div>
<div class="card-num">05</div>
<h3 class="card-title">圣地巡礼</h3>
<p class="card-desc">旅行记录 · 文化考察</p>
<span class="card-badge">施工中</span>
</a>

<a href="/interview/" class="home-card">
<div class="card-emoji">💼</div>
<div class="card-num">06</div>
<h3 class="card-title">校招面试话术</h3>
<p class="card-desc">简历策略 · 高频问答 · 企业面经</p>
</a>

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
<span class="status-count">50+</span>
<span class="status-label">收录页面</span>
</div>
</div>

<footer class="home-foot">
<p>YUTATA 私人知识档案 · 请勿转载 · 持续施工中</p>
</footer>

</div>

<style>
.home { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 4rem 2rem 3rem; max-width: 1000px; margin: 0 auto; }
.home-hero { text-align: center; margin-bottom: 2.5rem; width: 100%; }
.hero-mark { font-size: 0.6rem; letter-spacing: 0.5em; color: var(--red); margin-bottom: 1.2rem; font-family: 'Noto Sans SC', sans-serif; font-weight: 500; }
.hero-name { font-size: 4rem; font-weight: 900; letter-spacing: 0.32em; margin: 0 0 0.5rem; color: var(--ink-deep); font-family: 'Noto Serif SC', serif; line-height: 1; }
.hero-line { font-size: 0.78rem; color: var(--ink-light); letter-spacing: 0.14em; margin: 0; font-family: 'Noto Serif SC', serif; }
.hero-rule { width: 2.5rem; height: 2px; background: linear-gradient(to right, transparent, var(--gold), transparent); margin: 2rem auto 0; }

/* Grid */
.home-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4rem; width: 100%; margin-bottom: 1.5rem; }

.home-card {
  display: flex; flex-direction: column; align-items: flex-start;
  padding: 1.6rem 1.4rem;
  border: 1px solid var(--line-soft); border-radius: var(--radius-md);
  background: var(--surface);
  text-decoration: none !important;
  color: var(--ink) !important;
  transition: all var(--transition-smooth);
  position: relative;
  cursor: pointer;
}
.home-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
  border-color: var(--tea-soft);
  background: linear-gradient(160deg, var(--surface) 0%, var(--tea-wash) 100%);
}
.home-card.dimmed { opacity: 0.35; }
.home-card.dimmed:hover { opacity: 0.6; transform: none; box-shadow: none; }
.home-card.highlight { border-color: var(--gold-soft); }
.home-card.highlight:hover { border-color: var(--gold); }

.card-emoji { font-size: 1.6rem; margin-bottom: 0.7rem; line-height: 1; }
.card-num { font-family: 'JetBrains Mono', monospace; font-size: 0.56rem; color: var(--ink-faint); letter-spacing: 0.1em; margin-bottom: 0.3rem; }
.card-title { font-size: 0.95rem; font-weight: 700; letter-spacing: 0.05em; color: var(--ink); margin: 0 0 0.3rem; }
.card-desc { font-size: 0.66rem; color: var(--ink-light); letter-spacing: 0.04em; margin: 0; font-family: 'Noto Sans SC', sans-serif; line-height: 1.6; }
.card-badge { position: absolute; top: 0.8rem; right: 0.8rem; font-size: 0.5rem; letter-spacing: 0.12em; color: var(--ink-light); border: 1px solid var(--line); padding: 2px 7px; border-radius: 2px; font-family: 'Noto Sans SC', sans-serif; }
.card-badge.live { color: var(--red); border-color: var(--red-soft); background: var(--red-soft); font-weight: 600; animation: pulse 2s infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }

/* Status */
.home-status { display: flex; align-items: center; gap: 1.2rem; padding: 1.5rem 0; width: 100%; justify-content: center; }
.status-item { display: flex; flex-direction: column; align-items: center; gap: 3px; }
.status-count { font-family: 'JetBrains Mono', monospace; font-size: 1.1rem; font-weight: 500; color: var(--ink); }
.status-label { font-size: 0.58rem; letter-spacing: 0.1em; color: var(--ink-light); font-family: 'Noto Sans SC', sans-serif; }
.status-divider { width: 1px; height: 28px; background: var(--line-soft); }

.home-foot { text-align: center; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--line-soft); width: 100%; }
.home-foot p { font-size: 0.56rem; color: var(--ink-faint); letter-spacing: 0.2em; margin: 0; font-family: 'Noto Sans SC', sans-serif; }

@media (max-width: 768px) { .home { padding: 2.5rem 1rem 2rem; } .hero-name { font-size: 2.5rem; } .home-grid { grid-template-columns: repeat(2, 1fr); gap: 0.8rem; } .home-card { padding: 1.2rem 1rem; } .card-desc { display: none; } }
@media (max-width: 480px) { .home-grid { grid-template-columns: 1fr; } }
</style>
