<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue"
import { withBase } from "vitepress"

const owlEl = ref<HTMLElement | null>(null)
let raf = 0
const MAX = 1.5 // 瞳孔最大位移（viewBox 单位）
const RANGE = 170 // 鼠标距 logo 多远时位移打满
const NEAR = 230 // 鼠标进入该距离后瞳孔放大（好奇表情）

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
      <path class="owl-head" d="M24 5.5 C14.5 5.5 8.5 12.5 8.5 21.5 C8.5 30 14.5 36.5 24 36.5 C33.5 36.5 39.5 30 39.5 21.5 C39.5 12.5 33.5 5.5 24 5.5 Z" />
      <path class="owl-tuft" d="M11.5 9.5 L8 3 L16 7 Z" />
      <path class="owl-tuft" d="M36.5 9.5 L40 3 L32 7 Z" />
      <g class="eye" transform="translate(17.5 21)">
        <circle class="eye-ring" r="6" />
        <circle class="eye-bg" r="4.6" />
        <g class="pupil">
          <circle class="pupil-core" r="2" />
          <circle class="pupil-glint" cx="0.85" cy="-0.85" r="0.75" />
        </g>
      </g>
      <g class="eye" transform="translate(30.5 21)">
        <circle class="eye-ring" r="6" />
        <circle class="eye-bg" r="4.6" />
        <g class="pupil">
          <circle class="pupil-core" r="2" />
          <circle class="pupil-glint" cx="0.85" cy="-0.85" r="0.75" />
        </g>
      </g>
      <path class="owl-beak" d="M24 27.5 L26.8 31 L24 34 L21.2 31 Z" />
      <path class="owl-brow" d="M10.5 13.5 C13 11.5 15.5 11 17.5 11.5" />
      <path class="owl-brow" d="M37.5 13.5 C35 11.5 32.5 11 30.5 11.5" />
    </svg>
  </a>
</template>

<style scoped>
.owl {
  --line: #a88644;
  --line-soft: rgba(168, 134, 68, .45);
  --pupil: #3a2f24;
  --glint: #fdfaf1;
  --eye-bg: #f6efe0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 50%;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}
.owl:focus-visible { outline: 2px solid var(--line); outline-offset: 3px; }
.owl-svg {
  width: 100%;
  height: 100%;
  display: block;
  overflow: visible;
  transition: transform .3s cubic-bezier(.34, 1.56, .64, 1);
}
.owl:hover .owl-svg { transform: translateY(-1px) rotate(-3deg) scale(1.03); }
.owl:active .owl-svg { transform: scale(.95); }
.owl-head {
  fill: rgba(246, 239, 224, .5);
  stroke: var(--line);
  stroke-width: 1.4;
  stroke-linejoin: round;
}
.owl-tuft {
  fill: none;
  stroke: var(--line);
  stroke-width: 1.3;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.owl-brow {
  fill: none;
  stroke: var(--line-soft);
  stroke-width: 1;
  stroke-linecap: round;
}
.eye-ring {
  fill: none;
  stroke: var(--line);
  stroke-width: 1.4;
  transform-box: fill-box;
  transform-origin: center;
  transition: transform .5s cubic-bezier(.34, 1.4, .5, 1);
}
.eye-bg { fill: var(--eye-bg); transition: fill .5s; }
.pupil-core { fill: var(--pupil); transition: fill .5s; }
.pupil-glint { fill: var(--glint); opacity: .92; }
.pupil {
  transform: translate(var(--px, 0px), var(--py, 0px)) scale(var(--pupil, 1));
  transform-box: fill-box;
  transform-origin: center;
  transition: transform .12s ease-out;
  will-change: transform;
}
.owl-beak { fill: var(--line); transition: fill .5s; }

/* 四时段情绪：晨/午 = 圆眼；黄昏 = 暖瞳微眯；夜晚 = 眯眼 + 辉光 */
[data-palette="dusk"] .owl {
  --pupil: #7a4a28;
  --line: #b0703c;
}
[data-palette="dusk"] .owl .eye-bg { fill: #f5e3d2; }
[data-palette="dusk"] .owl .eye { animation: owl-squint 2.8s ease-in-out infinite alternate; }
@keyframes owl-squint {
  from { transform: translate(17.5px, 21px) scaleY(1); }
  to { transform: translate(17.5px, 21px) scaleY(.94); }
}
[data-palette="dusk"] .owl .eye:last-of-type { animation-name: owl-squint-r; }
@keyframes owl-squint-r {
  from { transform: translate(30.5px, 21px) scaleY(1); }
  to { transform: translate(30.5px, 21px) scaleY(.94); }
}
[data-palette="night"] .owl {
  --pupil: #e8c86a;
  --line: #d9b45c;
  --eye-bg: #14100c;
}
[data-palette="night"] .owl .eye { transform: translate(17.5px, 23px) scaleY(.45); }
[data-palette="night"] .owl .eye:last-of-type { transform: translate(30.5px, 23px) scaleY(.45); }
[data-palette="night"] .owl .eye-ring {
  animation: owl-glow 3.2s ease-in-out infinite;
}
[data-palette="night"] .owl .owl-head {
  fill: rgba(20, 16, 12, .35);
}
@keyframes owl-glow {
  0%, 100% { filter: drop-shadow(0 0 2px rgba(232, 200, 106, .55)) drop-shadow(0 0 5px rgba(232, 200, 106, .25)); }
  50% { filter: drop-shadow(0 0 3.5px rgba(232, 200, 106, .95)) drop-shadow(0 0 9px rgba(232, 200, 106, .45)); }
}
@media (prefers-reduced-motion: reduce) {
  .owl .pupil, .owl-svg { transition: none; }
  [data-palette="dusk"] .owl .eye,
  [data-palette="night"] .owl .eye-ring { animation: none; }
}
</style>
