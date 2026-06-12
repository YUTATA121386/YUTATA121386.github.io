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
<p>年报 · 翻译编辑部 · AI项目 · 线下活动 · 用户时期</p>
</div>
<span class="card-arrow">→</span>
</a>

<a href="/interview/" class="section-card ready">
<div class="card-left"><span class="card-icon">💬</span></div>
<div class="card-body">
<div class="card-header"><h3>校招面试话术</h3></div>
<p>实习准备 · 通用高频问题 · 六家公司面经</p>
</div>
<span class="card-arrow">→</span>
</a>
</div>

</div>

<style>
.VPHero { padding: 3rem 0 2rem !important; }
.VPHero .container { max-width: 640px !important; }
.VPHero .name { font-size: 2.8rem !important; font-weight: 700; letter-spacing: 0.2em; font-family: 'Noto Serif SC', serif; line-height: 1.2; }
.VPHero .text { font-size: 0.95rem !important; font-weight: 400; letter-spacing: 0.3em; color: var(--vp-c-text-2); margin-top: 0.3rem; }
.VPHero .tagline { font-size: 0.78rem !important; letter-spacing: 0.2em; color: var(--vp-c-text-3); margin-top: 0.5rem; }
.VPHero .actions { margin-top: 2rem; }
.VPHero .VPButton.brand { border-radius: 3px; font-size: 0.85rem; letter-spacing: 0.06em; padding: 0.6em 1.6em; }
.VPHero .VPButton.alt { border-radius: 3px; font-size: 0.85rem; letter-spacing: 0.06em; }

.home-sections { max-width: 640px; margin: 0 auto; padding: 0 1.5rem 3rem; }
.section-group { margin-bottom: 2.2rem; }
.group-label { font-family: 'Noto Serif SC', serif; font-size: 0.7rem; letter-spacing: 0.25em; color: var(--vp-c-text-3); margin-bottom: 12px; padding-left: 4px; }

.section-card {
  display: flex; align-items: center; gap: 14px;
  padding: 17px 20px; margin-bottom: 9px;
  border: 1px solid var(--vp-c-divider); border-radius: 4px;
  background: var(--vp-c-bg-elv);
  text-decoration: none !important; color: var(--vp-c-text-1) !important;
  transition: border-color 0.25s ease, transform 0.2s ease, box-shadow 0.2s ease;
}
.section-card:hover { border-color: var(--vermillion); transform: translateX(4px); box-shadow: 2px 2px 0 var(--vermillion-faded); }
.section-card.building { opacity: 0.5; }
.section-card.building:hover { opacity: 0.75; border-color: var(--vp-c-divider); transform: none; box-shadow: none; }

.card-left { display: flex; align-items: center; }
.card-icon { font-size: 1.4rem; width: 38px; text-align: center; }
.card-body { flex: 1; min-width: 0; }
.card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; }
.card-header h3 { font-family: 'Noto Serif SC', serif; font-size: 0.92rem; font-weight: 600; margin: 0; letter-spacing: 0.08em; }
.badge { font-size: 0.6rem; font-family: 'JetBrains Mono', monospace; padding: 2px 8px; border-radius: 2px; border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-3); letter-spacing: 0.06em; background: var(--vp-c-bg-soft); }
.section-card p { font-size: 0.76rem; color: var(--vp-c-text-2); margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-arrow { font-family: 'JetBrains Mono', monospace; color: var(--vp-c-text-3); font-size: 0.85rem; transition: color 0.2s; }
.section-card.ready:hover .card-arrow { color: var(--vermillion); }

@media (max-width: 768px) {
  .VPHero .name { font-size: 2rem !important; letter-spacing: 0.12em; }
  .VPHero .text { font-size: 0.82rem !important; letter-spacing: 0.15em; }
  .VPHero { padding: 2rem 1rem 1rem !important; }
  .home-sections { padding: 0 1rem 2rem; max-width: 100%; }
  .section-card p { font-size: 0.72rem; }
}
@media (max-width: 480px) {
  .VPHero .name { font-size: 1.5rem !important; letter-spacing: 0.1em; }
  .section-card p { display: none; }
}
</style>
