---
layout: home

hero:
  name: "YUTATA"
  text: "知識の手帖"
  tagline: 影视 · 音乐 · 烹饪 · 产品 · 思考
  actions:
    - theme: brand
      text: 通识积累 →
      link: /general/
    - theme: alt
      text: 产品学习 →
      link: /music-product/
---

<div class="home-sections">

<div class="section-group">
<div class="group-label">📚 知识沉淀</div>

<a href="/general/" class="section-card ready">
<div class="card-left"><span class="card-icon">🎬</span></div>
<div class="card-body">
<div class="card-header"><h3>通识积累</h3></div>
<p>日剧评级 · 法餐技法 · 唱片评价 · 曲库运营</p>
</div>
<span class="card-arrow">→</span>
</a>

<a href="/pilgrimage/" class="section-card building">
<div class="card-left"><span class="card-icon">⛩️</span></div>
<div class="card-body">
<div class="card-header"><h3>圣地巡礼</h3><span class="badge">施工中</span></div>
<p>足迹 · 取景地 · 文化见闻</p>
</div>
<span class="card-arrow">→</span>
</a>
</div>

<div class="section-group">
<div class="group-label">🚀 职业成长</div>

<a href="/growth/" class="section-card building">
<div class="card-left"><span class="card-icon">📈</span></div>
<div class="card-body">
<div class="card-header"><h3>上升清单</h3><span class="badge">施工中</span></div>
<p>成长轨迹 · 自我剖析 · 关键决策</p>
</div>
<span class="card-arrow">→</span>
</a>

<a href="/music-product/" class="section-card ready">
<div class="card-left"><span class="card-icon">🎧</span></div>
<div class="card-body">
<div class="card-header"><h3>云音乐产品学习</h3></div>
<p>年报 · 翻译编辑部 · AI项目 · H5活动 · 线下活动</p>
</div>
<span class="card-arrow">→</span>
</a>

<a href="/interview/" class="section-card building">
<div class="card-left"><span class="card-icon">💬</span></div>
<div class="card-body">
<div class="card-header"><h3>校招面试话术</h3><span class="badge">施工中</span></div>
<p>面试记录 · 话术复盘 · 经验沉淀</p>
</div>
<span class="card-arrow">→</span>
</a>
</div>

</div>

<style>
.VPHero { padding: 2.5rem 0 1.5rem !important; }
.VPHero .name { font-size: 3rem !important; font-weight: 700; letter-spacing: 8px; font-family: 'Noto Serif SC', serif; }
.VPHero .text { font-size: 0.95rem !important; font-weight: 400; letter-spacing: 6px; color: var(--vp-c-text-2); margin-top: 0.2rem; }
.VPHero .tagline { font-size: 0.8rem !important; letter-spacing: 3px; color: var(--vp-c-text-3); margin-top: 0.4rem; }
.VPHero .actions { margin-top: 1.5rem; }

.home-sections { max-width: 640px; margin: 0 auto; padding: 0 1.5rem 3rem; }
.section-group { margin-bottom: 2rem; }
.group-label { font-family: 'Noto Serif SC', serif; font-size: 0.7rem; letter-spacing: 4px; color: var(--vp-c-text-3); margin-bottom: 10px; padding-left: 4px; }

.section-card { display: flex; align-items: center; gap: 14px; padding: 16px 18px; margin-bottom: 8px; border: 1px solid var(--vp-c-divider); border-radius: 4px; background: var(--vp-c-bg-elv); text-decoration: none !important; color: var(--vp-c-text-1) !important; transition: all 0.25s ease; }
.section-card:hover { border-color: var(--vermillion); transform: translateX(4px); box-shadow: 2px 2px 0 rgba(186,46,31,0.06); }
.section-card.building { opacity: 0.55; }
.section-card.building:hover { opacity: 0.8; border-color: var(--vp-c-divider); transform: none; box-shadow: none; }
.card-left { display: flex; align-items: center; }
.card-icon { font-size: 1.4rem; width: 36px; text-align: center; }
.card-body { flex: 1; min-width: 0; }
.card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
.card-header h3 { font-family: 'Noto Serif SC', serif; font-size: 0.9rem; font-weight: 600; margin: 0; letter-spacing: 2px; }
.badge { font-size: 0.6rem; font-family: 'JetBrains Mono', monospace; padding: 2px 7px; border-radius: 2px; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-3); letter-spacing: 1px; background: var(--vp-c-bg-soft); }
.section-card p { font-size: 0.75rem; color: var(--vp-c-text-2); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-arrow { font-family: 'JetBrains Mono', monospace; color: var(--vp-c-text-3); font-size: 0.85rem; }
.section-card.ready:hover .card-arrow { color: var(--vermillion); }

@media (max-width: 768px) {
  .VPHero .name { font-size: 2rem !important; letter-spacing: 4px; }
  .VPHero .text { font-size: 0.8rem !important; }
  .VPHero { padding: 2rem 1rem 1rem !important; }
  .home-sections { padding: 0 1rem 2rem; max-width: 100%; }
  .section-card p { font-size: 0.7rem; }
}
@media (max-width: 480px) {
  .VPHero .name { font-size: 1.6rem !important; }
  .section-card p { display: none; }
}
</style>
