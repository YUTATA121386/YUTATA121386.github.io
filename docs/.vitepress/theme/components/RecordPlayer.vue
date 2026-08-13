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
// 唱臂相位：idle=抬起 / dropping=落针动画中 / playing=播放中 / lifting=抬针动画中
const phase = ref<"idle" | "dropping" | "playing" | "lifting">("idle")
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

function raiseArm() { phase.value = "lifting" }
function dropArm() { phase.value = "dropping" }

/* 唱臂动画结束：dropping → playing（启动黑胶），lifting → idle（回到抬起位） */
function onArmAnimEnd() {
  if (phase.value === "dropping") {
    phase.value = "playing"
    startSpool()
  } else if (phase.value === "lifting") {
    phase.value = "idle"
  }
}

/* 黑胶启动：外层 spool 一次性加速（WAAPI），内层 vinyl-rot 恒定 linear，互不冲突 */
function startSpool() {
  const deck = deckEl.value
  const spool = deck?.querySelector(".vinyl-spool") as SVGGElement | null
  if (!deck || !spool) return
  const addSpin = () => deck.classList.add("is-spinning")
  const state = spool as unknown as { _spooled?: boolean }
  if (!state._spooled) {
    state._spooled = true
    const anim = spool.animate(
      [{ transform: "rotate(0deg)" }, { transform: "rotate(118deg)" }],
      { duration: 1200, easing: "cubic-bezier(.5,0,.6,.74)", fill: "forwards" }
    )
    anim.onfinish = addSpin
  } else {
    addSpin()
  }
}

