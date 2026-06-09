---
layout: home

hero:
  name: "Beppi's Archive"
  text: "知識の手帖"
  tagline: 通识 · 产品 · 思考 · 记录
  actions:
    - theme: brand
      text: 通识积累 →
      link: /general/
    - theme: alt
      text: 关于
      link: /about
---

<div class="sections">

  <a href="/growth/" class="section-card">
    <div class="card-num">01</div>
    <div class="card-body">
      <h3>上升清单</h3>
      <p>成长轨迹与自我剖析</p>
    </div>
    <span class="card-arrow">→</span>
  </a>

  <a href="/general/" class="section-card featured">
    <div class="card-num">02</div>
    <div class="card-body">
      <h3>通识积累</h3>
      <p>影视 · 音乐 · 烹饪 · 运营</p>
    </div>
    <span class="card-arrow">→</span>
  </a>

  <a href="/pilgrimage/" class="section-card">
    <div class="card-num">03</div>
    <div class="card-body">
      <h3>圣地巡礼</h3>
      <p>足迹与见闻</p>
    </div>
    <span class="card-arrow">→</span>
  </a>

  <a href="/music-product/" class="section-card">
    <div class="card-num">04</div>
    <div class="card-body">
      <h3>云音乐产品学习</h3>
      <p>产品思维与行业洞察</p>
    </div>
    <span class="card-arrow">→</span>
  </a>

  <a href="/interview/" class="section-card">
    <div class="card-num">05</div>
    <div class="card-body">
      <h3>校招面试话术</h3>
      <p>实战记录与复盘</p>
    </div>
    <span class="card-arrow">→</span>
  </a>

</div>

<style>
/* ========== Hero ========== */
.VPHero {
  padding: 3rem 0 2rem !important;
}
.VPHero .name {
  font-size: 2.8rem !important;
  font-weight: 700;
  letter-spacing: 6px;
}
.VPHero .text {
  font-size: 1.1rem !important;
  font-weight: 400;
  letter-spacing: 6px;
  color: var(--vp-c-text-2);
  margin-top: 0.3rem;
}
.VPHero .tagline {
  font-size: 0.85rem !important;
  letter-spacing: 4px;
  color: var(--vp-c-text-3);
  margin-top: 0.5rem;
}

/* ========== 分区卡片 ========== */
.sections {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 600px;
  margin: 3rem auto 0;
  padding: 0 1rem;
}

.section-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg-elv);
  text-decoration: none !important;
  color: var(--vp-c-text-1) !important;
  transition: all 0.25s ease;
}

.section-card:hover {
  border-color: var(--vermillion);
  transform: translateX(4px);
  box-shadow: 2px 2px 0 rgba(186, 46, 31, 0.08);
}

.section-card.featured {
  border-color: var(--gold);
  background: linear-gradient(to right, rgba(196, 163, 90, 0.04), transparent);
}

.card-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  min-width: 24px;
}

.card-body { flex: 1; }
.card-body h3 {
  font-family: 'Noto Serif SC', serif;
  font-size: 0.95rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: 2px;
}
.card-body p {
  font-size: 0.78rem;
  color: var(--vp-c-text-2);
  margin: 4px 0 0;
}

.card-arrow {
  font-family: 'JetBrains Mono', monospace;
  color: var(--vp-c-text-3);
  font-size: 0.85rem;
}
.section-card:hover .card-arrow {
  color: var(--vermillion);
}
</style>
