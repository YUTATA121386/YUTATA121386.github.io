---
layout: home
---

<div class="home">

<header class="home-hero">
  <div class="hero-mark">知識の手帖</div>
  <h1>YUTATA</h1>
  <p class="hero-desc">一個人的私人檔案館。<br>從日劇評級到法餐筆記，從產品實戰到面試覆盤。</p>
  <div class="hero-line"></div>
</header>

<nav class="home-nav">
  <a href="/general/" class="nav-volume">
    <span class="vol-num">01</span>
    <span class="vol-title">通識積累</span>
    <span class="vol-sub">日劇 · 法餐 · 唱片 · 曲庫</span>
  </a>
  <a href="/pilgrimage/" class="nav-volume muted">
    <span class="vol-num">02</span>
    <span class="vol-title">聖地巡禮</span>
    <span class="vol-sub">足跡 · 取景地 · 見聞</span>
  </a>
  <a href="/music-product/" class="nav-volume">
    <span class="vol-num">03</span>
    <span class="vol-title">產品學習</span>
    <span class="vol-sub">年報 · 翻譯 · AI · 活動 · 用戶時期</span>
  </a>
  <a href="/growth/" class="nav-volume muted">
    <span class="vol-num">04</span>
    <span class="vol-title">上升清單</span>
    <span class="vol-sub">成長 · 剖析 · 決策</span>
  </a>
  <a href="/interview/" class="nav-volume">
    <span class="vol-num">05</span>
    <span class="vol-title">面試話術</span>
    <span class="vol-sub">實習 · 通用問題 · 六家公司</span>
  </a>
</nav>

<footer class="home-foot">
  <p>私人檔案 · 請勿轉載</p>
</footer>

</div>

<style>
.home {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  max-width: 640px;
  margin: 0 auto;
}

.home-hero { text-align: center; margin-bottom: 4rem; }
.hero-mark {
  font-size: 0.7rem;
  letter-spacing: 0.3em;
  color: var(--red);
  margin-bottom: 1rem;
  font-family: 'Noto Serif SC', serif;
}
.home-hero h1 {
  font-size: 3.2rem;
  font-weight: 900;
  letter-spacing: 0.2em;
  margin: 0 0 1rem;
  color: var(--ink);
  font-family: 'Noto Serif SC', serif;
}
.hero-desc {
  font-size: 0.85rem;
  line-height: 2;
  color: var(--ink-soft);
  letter-spacing: 0.04em;
}
.hero-line {
  width: 3em;
  height: 1px;
  background: var(--red);
  margin: 1.5rem auto 0;
}

.home-nav {
  display: flex;
  flex-direction: column;
  gap: 0;
  width: 100%;
  margin-bottom: 3rem;
}
.nav-volume {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  padding: 1.2rem 0;
  border-bottom: 1px solid var(--line);
  text-decoration: none !important;
  color: var(--ink) !important;
  transition: padding-left 0.25s ease;
}
.nav-volume:hover { padding-left: 1rem; }
.nav-volume:first-child { border-top: 1px solid var(--line); }
.nav-volume.muted { opacity: 0.35; }
.nav-volume.muted:hover { opacity: 0.6; }

.vol-num {
  font-family: 'Courier New', monospace;
  font-size: 0.7rem;
  color: var(--ink-light);
  width: 2rem;
  flex-shrink: 0;
}
.vol-title {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}
.vol-sub {
  font-size: 0.72rem;
  color: var(--ink-light);
  letter-spacing: 0.04em;
  margin-left: auto;
  text-align: right;
}

.home-foot {
  text-align: center;
}
.home-foot p {
  font-size: 0.65rem;
  color: var(--ink-light);
  letter-spacing: 0.15em;
}

@media (max-width: 768px) {
  .home { padding: 3rem 1.2rem; }
  .home-hero h1 { font-size: 2.2rem; letter-spacing: 0.12em; }
  .vol-sub { display: none; }
  .nav-volume { padding: 1rem 0; }
}
</style>