function selectModule(i: number) {
  if (i === current.value) return
  current.value = i
  switching.value = true
  if (switchTimer) clearTimeout(switchTimer)
  switchTimer = window.setTimeout(() => { switching.value = false }, 300)
  deckEl.value?.classList.remove("is-spinning")
  raiseArm()
  if (liftTimer) clearTimeout(liftTimer)
  liftTimer = window.setTimeout(() => { dropArm() }, 1050)
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
    /* 视差映射：阻尼后的角度归一化，供各图层独立位移 */
    const nx = Math.max(-1, Math.min(1, tiltCx / 4))
    const ny = Math.max(-1, Math.min(1, tiltCy / 3))
    deck.style.setProperty("--px", nx.toFixed(3))
    deck.style.setProperty("--py", ny.toFixed(3))
    deck.style.setProperty("--abs-px", Math.abs(nx).toFixed(3))
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
          :class="{ 'is-dropping': phase === 'dropping', 'is-playing': phase === 'playing', 'is-lifting': phase === 'lifting' }"
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
              <linearGradient id="fasciaGrad" gradientUnits="userSpaceOnUse" x1="220" y1="292" x2="220" y2="310">
                <stop offset="0" class="st-fascia-hi" />
                <stop offset=".18" class="st-fascia" />
                <stop offset=".82" class="st-fascia-lo" />
                <stop offset="1" class="st-fascia-base" />
              </linearGradient>
              <linearGradient id="fasciaSide" gradientUnits="userSpaceOnUse" x1="30" y1="0" x2="390" y2="0">
                <stop offset="0" stop-color="#fff" stop-opacity=".10" />
                <stop offset=".25" stop-color="#fff" stop-opacity="0" />
                <stop offset=".75" stop-color="#000" stop-opacity="0" />
                <stop offset="1" stop-color="#000" stop-opacity=".14" />
              </linearGradient>
              <radialGradient id="cornerShade">
                <stop offset="0" stop-color="#000" stop-opacity=".20" />
                <stop offset="1" stop-color="#000" stop-opacity="0" />
              </radialGradient>
              <radialGradient id="g-platter" cx="0.5" cy="0.36" r="0.95">
                <stop offset="0" class="st-platter-hi" />
                <stop offset="0.58" class="st-platter" />
                <stop offset="1" class="st-platter-lo" />
              </radialGradient>
              <linearGradient id="platterSideGrad" gradientUnits="userSpaceOnUse" x1="220" y1="192" x2="220" y2="198">
                <stop offset="0" class="st-platter-side-hi" />
                <stop offset="1" class="st-platter-side-lo" />
              </linearGradient>
              <radialGradient id="platterFace" gradientUnits="userSpaceOnUse" cx="196" cy="172" r="165">
                <stop offset="0" class="st-platter-hi" />
                <stop offset=".45" class="st-platter" />
                <stop offset=".8" class="st-platter-lo" />
                <stop offset="1" class="st-platter-edge" />
              </radialGradient>
              <radialGradient id="g-vinyl" cx="0.5" cy="0.42" r="0.9">
                <stop offset="0" class="st-vinyl-hi" />
                <stop offset="0.55" class="st-vinyl" />
                <stop offset="1" class="st-vinyl-lo" />
              </radialGradient>
              <linearGradient id="vinylEdgeGrad" gradientUnits="userSpaceOnUse" x1="220" y1="192" x2="220" y2="194.5">
                <stop offset="0" class="st-vinyl-edge-hi" />
                <stop offset=".5" class="st-vinyl" />
                <stop offset="1" class="st-vinyl-edge-lo" />
              </linearGradient>
              <radialGradient id="vinylFace" gradientUnits="userSpaceOnUse" cx="208" cy="178" r="152">
                <stop offset="0" class="st-vinyl-hi" />
                <stop offset=".55" class="st-vinyl" />
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
              <linearGradient id="metalSide" gradientUnits="userSpaceOnUse" x1="357" y1="0" x2="379" y2="0">
                <stop offset="0" class="st-metal-lo" />
                <stop offset=".35" class="st-metal-hi" />
                <stop offset=".65" class="st-metal" />
                <stop offset="1" class="st-metal-lo" />
              </linearGradient>
              <radialGradient id="metalTop" gradientUnits="userSpaceOnUse" cx="365" cy="117" r="13">
                <stop offset="0" class="st-metal-hi" />
                <stop offset="1" class="st-metal" />
              </radialGradient>
              <linearGradient id="g-sweep" x1="0" y1="0" x2="1" y2="0.35">
                <stop offset="0" class="st-sweep" stop-opacity="0" />
                <stop offset="0.72" class="st-sweep" />
                <stop offset="1" class="st-sweep" stop-opacity="0" />
              </linearGradient>
              <linearGradient id="wedgeGrad" gradientUnits="userSpaceOnUse" x1="220" y1="192" x2="330" y2="130">
                <stop offset="0" class="st-sheen" stop-opacity=".12" />
                <stop offset="1" class="st-sheen" stop-opacity="0" />
              </linearGradient>
              <filter id="blur1" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1" /></filter>
              <filter id="blur2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2" /></filter>
              <filter id="blur3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" /></filter>
              <filter id="blur4" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="4" /></filter>
              <clipPath id="clip-plinth"><rect x="30" y="64" width="380" height="228" rx="24" /></clipPath>
              <clipPath id="fasciaClip"><path d="M30,178 V268 Q30,292 54,292 H366 Q390,292 390,268 V178 L390,194 V284 Q390,308 366,308 H54 Q30,308 30,284 L30,194 Z" /></clipPath>
              <clipPath id="clip-vinyl"><ellipse cx="220" cy="192" rx="137" ry="94" /></clipPath>
              <clipPath id="clip-label"><ellipse cx="220" cy="192" rx="42" ry="29" /></clipPath>
              <path id="wandPath" d="M 370 142 C 344 130, 313 136, 293 158 C 280 172, 271 192, 266 208" />
            </defs>

            <!-- 地面投影（视差反向移动，制造镜头感） -->
            <ellipse class="floor-shadow" cx="220" cy="327" rx="188" ry="26" />

            <!-- 脚垫：圆柱支撑，压出沉稳落地感 -->
            <g class="foot">
              <ellipse class="foot-cast" cx="86" cy="319" rx="17" ry="3" filter="url(#blur1)" />
              <path class="foot-side" d="M71,308 V311.5 Q71,317.6 86,317.6 Q101,317.6 101,311.5 V308 Z" />
              <ellipse class="foot-top" cx="86" cy="308" rx="15" ry="4.6" />
              <path class="foot-gap" d="M72.5,306 A15,4.6 0 0,1 99.5,306" />
            </g>
            <g class="foot">
              <ellipse class="foot-cast" cx="354" cy="319" rx="17" ry="3" filter="url(#blur1)" />
              <path class="foot-side" d="M339,308 V311.5 Q339,317.6 354,317.6 Q369,317.6 369,311.5 V308 Z" />
              <ellipse class="foot-top" cx="354" cy="308" rx="15" ry="4.6" />
              <path class="foot-gap" d="M340.5,306 A15,4.6 0 0,1 367.5,306" />
            </g>

            <!-- 底座：fascia 侧壁挤出 + 圆润顶面 -->
            <path class="plinth-fascia" d="M30,178 V268 Q30,292 54,292 H366 Q390,292 390,268 V178 L390,194 V284 Q390,308 366,308 H54 Q30,308 30,284 L30,194 Z" fill="url(#fasciaGrad)" />
            <path class="plinth-fascia-side" d="M30,178 V268 Q30,292 54,292 H366 Q390,292 390,268 V178 L390,194 V284 Q390,308 366,308 H54 Q30,308 30,284 L30,194 Z" fill="url(#fasciaSide)" />
            <g clip-path="url(#fasciaClip)">
              <ellipse class="corner-shade" cx="48" cy="302" rx="26" ry="15" fill="url(#cornerShade)" />
              <ellipse class="corner-shade" cx="372" cy="302" rx="26" ry="15" fill="url(#cornerShade)" />
            </g>
            <path class="plinth-edge" d="M32,269 Q32,290 55,290 H365 Q388,290 388,269" />
            <path class="plinth-base-hi" d="M31,305.5 Q31,307 54,307 H366 Q389,307 389,305.5" />
            <path class="plinth-ao" d="M33,285 Q33,306 56,306 H364 Q387,306 387,285" />
            <ellipse class="foot-seam" cx="87" cy="330.4" rx="15.5" ry="1.3" />
            <ellipse class="foot-seam" cx="353" cy="330.4" rx="15.5" ry="1.3" />
            <rect class="plinth-top" x="30" y="64" width="380" height="228" rx="24" fill="url(#g-plinth)" />
            <rect class="plinth-brush" x="30" y="64" width="380" height="228" rx="24" />
            <path class="plinth-hi" d="M54 64 H386 A24 24 0 0 1 410 88 V97 H30 V88 A24 24 0 0 1 54 64 Z" />
            <path class="plinth-lo" d="M54 268 H386 A24 24 0 0 1 410 292 H30 A24 24 0 0 1 54 268 Z" />

            <!-- 转盘：哑光铝 + 同心车削纹 -->
            <path class="platter-side" d="M76,192 A144,99 0 0,0 364,192 L364,198 A144,99 0 0,1 76,198 Z" fill="url(#platterSideGrad)" />
            <ellipse class="platter-face" cx="220" cy="192" rx="144" ry="99" fill="url(#platterFace)" />
            <g class="platter-turns">
              <ellipse v-for="i in 24" :key="'t' + i" cx="220" cy="192" :rx="30 + 4.5 * (i - 1)" :ry="(30 + 4.5 * (i - 1)) * 0.687" />
            </g>
            <path class="platter-bezel-hi" d="M76,192 A144,99 0 0,1 364,192" />
            <path class="platter-bezel-lo" d="M76,192 A144,99 0 0,0 364,192" />
            <ellipse class="platter-inset" cx="220" cy="192" rx="140.5" ry="96.6" />
            <path class="platter-ao" d="M79,198.5 A143,98 0 0,0 361,198.5" />

            <!-- 黑胶：厚度挤出 + 哑光盘面 -->
            <g class="vinyl-base">
              <path class="vinyl-edge" d="M83,192 A137,94 0 0,0 357,192 L357,195 A137,94 0 0,1 83,195 Z" fill="url(#vinylEdgeGrad)" />
              <path class="vinyl-edge-hi" d="M83.8,194 A136.4,93.6 0 0,0 356.2,194" />
              <path class="vinyl-bevel-hi" d="M84,192 A136,93.4 0 0,1 356,192" />
              <path class="vinyl-bevel-lo" d="M84,192 A136,93.4 0 0,0 356,192" />
              <ellipse class="vinyl-body" cx="220" cy="192" rx="137" ry="94" fill="url(#vinylFace)" />
              <path class="vinyl-ao" d="M84,194.2 A136,93.4 0 0,0 356,194.2" />
            </g>

            <!-- 黑胶：自转层（沟槽 + 标签，spool 外层负责启动加速） -->
            <g class="layer-disc">
              <g class="vinyl-spool">
                <g class="vinyl-rot">
                  <g class="vinyl-grooves">
                    <ellipse v-for="i in 30" :key="'g' + i" cx="220" cy="192" :rx="49 + 2.75 * (i - 1)" :ry="(49 + 2.75 * (i - 1)) * 0.687" />
                  </g>
                  <ellipse class="vinyl-deadwax" cx="220" cy="192" rx="46" ry="31.6" />
                  <g class="vinyl-lead">
                    <ellipse v-for="i in 3" :key="'l' + i" cx="220" cy="192" :rx="44.6 + 1.3 * (i - 1)" :ry="(44.6 + 1.3 * (i - 1)) * 0.687" />
                  </g>
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
              </g>
            </g>

            <!-- 固定光斑：楔形高光 + 纵向反射，不随自转 -->
            <g class="layer-sheen" clip-path="url(#clip-vinyl)">
              <path class="sheen-wedge" d="M220,192 L306.5,123.5 A137,94 0 0,1 344.8,149.5 Z" fill="url(#wedgeGrad)" />
              <path class="sheen-arc" d="M99,159 A130,89.3 0 0,1 341,159" />
            </g>
            <ellipse class="vinyl-hole" cx="220" cy="192" rx="4.6" ry="3.2" />
            <ellipse class="vinyl-hole-rim" cx="220" cy="192" rx="5.6" ry="3.9" />

            <!-- 唱臂：管身四线 + 圆柱配重 + 悬空投影（视差最敏感层） -->
            <g class="layer-arm">
              <g class="arm-shadow" clip-path="url(#clip-plinth)">
                <use href="#wandPath" class="shadow-far" />
                <use href="#wandPath" class="shadow-near" />
              </g>
              <g class="tonearm">
                <ellipse class="stylus-cast" cx="252" cy="222" rx="11" ry="5" />
                <ellipse class="arm-cw-cast" cx="400.5" cy="123.5" rx="9" ry="3.4" />
                <ellipse class="stylus-contact" cx="252.4" cy="222.6" rx="4" ry="1.8" />
                <g class="tonearm-group" @animationend="onArmAnimEnd">
                  <g class="wand">
                    <use href="#wandPath" class="wand-lo" />
                    <use href="#wandPath" class="wand-mid" />
                    <use href="#wandPath" class="wand-hi" />
                    <use href="#wandPath" class="wand-bounce" />
                  </g>
                  <path class="arm-shell" d="M 269.5 210.6 L 254 226.2 Q 250.4 229.2 247.2 225.8 L 260.4 201.8 Q 264.6 199.4 269.5 210.6 Z" />
                  <path class="arm-shell-hi" d="M 247.2 225.8 L 260.4 201.8 Q 264.6 199.4 269.5 210.6" />
                  <path class="arm-shell-lo" d="M 269.5 210.6 L 254 226.2 Q 250.4 229.2 247.2 225.8" />
                  <rect class="arm-cart" x="249.4" y="216.2" width="8" height="7" rx="1.8" transform="rotate(-38 253.4 219.7)" />
                  <rect class="arm-cart-hi" x="250.6" y="217.2" width="5.6" height="2.2" rx="1.1" transform="rotate(-38 253.4 219.7)" />
                  <path class="arm-stylus" d="M 254.6 222.8 L 253 222.4" />
                  <path class="stylus-tip" d="M 252.7 220.6 L 253.7 222 L 252.7 222.8 L 251.7 222 Z" />
                  <circle class="stylus-glint" cx="251.8" cy="220.3" r="0.9" />
                  <ellipse class="arm-cw-weight-shade" cx="402.7" cy="121.9" rx="10.5" ry="6.4" transform="rotate(-40 401.5 120)" />
                  <ellipse class="arm-cw-weight" cx="401.5" cy="120" rx="10.5" ry="6.4" transform="rotate(-40 401.5 120)" />
                  <ellipse class="arm-cw-weight-hi" cx="400.5" cy="118.2" rx="6.4" ry="2.2" transform="rotate(-40 400.5 118.2)" />
                  <path class="arm-cw" d="M 372 144 L 398 122" />
                  <path class="arm-cw-hi" d="M 373.5 142.5 L 395.5 124" />
                  <rect class="arm-lift-shade" x="374.3" y="144.6" width="8.4" height="17.8" rx="4.2" transform="rotate(14 378.5 153.5)" />
                  <rect class="arm-lift" x="375.5" y="146" width="6" height="15" rx="3" transform="rotate(14 378.5 153.5)" />
                  <rect class="arm-lift-hi" x="376.7" y="147.4" width="1.7" height="10.5" rx="0.85" transform="rotate(14 378.5 153.5)" />
                </g>
                <ellipse class="pivot-shade" cx="368" cy="142" rx="14" ry="9.6" filter="url(#blur2)" />
                <path class="pivot-side" d="M357,140 A11,7.6 0 0,0 379,140 L379,119 A11,7.6 0 0,1 357,119 Z" fill="url(#metalSide)" />
                <rect class="pivot-hi" x="366.5" y="120" width="2" height="19" />
                <ellipse class="pivot-top" cx="368" cy="119" rx="11" ry="7.6" fill="url(#metalTop)" />
                <path class="pivot-cap-side" d="M363,119 A5,3.4 0 0,0 373,119 L373,115 A5,3.4 0 0,1 363,115 Z" />
                <ellipse class="pivot-cap" cx="368" cy="115" rx="5" ry="3.4" />
              </g>
            </g>

            <!-- 面板点缀 -->
            <ellipse class="knob" cx="58" cy="268" rx="10" ry="7" />
            <ellipse class="knob-hi" cx="58" cy="268" rx="10" ry="7" />
            <ellipse class="knob" cx="96" cy="268" rx="10" ry="7" />
            <ellipse class="knob-hi" cx="96" cy="268" rx="10" ry="7" />
            <circle class="led-halo led-halo-1" cx="376" cy="86" r="8" />
            <circle class="led led-1" cx="376" cy="86" r="3.2" />
            <circle class="led-halo led-halo-2" cx="390" cy="86" r="8" />
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
