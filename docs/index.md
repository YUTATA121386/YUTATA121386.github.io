---
layout: home

hero:
  name: "YUTATA"
  text: "知識の手帖"
  tagline: 私人札記 · 影視 · 音樂 · 烹飪 · 產品 · 面試
  actions:
    - theme: brand
      text: 通識積累
      link: /general/
    - theme: alt
      text: 產品學習
      link: /music-product/
---

<div class="home-sections">

<div class="section-group">
  <div class="group-label">歸檔目錄</div>

  <a href="/general/" class="catalog-card">
    <span class="card-mark">Ⅰ</span>
    <div class="card-body">
      <h3>通識積累</h3>
      <p>日劇評級&ensp;·&ensp;法餐技法&ensp;·&ensp;唱片評價&ensp;·&ensp;曲庫運營</p>
    </div>
    <span class="card-status ready">已歸檔</span>
  </a>

  <a href="/pilgrimage/" class="catalog-card">
    <span class="card-mark">Ⅱ</span>
    <div class="card-body">
      <h3>聖地巡禮</h3>
      <p>足跡&ensp;·&ensp;取景地&ensp;·&ensp;文化見聞</p>
    </div>
    <span class="card-status pending">待整理</span>
  </a>

  <a href="/music-product/" class="catalog-card">
    <span class="card-mark">Ⅲ</span>
    <div class="card-body">
      <h3>雲音樂產品學習</h3>
      <p>年報&ensp;·&ensp;翻譯編輯部&ensp;·&ensp;AI項目&ensp;·&ensp;線下活動&ensp;·&ensp;用戶時期</p>
    </div>
    <span class="card-status ready">已歸檔</span>
  </a>

  <a href="/growth/" class="catalog-card">
    <span class="card-mark">Ⅳ</span>
    <div class="card-body">
      <h3>上升清單</h3>
      <p>成長軌跡&ensp;·&ensp;自我剖析&ensp;·&ensp;關鍵決策</p>
    </div>
    <span class="card-status pending">待整理</span>
  </a>

  <a href="/interview/" class="catalog-card">
    <span class="card-mark">Ⅴ</span>
    <div class="card-body">
      <h3>校招面試話術</h3>
      <p>實習準備&ensp;·&ensp;通用高頻問題&ensp;·&ensp;六家公司面經</p>
    </div>
    <span class="card-status ready">已歸檔</span>
  </a>

</div>
</div>

<style>
/* ── Hero ── */
.VPHero {
  padding: 3rem 0 1.5rem !important;
  text-align: center;
}
.VPHero .container { max-width: 560px !important; }
.VPHero .name {
  font-family: 'Noto Serif SC', serif;
  font-size: 2.4rem !important;
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--ink);
  line-height: 1.3;
}
.VPHero .text {
  font-size: 0.85rem !important;
  font-weight: 400;
  letter-spacing: 0.2em;
  color: var(--ink-muted);
  margin-top: 0.4rem;
  font-family: 'Noto Serif SC', serif;
}
.VPHero .tagline {
  font-size: 0.7rem !important;
  letter-spacing: 0.15em;
  color: var(--ink-muted);
  margin-top: 0.8rem;
}
.VPHero .actions { margin-top: 1.8rem; justify-content: center; }
.VPHero .VPButton.brand {
  border-radius: 0;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  padding: 0.55em 1.8em;
  font-family: 'Noto Serif SC', serif;
  border: 1px solid var(--red-seal);
  background: transparent;
  color: var(--red-seal);
}
.VPHero .VPButton.brand:hover { background: var(--red-seal); color: #fff; }
.VPHero .VPButton.alt {
  border-radius: 0;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  padding: 0.55em 1.8em;
  font-family: 'Noto Serif SC', serif;
  border: 1px solid var(--line);
  background: transparent;
  color: var(--ink-soft);
}
.VPHero .VPButton.alt:hover { border-color: var(--ink); color: var(--ink); }

/* ── 目錄卡片 ── */
.home-sections { max-width: 560px; margin: 0 auto; padding: 0 1.5rem 3rem; }
.section-group { }
.group-label {
  font-family: 'Noto Serif SC', serif;
  font-size: 0.65rem;
  letter-spacing: 0.25em;
  color: var(--ink-muted);
  margin-bottom: 14px;
  padding-left: 4px;
}

.catalog-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 18px;
  margin-bottom: 1px;
  border: none;
  border-bottom: 1px solid var(--line-soft);
  background: transparent;
  text-decoration: none !important;
  color: var(--ink) !important;
  transition: background 0.2s ease;
}
.catalog-card:hover { background: var(--paper-warm); }
.catalog-card:first-of-type { border-top: 1px solid var(--line-soft); }

.card-mark {
  font-family: 'Noto Serif SC', serif;
  font-size: 0.9rem;
  color: var(--ink-muted);
  width: 28px;
  text-align: center;
  flex-shrink: 0;
}

.card-body { flex: 1; min-width: 0; }
.card-body h3 {
  font-family: 'Noto Serif SC', serif;
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  margin: 0 0 3px 0;
  color: var(--ink);
}
.card-body p {
  font-size: 0.72rem;
  color: var(--ink-muted);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-status {
  font-size: 0.6rem;
  letter-spacing: 0.08em;
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 0;
}
.card-status.ready { color: var(--ink-muted); border: 1px solid var(--line); }
.card-status.pending { color: var(--ink-muted); border: 1px dashed var(--line); opacity: 0.5; }

/* ── 移動端 ── */
@media (max-width: 768px) {
  .VPHero .name { font-size: 1.6rem !important; letter-spacing: 0.1em; }
  .VPHero .text { font-size: 0.72rem !important; letter-spacing: 0.12em; }
  .VPHero { padding: 2rem 1rem 1rem !important; }
  .home-sections { padding: 0 1rem 2rem; max-width: 100%; }
  .catalog-card { padding: 14px 12px; }
  .card-body p { font-size: 0.68rem; }
}
@media (max-width: 480px) {
  .VPHero .name { font-size: 1.3rem !important; }
  .card-body p { display: none; }
}
</style>
