<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue"
import { withBase } from "vitepress"

const owlEl = ref<HTMLElement | null>(null)
let raf = 0
const MAX = 1.3 // 瞳孔最大位移（viewBox 单位），保证不越出巩膜
const RANGE = 160 // 鼠标距 logo 多远时位移打满

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
    }
    raf = 0
  })
}

function onLeave() {
  const el = owlEl.value
  if (el) {
    el.style.setProperty("--px", "0px")
    el.style.setProperty("--py", "0px")
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
    <svg class="owl-svg" viewBox="0 0 44 30" aria-hidden="true" focusable="false">
      <path class="owl-head"
            d="M8.5 2 L15 8 L22 6 L29 8 L35.5 2 L38.5 12.5 L31.5 22.5 L22 26.5 L12.5 22.5 L5.5 12.5 Z" />
      <path class="owl-fold" d="M9.7 4.2 L12 7.6" />
      <path class="owl-fold" d="M34.3 4.2 L32 7.6" />
      <g class="eye" transform="translate(15 13.5)">
        <circle class="eye-gold" r="4.8" />
        <circle class="eye-bg" r="3.2" />
        <g class="pupil">
          <circle class="pupil-core" r="1.65" />
          <circle class="pupil-glint" cx="0.72" cy="-0.72" r="0.6" />
        </g>
      </g>
      <g class="eye" transform="translate(29 13.5)">
        <circle class="eye-gold" r="4.8" />
        <circle class="eye-bg" r="3.2" />
        <g class="pupil">
          <circle class="pupil-core" r="1.65" />
          <circle class="pupil-glint" cx="0.72" cy="-0.72" r="0.6" />
        </g>
      </g>
      <path class="owl-beak" d="M22 17.6 L24 20 L22 22.8 L20 20 Z" />
    </svg>
  </a>
</template>

<style scoped>
.owl {
  --ink: #4a4f5a;
  --head-fill: rgb(74 79 90 / 0.07);
  --gold: #d4a020;
  --eye-bg: #181c25;
  --pupil: #04060b;
  --glint: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 30px;
  flex: 0 0 auto;
  text-decoration: none;
  border-radius: 8px;
  -webkit-tap-highlight-color: transparent;
}
.owl:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.owl-svg {
  width: 44px;
  height: 30px;
  display: block;
  overflow: visible;
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.owl:hover .owl-svg { transform: translateY(-1px) rotate(-3deg); }
.owl:active .owl-svg { transform: scale(0.96); }
.owl-head {
  fill: var(--head-fill);
  stroke: var(--ink);
  stroke-width: 1.4;
  stroke-linejoin: round;
}
.owl-fold {
  fill: none;
  stroke: var(--ink);
  stroke-width: 1;
  stroke-linecap: round;
  opacity: 0.55;
}
.eye-gold { fill: var(--gold); }
.eye-bg { fill: var(--eye-bg); }
.pupil-core { fill: var(--pupil); }
.pupil-glint { fill: var(--glint); opacity: 0.9; }
.pupil {
  transform: translate(var(--px, 0px), var(--py, 0px));
  transition: transform 0.12s ease-out;
  will-change: transform;
}
.owl-beak { fill: var(--gold); }
[data-palette="night"] .owl {
  --ink: #e8e3d6;
  --head-fill: rgb(232 227 214 / 0.08);
  --eye-bg: #0d1119;
}
[data-palette="night"] .owl .eye-gold,
[data-palette="night"] .owl .owl-beak {
  animation: owl-glow 3.2s ease-in-out infinite;
}
@keyframes owl-glow {
  0%, 100% { filter: drop-shadow(0 0 2px rgb(212 160 32 / 0.70)) drop-shadow(0 0 6px rgb(212 160 32 / 0.30)); }
  50% { filter: drop-shadow(0 0 3.5px rgb(212 160 32 / 0.95)) drop-shadow(0 0 9px rgb(212 160 32 / 0.45)); }
}
@media (prefers-reduced-motion: reduce) {
  .owl .pupil, .owl-svg { transition: none; }
  [data-palette="night"] .owl .eye-gold,
  [data-palette="night"] .owl .owl-beak { animation: none; }
}
</style>