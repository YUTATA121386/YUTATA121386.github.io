<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue"
import { withBase } from "vitepress"

const owlEl = ref<HTMLElement | null>(null)
let raf = 0
const MAX = 1.5
const RANGE = 170
const NEAR = 230

function onMove(e: MouseEvent) {
  if (raf) return
  raf = requestAnimationFrame(() => {
    const el = owlEl.value
    if (el) {
      const r = el.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const d = Math.hypot(dx, dy) || 1
      const k = Math.min(d / RANGE, 1) * MAX
      el.style.setProperty("--px", ((dx / d) * k).toFixed(2) + "px")
      el.style.setProperty("--py", ((dy / d) * k).toFixed(2) + "px")
      const near = Math.max(0, 1 - d / NEAR)
      el.style.setProperty("--pupil", (1 + near * 0.65).toFixed(2))
    }
    raf = 0
  })
}

function onLeave() {
  const el = owlEl.value
  if (el) {
    el.style.setProperty("--px", "0px")
    el.style.setProperty("--py", "0px")
    el.style.setProperty("--pupil", "1")
  }
}

onMounted(() => {
  window.addEventListener("mousemove", onMove, { passive: true })
  document.addEventListener("mouseleave", onLeave)
})
onBeforeUnmount(() => {
  window.removeEventListener("mousemove", onMove)
  document.removeEventListener("mouseleave", onLeave)
})
</script>

<template>
  <a ref="owlEl" class="owl" :href="withBase('/')" aria-label="拾光声学档案 · 返回首页">
    <svg class="owl-svg" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <!-- 海德薇雪鸮：金线 zine 风，耳羽 + 心形面盘 + 大黄眼黑瞳 + 黑喙 -->
      <path class="owl-tuft" d="M13 7.5 L10.8 2.2 L16.5 5.8 Z" />
      <path class="owl-tuft" d="M35 7.5 L37.2 2.2 L31.5 5.8 Z" />
      <path class="owl-body" d="M24 5.5 C15.5 5.5 10 12.5 10 21 C10 31.5 15.5 41.5 24 41.5 C32.5 41.5 38 31.5 38 21 C38 12.5 32.5 5.5 24 5.5 Z" />
      <path class="owl-face" d="M24 9.5 C19 9.5 14.5 13.5 14.5 18.5 C14.5 24 18.5 28.2 24 29.8 C29.5 28.2 33.5 24 33.5 18.5 C33.5 13.5 29 9.5 24 9.5 Z" />
      <path class="owl-brow" d="M13.8 13.8 C15.2 12.5 17.2 12.2 18.6 12.8" />
      <path class="owl-brow" d="M34.2 13.8 C32.8 12.5 30.8 12.2 29.4 12.8" />
      <g class="eye" transform="translate(17.4 18.2)">
        <circle class="eye-ring" r="5.6" />
        <g class="pupil">
          <circle class="pupil-core" r="2.6" />
          <circle class="pupil-glint" cx="1" cy="-1" r=".9" />
        </g>
      </g>
      <g class="eye" transform="translate(30.6 18.2)">
        <circle class="eye-ring" r="5.6" />
        <g class="pupil">
          <circle class="pupil-core" r="2.6" />
          <circle class="pupil-glint" cx="1" cy="-1" r=".9" />
        </g>
      </g>
      <path class="owl-beak" d="M24 23.4 L26.2 25.8 C25.3 27.8 22.7 27.8 21.8 25.8 Z" />
      <path class="owl-wing" d="M11.8 21.5 C9.2 26 9.6 31.5 13 35.8" />
      <path class="owl-wing" d="M36.2 21.5 C38.8 26 38.4 31.5 35 35.8" />
      <path class="owl-wing-in" d="M13.4 24.5 C11.8 27.8 12.4 31.6 14.9 34.4" />
      <path class="owl-wing-in" d="M34.6 24.5 C36.2 27.8 35.6 31.6 33.1 34.4" />
      <path class="owl-feather" d="M19 34.6 C20.8 36 23 36.8 25.2 36.4" />
      <path class="owl-tail" d="M19.5 40.6 L18.5 44.2 M24 40.9 L24 44.6 M28.5 40.6 L29.5 44.2" />
    </svg>
  </a>
