<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { withBase } from "vitepress"

interface VolModule {
  num: string
  en: string
  title: string
  color: string
  desc: string
  badge?: string
  live?: boolean
  items: string[]
  stat: string
  link: string
}

const MODULES: VolModule[] = [
  { num: "I", en: "GROWTH", title: "上升清单", color: "#c9993d", desc: "自我剖析 · 关键决策 · 年度 OKR", items: ["卷首 · 概述", "22岁 · 2026年度OKR"], stat: "长期主义 · 五年为尺", link: "growth/" },
  { num: "II", en: "RADAR", title: "行业雷达", color: "#3d7ea6", desc: "每日自动采集 · AI 深度分析 · 曲库行业动态", badge: "LIVE", live: true, items: ["日报概览", "过程日志", "周报", "规则体系", "关键词覆盖"], stat: "每日 12:00 自动更新", link: "daily/" },
  { num: "III", en: "MUSIC PRODUCT", title: "云音乐产品学习", color: "#c03434", desc: "产品分析 · 活动运营 · 用户反馈", items: ["年度报告", "歌词翻译编辑部", "AI 歌曲资料补充", "歌词 AB 实验", "云村用户节"], stat: "8 篇深度拆解", link: "music-product/" },
  { num: "IV", en: "LIBERAL ARTS", title: "通识积累", color: "#5f7a5a", desc: "影视评鉴 · 法餐考据 · 唱片评鉴", items: ["日本影视剧 · 评级", "东京大饭店 · 烹饪技法", "音乐鉴赏 · 唱片评价", "曲库运营 · 多方视角"], stat: "5 个长期专题", link: "general/" },
  { num: "V", en: "PILGRIMAGE", title: "圣地巡礼", color: "#c76b3f", desc: "旅行记录 · 取景地打卡 · 文化考察", badge: "施工中", items: ["卷首 · 概述", "东京篇 · 筹备中"], stat: "下一站 · 东京", link: "pilgrimage/" },
  { num: "VI", en: "INTERVIEW", title: "校招面试话术", color: "#46537e", desc: "简历策略 · 高频问答 · 企业面经", items: ["通用高频问题", "网易云音乐 · 面经", "昆仑天工 · 面经", "荔枝 · 面经", "+ 3 家记录"], stat: "6 家企业实战", link: "interview/" },
]

const current = ref(0)
const dropped = ref(false)
const switching = ref(false)
const deckEl = ref<HTMLElement | null>(null)
const areaEl = ref<HTMLElement | null>(null)

let switchTimer: number | undefined
let liftTimer: number | undefined
let dropTimer: number | undefined
let tiltRaf = 0
let tiltTx = 0
let tiltTy = 0
let tiltCx = 0
let tiltCy = 0
let observer: IntersectionObserver | undefined

const mod = computed(() => MODULES[current.value])

function raiseArm() { dropped.value = false }
function dropArm() { dropped.value = true }

function selectModule(i: number) {
  if (i === current.value) return
  current.value = i
  switching.value = true
  if (switchTimer) clearTimeout(switchTimer)
  switchTimer = window.setTimeout(() => { switching.value = false }, 300)
  raiseArm()
  if (liftTimer) clearTimeout(liftTimer)
  liftTimer = window.setTimeout(() => { dropArm() }, 700)
}

/* 鼠标跟随：像观察实物一样轻微转动视角，阻尼柔和 */
function applyTilt() {
  tiltRaf = 0
  tiltCx += (tiltTx - tiltCx) * 0.08
  tiltCy += (tiltTy - tiltCy) * 0.08
  const deck = deckEl.value
  if (deck) {
    deck.style.setProperty("--tilt-x", tiltCy.toFixed(3) + "deg")
    deck.style.setProperty("--tilt-y", tiltCx.toFixed(3) + "deg")
  }
  if (Math.abs(tiltTx - tiltCx) > 0.003 || Math.abs(tiltTy - tiltCy) > 0.003) {
    tiltRaf = requestAnimationFrame(applyTilt)
  }
}
function onAreaMove(e: MouseEvent) {
  const r = areaEl.value?.getBoundingClientRect()
  if (!r || r.width === 0) return
  tiltTx = (((e.clientX - r.left) / r.width) * 2 - 1) * 4
  tiltTy = (((e.clientY - r.top) / r.height) * 2 - 1) * 3
  if (!tiltRaf) tiltRaf = requestAnimationFrame(applyTilt)
}
function onAreaLeave() {
  tiltTx = 0
  tiltTy = 0
  if (!tiltRaf) tiltRaf = requestAnimationFrame(applyTilt)
}

