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
      <!-- 海德薇雪鸮：圆身白羽 + 收翅 + 面盘 + 黄眼黑瞳 + 黑喙 -->
      <path class="owl-tuft" d="M13 6.5 L10.8 1.6 L16.4 4.9 Z" />
      <path class="owl-tuft" d="M35 6.5 L37.2 1.6 L31.6 4.9 Z" />
      <path class="owl-body" d="M24 5 C12.8 5 6.5 13.5 6.5 22 C6.5 32.5 13.2 42 24 42 C34.8 42 41.5 32.5 41.5 22 C41.5 13.5 35.2 5 24 5 Z" />
      <path class="owl-face" d="M24 9 C18.6 9 13.8 13.7 13.8 19.1 C13.8 24.9 18.2 29.7 24 31.3 C29.8 29.7 34.2 24.9 34.2 19.1 C34.2 13.7 29.4 9 24 9 Z" />
      <path class="owl-brow" d="M14 13.2 C15.4 11.9 17.3 11.6 18.7 12.2" />
      <path class="owl-brow" d="M34 13.2 C32.6 11.9 30.7 11.6 29.3 12.2" />
      <g class="eye" transform="translate(17.2 17.8)">
        <circle class="eye-ring" r="4.2" />
        <g class="pupil">
          <circle class="pupil-core" r="2.2" />
          <circle class="pupil-glint" cx=".9" cy="-.9" r=".75" />
        </g>
      </g>
      <g class="eye" transform="translate(30.8 17.8)">
        <circle class="eye-ring" r="4.2" />
        <g class="pupil">
          <circle class="pupil-core" r="2.2" />
          <circle class="pupil-glint" cx=".9" cy="-.9" r=".75" />
        </g>
      </g>
      <path class="owl-beak" d="M24 23.2 L25.6 25.2 C24.9 26.7 23.1 26.7 22.4 25.2 Z" />
      <path class="owl-wing" d="M9.8 19.5 C6.4 24.6 6.8 32 10.4 36.2 C13.7 34.1 14.1 27.9 9.8 19.5 Z" />
      <path class="owl-wing" d="M38.2 19.5 C41.6 24.6 41.2 32 37.6 36.2 C34.3 34.1 33.9 27.9 38.2 19.5 Z" />
      <path class="owl-wing-in" d="M13.2 25 C11.7 28.3 12.3 32 14.7 34.8" />
      <path class="owl-wing-in" d="M34.8 25 C36.3 28.3 35.7 32 33.3 34.8" />
      <path class="owl-feather" d="M19.5 35.2 C21.2 36.6 23.4 37.3 25.5 36.9" />
      <path class="owl-tail" d="M19.8 41.4 L18.8 44.6 M24 41.7 L24 45 M28.2 41.4 L29.2 44.6" />
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
  from { transform: translate(17.2px, 17.8px) scaleY(1); }
  to { transform: translate(17.2px, 17.8px) scaleY(.92); }
}
[data-palette="dusk"] .owl .eye:last-of-type { animation-name: owl-blink-r; }
@keyframes owl-blink-r {
  from { transform: translate(30.8px, 17.8px) scaleY(1); }
  to { transform: translate(30.8px, 17.8px) scaleY(.92); }
}
[data-palette="night"] .owl {
  --line: #d9b45c;
  --iris: #f0cf7a;
  --body: #f4eedd;
  --face: #faf6ea;
  --beak: #3b2f1f;
}
[data-palette="night"] .owl .eye { transform: translate(17.2px, 19.8px) scaleY(.45); }
[data-palette="night"] .owl .eye:last-of-type { transform: translate(30.8px, 19.8px) scaleY(.45); }
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