</template>

<style scoped>
.owl {
  --line: #a88644;
  --line-soft: rgba(168, 134, 68, .5);
  --iris: #e8b93f;
  --pupil: #231c13;
  --glint: #fffdf6;
  --body: #faf6ea;
  --face: #fffdf6;
  --beak: #2a2117;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: none;
  margin-right: 10px;
  color: inherit;
  text-decoration: none;
}
.owl-svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
  transition: transform .3s cubic-bezier(.34, 1.4, .5, 1);
}
.owl:hover .owl-svg { transform: translateY(-1px) rotate(-3deg) scale(1.04); }
.owl:active .owl-svg { transform: scale(.94); }
.owl-tuft {
  fill: var(--body);
  stroke: var(--line);
  stroke-width: 1.2;
  stroke-linejoin: round;
}
.owl-body {
  fill: var(--body);
  stroke: var(--line);
  stroke-width: 1.3;
  stroke-linejoin: round;
  transition: fill .5s;
}
.owl-face { fill: var(--face); transition: fill .5s; }
.owl-brow {
  fill: none;
  stroke: var(--line-soft);
  stroke-width: 1.1;
  stroke-linecap: round;
}
.eye-ring {
  fill: var(--iris);
  stroke: var(--line);
  stroke-width: 1;
  transition: fill .5s;
}
.pupil-core { fill: var(--pupil); transition: fill .5s; }
.pupil-glint { fill: var(--glint); opacity: .92; }
.pupil {
  transform: translate(var(--px, 0px), var(--py, 0px)) scale(var(--pupil, 1));
  transform-box: fill-box;
  transform-origin: center;
  transition: transform .12s ease-out;
  will-change: transform;
}
.owl-beak { fill: var(--beak); transition: fill .5s; }
.owl-wing, .owl-wing-in, .owl-feather {
  fill: none;
  stroke: var(--line-soft);
  stroke-linecap: round;
}
.owl-wing { stroke-width: 1.2; }
.owl-wing-in { stroke-width: .9; }
.owl-feather { stroke-width: .9; }
.owl-tail {
  fill: none;
  stroke: var(--line-soft);
  stroke-width: 1.1;
  stroke-linecap: round;
}

/* 四时段情绪：晨/午 = 白羽亮眼；黄昏 = 暖羽暖瞳微眯；夜晚 = 眯眼 + 金色辉光 */
[data-palette="dusk"] .owl {
  --line: #b0703c;
  --iris: #e29a45;
  --body: #f6ead5;
  --face: #fcf4e6;
  --beak: #463424;
}
[data-palette="dusk"] .owl .eye { animation: owl-blink 3.4s ease-in-out infinite alternate; }
@keyframes owl-blink {
  from { transform: translate(17.4px, 18.2px) scaleY(1); }
  to { transform: translate(17.4px, 18.2px) scaleY(.92); }
}
[data-palette="dusk"] .owl .eye:last-of-type { animation-name: owl-blink-r; }
@keyframes owl-blink-r {
  from { transform: translate(30.6px, 18.2px) scaleY(1); }
  to { transform: translate(30.6px, 18.2px) scaleY(.92); }
}
[data-palette="night"] .owl {
  --line: #d9b45c;
  --iris: #f0cf7a;
  --body: #f4eedd;
  --face: #faf6ea;
  --beak: #3b2f1f;
}
[data-palette="night"] .owl .eye { transform: translate(17.4px, 20.2px) scaleY(.45); }
[data-palette="night"] .owl .eye:last-of-type { transform: translate(30.6px, 20.2px) scaleY(.45); }
[data-palette="night"] .owl .eye-ring {
  animation: owl-glow 3.2s ease-in-out infinite;
}
@keyframes owl-glow {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(232, 200, 106, .6)) drop-shadow(0 0 5px rgba(232, 200, 106, .3)); }
  50% { filter: drop-shadow(0 0 3.5px rgba(232, 200, 106, 1)) drop-shadow(0 0 9px rgba(232, 200, 106, .5)); }
}
@media (prefers-reduced-motion: reduce) {
  .owl .pupil, .owl-svg { transition: none; }
}
</style>