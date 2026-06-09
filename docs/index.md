---
layout: home

hero:
  name: "YUTATA"
  text: "知識の手帖"
  tagline: 通识积累 · 产品思考 · 个人记录
  actions:
    - theme: brand
      text: 通识积累
      link: /general/
    - theme: alt
      text: 产品学习
      link: /music-product/
---

<div class="archive-grid">

  <!-- Row 1: 已完成模块 -->
  <div class="section-group">
    <div class="group-label">已完成</div>
    
    <a href="/general/" class="entry-card active">
      <div class="card-meta">
        <span class="card-num">02</span>
        <span class="card-status done">已完成</span>
      </div>
      <div class="card-body">
        <h3>通识积累</h3>
        <p>日本影视评级 · 法餐技法考 · 唱片评价 · 曲库运营</p>
      </div>
      <span class="card-arrow">→</span>
    </a>

    <a href="/music-product/" class="entry-card active">
      <div class="card-meta">
        <span class="card-num">04</span>
        <span class="card-status done">已完成</span>
      </div>
      <div class="card-body">
        <h3>云音乐产品学习</h3>
        <p>年度报告 · 歌词翻译 · AI 项目 · 线下活动 · 线上沟通</p>
      </div>
      <span class="card-arrow">→</span>
    </a>
  </div>

  <!-- Row 2: 施工中模块 -->
  <div class="section-group">
    <div class="group-label">施工中</div>
    
    <a href="/growth/" class="entry-card">
      <div class="card-meta">
        <span class="card-num">01</span>
        <span class="card-status wip">🚧 施工中</span>
      </div>
      <div class="card-body">
        <h3>上升清单</h3>
        <p>成长轨迹 · 自我剖析 · 关键决策</p>
      </div>
      <span class="card-arrow">→</span>
    </a>

    <a href="/pilgrimage/" class="entry-card">
      <div class="card-meta">
        <span class="card-num">03</span>
        <span class="card-status wip">🚧 施工中</span>
      </div>
      <div class="card-body">
        <h3>圣地巡礼</h3>
        <p>旅行记录 · 取景地打卡 · 文化见闻</p>
      </div>
      <span class="card-arrow">→</span>
    </a>

    <a href="/interview/" class="entry-card">
      <div class="card-meta">
        <span class="card-num">05</span>
        <span class="card-status wip">🚧 施工中</span>
      </div>
      <div class="card-body">
        <h3>校招面试话术</h3>
        <p>面试记录 · 话术复盘 · 经验沉淀</p>
      </div>
      <span class="card-arrow">→</span>
    </a>
  </div>

</div>

<style>
/* ========== Hero ========== */
.VPHero {
  padding: 4rem 0 2.5rem !important;
}
.VPHero .name {
  font-family: 'Noto Serif SC', serif;
  font-size: 3.2rem !important;
  font-weight: 700;
  letter-spacing: 8px;
  background: linear-gradient(135deg, #1a1a1a 0%, #ba2e1f 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.dark .VPHero .name {
  background: linear-gradient(135deg, #e8e0d5 0%, #d44535 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}
.VPHero .text {
  font-family: 'Noto Serif SC', serif;
  font-size: 1rem !important;
  font-weight: 400;
  letter-spacing: 6px;
  color: var(--vp-c-text-2);
  margin-top: 0.2rem;
}
.VPHero .tagline {
  font-size: 0.78rem !important;
  letter-spacing: 4px;
  color: var(--vp-c-text-3);
  margin-top: 0.5rem;
}
.VPHero .actions {
  margin-top: 1.5rem;
}

/* ========== Archive Grid ========== */
.archive-grid {
  max-width: 660px;
  margin: 0 auto;
  padding: 0 1.5rem 3rem;
}

.section-group {
  margin-bottom: 1.5rem;
}

.group-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 3px;
  color: var(--vp-c-text-3);
  margin-bottom: 10px;
  padding-left: 2px;
}

/* ========== Entry Cards ========== */
.entry-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  margin-bottom: 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg-elv);
  text-decoration: none !important;
  color: var(--vp-c-text-1) !important;
  transition: all 0.25s ease;
}
.entry-card:hover {
  border-color: var(--vermillion);
  transform: translateX(4px);
  box-shadow: 2px 2px 0 rgba(186, 46, 31, 0.06);
}
.entry-card.active {
  border-color: rgba(196, 163, 90, 0.5);
}
.entry-card.active:hover {
  border-color: var(--vermillion);
}

.card-meta {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 48px;
}
.card-num {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--vp-c-text-2);
}
.card-status {
  font-size: 0.6rem;
  white-space: nowrap;
}
.card-status.done {
  color: var(--moss);
}
.card-status.wip {
  color: var(--stone);
  opacity: 0.7;
}

.card-body { flex: 1; min-width: 0; }
.card-body h3 {
  font-family: 'Noto Serif SC', serif;
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: 2px;
}
.card-body p {
  font-size: 0.72rem;
  color: var(--vp-c-text-2);
  margin: 3px 0 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-arrow {
  font-family: 'JetBrains Mono', monospace;
  color: var(--vp-c-text-3);
  font-size: 0.8rem;
  opacity: 0;
  transition: opacity 0.2s;
}
.entry-card:hover .card-arrow { opacity: 1; color: var(--vermillion); }

/* ========== 移动端 ========== */
@media (max-width: 640px) {
  .VPHero .name { font-size: 2.2rem !important; letter-spacing: 4px; }
  .VPHero .text { font-size: 0.85rem !important; letter-spacing: 3px; }
  .archive-grid { padding: 0 1rem 2rem; }
  .entry-card { padding: 14px; }
  .card-body p { font-size: 0.68rem; }
}
</style>