onMounted(() => {
  // 初次落针：延迟执行，让"唱针放上去"的动作可见
  const tryInView = () => {
    const r = deckEl.value?.getBoundingClientRect()
    if (r && r.top < window.innerHeight * 0.9 && r.bottom > 0) {
      dropTimer = window.setTimeout(dropArm, 900)
      return true
    }
    return false
  }
  if (tryInView()) return
  if (deckEl.value && "IntersectionObserver" in window) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        observer?.disconnect()
        dropTimer = window.setTimeout(dropArm, 900)
      }
    }, { threshold: 0.15 })
    observer.observe(deckEl.value)
  } else {
    dropTimer = window.setTimeout(dropArm, 900)
  }
})

onBeforeUnmount(() => {
  if (switchTimer) clearTimeout(switchTimer)
  if (liftTimer) clearTimeout(liftTimer)
  if (dropTimer) clearTimeout(dropTimer)
  if (tiltRaf) cancelAnimationFrame(tiltRaf)
  observer?.disconnect()
})
</script>

<template>
  <section class="player-section">
    <div class="section-head"><span class="sh-cn">六卷档案</span><span class="sh-en">SIX VOLUMES — 选择一卷，落下唱针</span></div>
    <div class="player-layout">
      <div class="module-selector">
        <button
          v-for="(m, i) in MODULES"
          :key="m.num"
          type="button"
          :class="['mod-btn', { 'is-active': current === i }]"
          @click="selectModule(i)"
        >
          <span class="mod-num">{{ m.num }}</span>
          <span class="mod-title">{{ m.title }}</span>
          <span v-if="m.badge" :class="['mod-badge', { live: m.live }]">{{ m.badge }}</span>
        </button>
      </div>
      <div ref="areaEl" class="turntable-area" @mousemove="onAreaMove" @mouseleave="onAreaLeave">
        <div
          ref="deckEl"
          class="deck"
          :class="{ 'is-dropped': dropped }"
          :data-vol="current"
          role="img"
          aria-label="六卷档案黑胶唱片机"
        >
          <svg class="deck-svg" viewBox="0 0 440 356" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="g-plinth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="st-plinth-hi" />
                <stop offset="0.52" class="st-plinth" />
                <stop offset="1" class="st-plinth-lo" />
              </linearGradient>
              <linearGradient id="g-plinth-side" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" class="st-side-hi" />
                <stop offset="1" class="st-side-lo" />
              </linearGradient>
              <radialGradient id="g-platter" cx="0.5" cy="0.36" r="0.95">
                <stop offset="0" class="st-platter-hi" />
                <stop offset="0.58" class="st-platter" />
                <stop offset="1" class="st-platter-lo" />
              </radialGradient>
              <radialGradient id="g-vinyl" cx="0.5" cy="0.42" r="0.9">
                <stop offset="0" class="st-vinyl-hi" />
                <stop offset="0.55" class="st-vinyl" />
                <stop offset="1" class="st-vinyl-lo" />
              </radialGradient>
              <linearGradient id="g-arm" gradientUnits="userSpaceOnUse" x1="368" y1="140" x2="252" y2="221">
                <stop offset="0" class="st-m1" />
                <stop offset="0.32" class="st-m2" />
                <stop offset="0.48" class="st-m3" />
                <stop offset="0.62" class="st-m4" />
                <stop offset="1" class="st-m5" />
              </linearGradient>
              <radialGradient id="g-knob" cx="0.38" cy="0.3" r="0.95">
                <stop offset="0" class="st-knob-hi" />
                <stop offset="1" class="st-knob-lo" />
              </radialGradient>
              <linearGradient id="g-sweep" x1="0" y1="0" x2="1" y2="0.35">
                <stop offset="0" class="st-sweep" stop-opacity="0" />
                <stop offset="0.72" class="st-sweep" />
                <stop offset="1" class="st-sweep" stop-opacity="0" />
              </linearGradient>
              <clipPath id="clip-plinth"><rect x="30" y="64" width="380" height="228" rx="24" /></clipPath>
              <clipPath id="clip-vinyl"><ellipse cx="220" cy="192" rx="137" ry="94" /></clipPath>
              <clipPath id="clip-label"><ellipse cx="220" cy="192" rx="42" ry="29" /></clipPath>
            </defs>

            <!-- 地面投影 -->
            <ellipse class="floor-shadow" cx="220" cy="327" rx="188" ry="26" />

            <!-- 脚垫：锥形支撑，压出沉稳落地感 -->
            <path class="foot" d="M72 330 L102 330 L97.5 340 Q96.5 343 89.5 343 L84.5 343 Q77.5 343 76.5 340 Z" />
            <ellipse class="foot-base" cx="87" cy="342.5" rx="16.5" ry="4.5" />
            <path class="foot" d="M338 330 L368 330 L363.5 340 Q362.5 343 355.5 343 L350.5 343 Q343.5 343 342.5 340 Z" />
            <ellipse class="foot-base" cx="353" cy="342.5" rx="16.5" ry="4.5" />

            <!-- 底座：侧壁挤出 + 圆润顶面 -->
            <path class="plinth-side" d="M30 292 L30 300 C30 316.5 45 330 62 330 L378 330 C395 330 410 316.5 410 300 L410 292 Z" />
            <path class="plinth-side-shade" d="M30 292 L30 300 C30 316.5 45 330 62 330 L378 330 C395 330 410 316.5 410 300 L410 292 Z" />
            <path class="plinth-side-hi" d="M32 327.5 C60 329.5 380 329.5 408 327.5 L410 330 C395 330 45 330 30 330 Z" />
            <ellipse class="foot-seam" cx="87" cy="330.4" rx="15.5" ry="1.3" />
            <ellipse class="foot-seam" cx="353" cy="330.4" rx="15.5" ry="1.3" />
            <ellipse class="foot-hi" cx="80.6" cy="341.2" rx="2.6" ry="4" />
            <rect class="plinth-top" x="30" y="64" width="380" height="228" rx="24" fill="url(#g-plinth)" />
            <rect class="plinth-brush" x="30" y="64" width="380" height="228" rx="24" />
            <path class="plinth-hi" d="M54 64 H386 A24 24 0 0 1 410 88 V97 H30 V88 A24 24 0 0 1 54 64 Z" />
            <path class="plinth-lo" d="M54 268 H386 A24 24 0 0 1 410 292 H30 A24 24 0 0 1 54 268 Z" />

            <!-- 转盘 -->
            <ellipse class="platter" cx="220" cy="192" rx="144" ry="99" fill="url(#g-platter)" />
            <ellipse class="platter-ring" cx="220" cy="192" rx="144" ry="99" />
            <ellipse class="platter-mat" cx="220" cy="192" rx="130" ry="89" />
            <ellipse class="platter-hi" cx="220" cy="192" rx="139" ry="95.5" />
            <ellipse class="platter-bezel" cx="220" cy="192" rx="141.5" ry="97" />

            <!-- 黑胶：固定层（纹路与外缘） -->
            <g class="vinyl-base">
              <ellipse class="vinyl-thickness" cx="220" cy="195.5" rx="138.5" ry="95.2" />
              <ellipse class="vinyl-rim-hi" cx="220" cy="191.4" rx="138.6" ry="95.3" />
              <ellipse class="vinyl-rim" cx="220" cy="192" rx="139" ry="95.5" />
              <ellipse class="vinyl-body" cx="220" cy="192" rx="137" ry="94" fill="url(#g-vinyl)" />
              <g class="vinyl-grooves">
                <ellipse cx="220" cy="192" rx="47" ry="32.2" />
                <ellipse cx="220" cy="192" rx="58" ry="39.8" />
                <ellipse cx="220" cy="192" rx="69" ry="47.3" />
                <ellipse cx="220" cy="192" rx="80" ry="54.9" />
                <ellipse cx="220" cy="192" rx="91" ry="62.4" />
                <ellipse cx="220" cy="192" rx="102" ry="70" />
                <ellipse cx="220" cy="192" rx="113" ry="77.5" />
                <ellipse cx="220" cy="192" rx="124" ry="85.1" />
                <ellipse cx="220" cy="192" rx="132" ry="90.5" />
                <ellipse cx="220" cy="192" rx="135.5" ry="93" />
              </g>
            </g>

            <!-- 黑胶：自转层（标签 + 偏心光斑） -->
            <g class="vinyl-spin">
              <g class="label-base">
                <ellipse cx="220" cy="192" rx="42" ry="29" />
                <ellipse class="label-ring" cx="220" cy="192" rx="40" ry="27.6" />
              </g>
              <g class="label-art" clip-path="url(#clip-label)">
                <g
                  v-for="m in MODULES"
                  :key="m.num"
                  class="vol-glyph"
                  :class="'glyph-' + m.num.toLowerCase()"
                  transform="translate(220 192) scale(1.05)"
                >
                  <g v-if="m.num === 'I'" class="glyph">
                    <path d="M24 29 V19" />
                    <path d="M24 15.2 L19.8 22.2 L28.2 22.2 Z" />
                  </g>
                  <g v-else-if="m.num === 'II'" class="glyph">
                    <circle cx="24" cy="24" r="11" />
                    <circle cx="24" cy="24" r="5.5" />
                    <path d="M24 24 L33.5 18" />
                    <circle class="glyph-dot" cx="33.5" cy="18" r="1.7" />
                    <circle class="glyph-dot" cx="24" cy="24" r="2.2" />
                  </g>
                  <g v-else-if="m.num === 'III'" class="glyph">
                    <ellipse cx="18" cy="33" rx="3.4" ry="2.6" />
                    <path d="M21.2 31.6 L21.2 16" />
                    <path d="M21.2 16 C25 17 26.5 20 26 23.5" />
                  </g>
                  <g v-else-if="m.num === 'IV'" class="glyph">
                    <rect x="13" y="15.5" width="22" height="21" rx="2.5" />
                    <path d="M19.5 19.5 V32.5" />
                    <path d="M28.5 19.5 V32.5" />
                    <rect class="glyph-dot" x="22.2" y="12" width="3.6" height="8" rx="1.2" />
                  </g>
                  <g v-else-if="m.num === 'V'" class="glyph">
                    <circle cx="30" cy="15.5" r="4.5" />
                    <path d="M12.5 36 L19.5 25.5 L23.5 30.5 L27.5 23 L35.5 36 Z" />
                  </g>
                  <g v-else class="glyph">
                    <path d="M16 14.5 L32 14.5 A3.5 3.5 0 0 1 35.5 18 L35.5 28 A3.5 3.5 0 0 1 32 31.5 L26 31.5 L22.5 35 L23 31.5 L16 31.5 A3.5 3.5 0 0 1 12.5 28 L12.5 18 A3.5 3.5 0 0 1 16 14.5 Z" />
                    <circle class="glyph-dot" cx="18" cy="23" r="1.3" />
                    <circle class="glyph-dot" cx="24" cy="23" r="1.3" />
                    <circle class="glyph-dot" cx="30" cy="23" r="1.3" />
                  </g>
                </g>
                <circle class="label-dot" cx="194" cy="171" r="1.3" />
                <circle class="label-dot" cx="247" cy="199" r="1.3" />
                <circle class="label-dot" cx="243" cy="213" r="1.3" />
              </g>
              <path class="spin-glint" d="M 128 132 A 96 66 0 0 1 192 104" />
            </g>

            <!-- 黑胶表面高光（固定，不随自转） -->
            <g class="vinyl-sheen" clip-path="url(#clip-vinyl)">
              <path d="M 96 236 C 150 278 288 282 356 236" />
              <path d="M 84 158 C 124 92 214 66 282 84" />
            </g>
            <ellipse class="vinyl-hole" cx="220" cy="192" rx="4.6" ry="3.2" />
            <ellipse class="vinyl-hole-rim" cx="220" cy="192" rx="5.6" ry="3.9" />

            <!-- 唱臂：绕轴心落针 -->
            <g class="tonearm">
              <ellipse class="stylus-cast" cx="252" cy="222" rx="11" ry="5" />
              <ellipse class="arm-cw-cast" cx="400.5" cy="123.5" rx="9" ry="3.4" />
              <ellipse class="stylus-contact" cx="252.4" cy="222.6" rx="4" ry="1.8" />
              <g class="tonearm-group">
                <path class="arm-cw" d="M 372 144 L 398 122" />
                <path class="arm-cw-hi" d="M 373.5 142.5 L 395.5 124" />
                <ellipse class="arm-cw-weight-shade" cx="402.7" cy="121.9" rx="10.5" ry="6.4" transform="rotate(-40 401.5 120)" />
                <ellipse class="arm-cw-weight" cx="401.5" cy="120" rx="10.5" ry="6.4" transform="rotate(-40 401.5 120)" />
                <ellipse class="arm-cw-weight-hi" cx="400.5" cy="118.2" rx="6.4" ry="2.2" transform="rotate(-40 400.5 118.2)" />
                <path class="arm-wand" d="M 370 142 C 344 130, 313 136, 293 158 C 280 172, 271 192, 266 208" />
                <path class="arm-wand-hi" d="M 368 139.5 C 343 128.5, 312 134.5, 293 156.5 C 281 170, 272 190, 267.5 205.5" />
                <path class="arm-shell" d="M 269.5 210.6 L 254 226.2 Q 250.4 229.2 247.2 225.8 L 260.4 201.8 Q 264.6 199.4 269.5 210.6 Z" />
                <path class="arm-shell-hi" d="M 247.2 225.8 L 260.4 201.8 Q 264.6 199.4 269.5 210.6" />
                <path class="arm-shell-lo" d="M 269.5 210.6 L 254 226.2 Q 250.4 229.2 247.2 225.8" />
                <rect class="arm-cart" x="249.4" y="216.2" width="8" height="7" rx="1.8" transform="rotate(-38 253.4 219.7)" />
                <rect class="arm-cart-hi" x="250.6" y="217.2" width="5.6" height="2.2" rx="1.1" transform="rotate(-38 253.4 219.7)" />
                <path class="arm-stylus" d="M 254.6 222.8 L 252.6 220.9" />
                <path class="stylus-tip" d="M 252.3 219.6 L 253.5 220.8 L 252.3 222 L 251.1 220.8 Z" />
                <circle class="stylus-glint" cx="251.8" cy="220.3" r="0.9" />
              </g>
              <ellipse class="pivot-shade" cx="368" cy="142" rx="12.5" ry="9" />
              <circle class="pivot" cx="368" cy="140" r="12.5" />
              <circle class="pivot-ring" cx="368" cy="140" r="9" />
              <circle class="pivot-dot" cx="368" cy="140" r="3.2" />
              <rect class="arm-lift-shade" x="374.3" y="144.6" width="8.4" height="17.8" rx="4.2" transform="rotate(14 378.5 153.5)" />
              <rect class="arm-lift" x="375.5" y="146" width="6" height="15" rx="3" transform="rotate(14 378.5 153.5)" />
              <rect class="arm-lift-hi" x="376.7" y="147.4" width="1.7" height="10.5" rx="0.85" transform="rotate(14 378.5 153.5)" />
            </g>

            <!-- 面板点缀 -->
            <ellipse class="knob" cx="58" cy="268" rx="10" ry="7" />
            <ellipse class="knob-hi" cx="58" cy="268" rx="10" ry="7" />
            <ellipse class="knob" cx="96" cy="268" rx="10" ry="7" />
            <ellipse class="knob-hi" cx="96" cy="268" rx="10" ry="7" />
            <circle class="led led-1" cx="376" cy="86" r="3.2" />
            <circle class="led led-2" cx="390" cy="86" r="3.2" />
            <circle class="led-core" cx="375.6" cy="85.6" r="1.4" />
            <circle class="led-core" cx="389.6" cy="85.6" r="1.4" />

            <!-- 环境光扫过（时间感） -->
            <g clip-path="url(#clip-plinth)">
              <ellipse class="deck-sweep" cx="220" cy="178" rx="240" ry="150" fill="url(#g-sweep)" />
            </g>
          </svg>
        </div>
        <div class="player-info glass" :class="{ 'is-switching': switching }">
          <div class="p-head">
            <span class="p-num">{{ mod.num }}</span>
            <span class="p-en">{{ mod.en }}</span>
            <span v-if="mod.badge" :class="['p-badge', { live: mod.live }]">{{ mod.badge }}</span>
          </div>
          <h3 class="p-title">{{ mod.title }}</h3>
          <p class="p-desc">{{ mod.desc }}</p>
          <ul class="p-items"><li v-for="it in mod.items" :key="it">{{ it }}</li></ul>
          <div class="p-foot">
            <span class="p-stat">{{ mod.stat }}</span>
            <a class="p-cta" :href="withBase(mod.link)">进入卷宗 →</a>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
