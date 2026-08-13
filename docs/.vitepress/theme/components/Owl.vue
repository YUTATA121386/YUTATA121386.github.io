<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"
import { withBase } from "vitepress"

const owlEl = ref<HTMLElement | null>(null)

let raf = 0
let blinkTimer: number | undefined
let tx = 0, ty = 0, cx = 0, cy = 0
const K = 1.5          // 瞳孔最大偏移（viewBox 单位）
const RANGE = 240      // 240px 内线性衰减，远处满幅
const REDUCED = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches

function isNight() {
  return document.documentElement.dataset.palette === "night"
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

async function blinkOnce() {
  const el = owlEl.value
  if (!el) return
  el.classList.add("is-blink")
  await wait(130)      // 闭眼 80ms + 保持 50ms
  el.classList.remove("is-blink")
  await wait(160)      // 睁眼缓出
}

function scheduleBlink() {
  blinkTimer = window.setTimeout(async () => {
    if (!isNight() && !REDUCED) {
      await blinkOnce()
      if (Math.random() < 0.12) { await wait(300); await blinkOnce() }
    }
    scheduleBlink()
  }, 2800 + Math.random() * 4000)
}

function onMove(e: PointerEvent) {
  const el = owlEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  const dx = e.clientX - (r.left + r.width / 2)
  const dy = e.clientY - (r.top + r.height / 2)
  const m = Math.hypot(dx, dy) || 1
  const f = Math.min(m / RANGE, 1)
  tx = (dx / m) * K * f
  ty = (dy / m) * K * f
}

function onLeave() { tx = 0; ty = 0 }

function loop() {
  cx += (tx - cx) * 0.12
  cy += (ty - cy) * 0.12
  const el = owlEl.value
  if (el && !isNight()) {
    el.style.setProperty("--px", cx.toFixed(2) + "px")
    el.style.setProperty("--py", cy.toFixed(2) + "px")
  }
  raf = requestAnimationFrame(loop)
}

onMounted(() => {
  window.addEventListener("pointermove", onMove, { passive: true })
  document.addEventListener("mouseleave", onLeave)
  if (!REDUCED) {
    scheduleBlink()
    raf = requestAnimationFrame(loop)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener("pointermove", onMove)
  document.removeEventListener("mouseleave", onLeave)
  if (blinkTimer) clearTimeout(blinkTimer)
  if (raf) cancelAnimationFrame(raf)
})
</script>

<template>
  <a ref="owlEl" class="owl" :href="withBase('/')" aria-label="拾光声学档案 · 返回首页">
    <svg class="owl-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="owl-body-g" cx="42%" cy="30%" r="78%">
          <stop offset="0%" stop-color="#FFFFFF" />
          <stop offset="45%" stop-color="#FBFAF6" />
          <stop offset="100%" stop-color="#E9EDF2" />
        </radialGradient>
        <radialGradient id="owl-iris-g" cx="38%" cy="35%" r="70%">
          <stop offset="0%" stop-color="#FFE066" />
          <stop offset="70%" stop-color="#F2A83B" />
          <stop offset="100%" stop-color="#D98A1F" />
        </radialGradient>
        <linearGradient id="owl-wing-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#F4F5F8" />
          <stop offset="100%" stop-color="#E3E7EE" />
        </linearGradient>
        <filter id="owl-soft" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="1.2" />
        </filter>
        <clipPath id="owl-body-clip">
          <path d="M32 6.2 C21.8 6.2 13.2 13.4 12.8 22.8 C12.6 26.4 13.4 28.8 15.4 30.4 C13.2 33.6 12.9 38.2 14.7 42.4 C16.3 46 19.2 49.6 22.8 51.9 C20.6 52.9 19.7 54.3 21 55.6 C22.8 57.4 25.6 57 27 55.2 C28.5 53.4 30.8 53.6 32 54.2 C33.2 53.6 35.5 53.4 37 55.2 C38.4 57 41.2 57.4 43 55.6 C44.3 54.3 43.4 52.9 41.2 51.9 C44.8 49.6 47.7 46 49.3 42.4 C51.1 38.2 50.8 33.6 48.6 30.4 C50.6 28.8 51.4 26.4 51.2 22.8 C50.8 13.4 42.2 6.2 32 6.2 Z" />
        </clipPath>
        <clipPath id="eye-l"><circle cx="25.5" cy="23.5" r="4.4" /></clipPath>
        <clipPath id="eye-r"><circle cx="38.5" cy="23.5" r="4.4" /></clipPath>
      </defs>

      <ellipse class="owl-shadow" cx="32" cy="58" rx="13" ry="1.8" fill="rgba(50,40,30,.18)" filter="url(#owl-soft)" />

      <g class="owl-body">
        <g class="owl-tilt">
          <!-- 耳羽：不对称柔簇，左前倾右后仰，根部加羽影自然衔接 -->
          <path class="owl-tuft tuft-l" d="M16.6 10.6 C14.4 8.8 13.0 5.6 15.2 2.9 C16.6 1.6 18.4 2.1 19.5 3.5 C20.4 4.7 20.1 6.3 19.0 7.6 C20.0 7.5 20.8 8.2 20.8 9.3 C20.8 10.3 19.9 11.0 18.6 11.2 C18.1 9.9 17.2 10.0 16.6 10.6 Z" fill="url(#owl-body-g)" />
          <path class="owl-tuft tuft-r" d="M47.4 10.6 C49.6 8.8 51.0 5.6 48.8 2.9 C47.4 1.6 45.6 2.1 44.5 3.5 C43.6 4.7 43.9 6.3 45.0 7.6 C44.0 7.5 43.2 8.2 43.2 9.3 C43.2 10.3 44.1 11.0 45.4 11.2 C45.9 9.9 46.8 10.0 47.4 10.6 Z" fill="url(#owl-body-g)" />
          <path class="owl-tuft-shade shade-l" d="M15.4 10.9 C17.4 9.4 19.6 9.8 20.9 11.3 C19.4 11.9 17.1 11.8 15.4 10.9 Z" fill="#DCE1E9" opacity=".55" />
          <path class="owl-tuft-shade shade-r" d="M48.6 10.9 C46.6 9.4 44.4 9.8 43.1 11.3 C44.6 11.9 46.9 11.8 48.6 10.9 Z" fill="#DCE1E9" opacity=".55" />
          <!-- 头身一体轮廓：梨形 + 颊绒 + 下摆波浪 -->
          <path class="owl-shape" d="M32 6.2 C21.8 6.2 13.2 13.4 12.8 22.8 C12.6 26.4 13.4 28.8 15.4 30.4 C13.2 33.6 12.9 38.2 14.7 42.4 C16.3 46 19.2 49.6 22.8 51.9 C20.6 52.9 19.7 54.3 21 55.6 C22.8 57.4 25.6 57 27 55.2 C28.5 53.4 30.8 53.6 32 54.2 C33.2 53.6 35.5 53.4 37 55.2 C38.4 57 41.2 57.4 43 55.6 C44.3 54.3 43.4 52.9 41.2 51.9 C44.8 49.6 47.7 46 49.3 42.4 C51.1 38.2 50.8 33.6 48.6 30.4 C50.6 28.8 51.4 26.4 51.2 22.8 C50.8 13.4 42.2 6.2 32 6.2 Z" fill="url(#owl-body-g)" />
          <ellipse class="owl-neck-shade" cx="32" cy="40" rx="15" ry="6" fill="#C7CED8" opacity=".32" filter="url(#owl-soft)" clip-path="url(#owl-body-clip)" />

          <!-- 心形面盘 -->
          <ellipse cx="32" cy="25.5" rx="11.8" ry="9.6" fill="#C7CED8" opacity=".20" filter="url(#owl-soft)" />
          <g class="owl-face">
            <circle cx="25.5" cy="23.5" r="8.5" fill="#FFFFFF" stroke="rgba(170,160,140,.22)" stroke-width=".7" />
            <circle cx="38.5" cy="23.5" r="8.5" fill="#FFFFFF" stroke="rgba(170,160,140,.22)" stroke-width=".7" />
            <path d="M28.4 30.8 Q32 36.2 35.6 30.8 Z" fill="#FFFFFF" />
          </g>

          <!-- 左眼 -->
          <g class="eye eye-l">
            <circle class="eye-iris" cx="25.5" cy="23.5" r="4.4" fill="url(#owl-iris-g)" />
            <circle class="eye-rim" cx="25.5" cy="23.5" r="4.4" fill="none" stroke="rgba(120,70,10,.28)" stroke-width=".5" />
            <g class="pupil-move">
              <g class="pupil-size">
                <circle class="pupil-core" cx="25.5" cy="23.5" r="2.1" fill="#17140F" />
                <circle class="pupil-glint" cx="24.7" cy="22.7" r="1" fill="#FFFFFF" opacity=".95" />
                <circle class="pupil-glint2" cx="26.3" cy="24.2" r=".4" fill="#FFFFFF" opacity=".5" />
              </g>
            </g>
            <g clip-path="url(#eye-l)">
              <rect class="lid" x="21" y="14" width="9" height="14" fill="#FBFAF6" />
              <rect class="blink" x="21" y="14" width="9" height="14" fill="#FBFAF6" />
            </g>
          </g>
          <path class="lash lash-l" d="M22 27.8 Q25.5 31.1 29 27.8" />

          <!-- 右眼 -->
          <g class="eye eye-r">
            <circle class="eye-iris" cx="38.5" cy="23.5" r="4.4" fill="url(#owl-iris-g)" />
            <circle class="eye-rim" cx="38.5" cy="23.5" r="4.4" fill="none" stroke="rgba(120,70,10,.28)" stroke-width=".5" />
            <g class="pupil-move">
              <g class="pupil-size">
                <circle class="pupil-core" cx="38.5" cy="23.5" r="2.1" fill="#17140F" />
                <circle class="pupil-glint" cx="37.7" cy="22.7" r="1" fill="#FFFFFF" opacity=".95" />
                <circle class="pupil-glint2" cx="39.3" cy="24.2" r=".4" fill="#FFFFFF" opacity=".5" />
              </g>
            </g>
            <g clip-path="url(#eye-r)">
              <rect class="lid" x="34" y="14" width="9" height="14" fill="#FBFAF6" />
              <rect class="blink" x="34" y="14" width="9" height="14" fill="#FBFAF6" />
            </g>
          </g>
          <path class="lash lash-r" d="M35 27.8 Q38.5 31.1 42 27.8" />

          <!-- 喙 -->
          <path class="owl-beak" d="M29.8 28.5 Q32 28.9 34.2 28.5 Q32.7 31.9 32 32.2 Q31.3 31.9 29.8 28.5 Z" fill="#3E3833" />

          <!-- 翅膀 -->
          <path class="owl-wing wing-l" d="M16.5 32.5 C12.2 36.2 10.8 41.6 12.4 46.9 C15.1 44.1 16.5 40.6 16.8 37 C17 35.2 16.9 33.8 16.5 32.5 Z" fill="url(#owl-wing-g)" />
          <path class="owl-wing wing-r" d="M47.5 32.5 C51.8 36.2 53.2 41.6 51.6 46.9 C48.9 44.1 47.5 40.6 47.2 37 C47 35.2 47.1 33.8 47.5 32.5 Z" fill="url(#owl-wing-g)" />

          <!-- 腹部斑纹 -->
          <ellipse class="owl-speck" cx="27" cy="46.5" rx="1.3" ry=".9" />
          <ellipse class="owl-speck" cx="36" cy="49" rx="1.3" ry=".9" />
          <ellipse class="owl-speck" cx="31.5" cy="52" rx="1.3" ry=".9" />
        </g>
      </g>
    </svg>
  </a>
</template>

<style scoped>
.owl {
  --lid: 0;
  --tilt: 9deg;
  --breath: 3.6s;
  --amp: 1.015;
  --eye-sq: 1;
  --lash: 0;
  --ps: 0.9;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
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
.owl:hover .owl-svg { transform: translateY(-1px) rotate(-3deg) scale(1.05); }
.owl:active .owl-svg { transform: scale(.94); }

/* 呼吸：纯 CSS，周期/振幅随时段变量 */
.owl-body {
  transform-box: fill-box;
  transform-origin: 50% 100%;
  animation: owl-breathe var(--breath, 4s) ease-in-out infinite;
}
@keyframes owl-breathe {
  0%, 100% { transform: scaleY(1); }
  50% { transform: scaleY(var(--amp, 1.018)); }
}

/* 歪头：时段倾角，过渡渐变不跳变 */
.owl-tilt {
  transform-box: fill-box;
  transform-origin: 50% 60%;
  transform: rotate(var(--tilt, 9deg));
  transition: transform .8s cubic-bezier(.3, .7, .2, 1);
}

/* 眼睑：--lid 0=全开 1=全闭 */
.lid {
  transform: translateY(calc(-14px * (1 - var(--lid, 0))));
  transition: transform .6s cubic-bezier(.3, .7, .2, 1);
}
/* 眨眼：独立遮罩，快闭慢睁，与眼睑互不干扰 */
.blink {
  transform: scaleY(0);
  transform-origin: top;
  transform-box: fill-box;
  transition: transform .16s cubic-bezier(.2, .7, .3, 1);
}
.owl.is-blink .blink {
  transform: scaleY(1);
  transition-duration: .07s;
  transition-timing-function: cubic-bezier(.6, 0, .9, .5);
}

/* 眼组挤压：午 0.85 / 暮 0.6 / 夜 0.12 */
.eye {
  transform: scaleY(var(--eye-sq, 1));
  transform-box: fill-box;
  transform-origin: center;
  transition: transform .6s cubic-bezier(.3, .7, .2, 1);
}

/* 瞳孔：JS 位移在外层，时段缩放在内层，互不覆盖 */
.pupil-move {
  transform: translate(var(--px, 0px), var(--py, 0px));
}
.pupil-size {
  transform: scale(var(--ps, 1));
  transform-box: fill-box;
  transform-origin: center;
  transition: transform .6s cubic-bezier(.3, .7, .2, 1);
}

/* 睫毛线：暮/夜浮现，夜间闭合感 */
.lash {
  fill: none;
  stroke: #3E3833;
  stroke-width: 1.1;
  stroke-linecap: round;
  opacity: var(--lash, 0);
  transition: opacity .8s ease .3s;
}

.owl-wing {
  stroke: rgba(120, 110, 100, .28);
  stroke-width: .6;
  stroke-linejoin: round;
}
.owl-speck { fill: rgba(120, 110, 95, .26); }

/* ---------- 四时段情绪 ---------- */
:root[data-palette="noon"] .owl {
  --lid: .38; --tilt: 0deg; --breath: 4.5s; --amp: 1.018; --eye-sq: .85; --lash: 0; --ps: 1;
}
:root[data-palette="dusk"] .owl {
  --lid: .62; --tilt: -6deg; --breath: 6s; --amp: 1.022; --eye-sq: .6; --lash: .4; --ps: 1.1;
}
:root[data-palette="night"] .owl {
  --lid: 1; --tilt: 13deg; --breath: 7s; --amp: 1.026; --eye-sq: .12; --lash: .8; --ps: 1;
}

@media (prefers-reduced-motion: reduce) {
  .owl-svg { transition: none; }
  .owl-body { animation: none; }
  .owl.is-blink .blink, .blink { transition: none; }
  .lid { transition: none; }
  .eye { transition: none; }
}
</style>
