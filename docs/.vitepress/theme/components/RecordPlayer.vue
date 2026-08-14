<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue"
import { withBase } from "vitepress"
import deckImg from "../art/deck-record.webp"
import vinylImg from "../art/vinyl.webp"
import armImg from "../art/arm.webp"

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
          <div class="deck-stage">
            <!-- 机身：千问实拍质感素材（含银色转盘与黑胶底盘） -->
            <img class="deck-img" :src="deckImg" alt="" draggable="false" />
            <!-- 四时段材质氛围层 -->
            <div class="deck-tint" aria-hidden="true"></div>
            <!-- 地面投影（随鼠标轻微反向移动） -->
            <div class="floor-shadow" aria-hidden="true"></div>
            <!-- 黑胶旋转层：与素材内黑胶同椭圆（scaleY .563），spool 加速 + rot 匀速 -->
            <div class="platter" aria-hidden="true">
              <div class="vinyl-spool">
                <div class="vinyl-rot">
                  <img class="vinyl-img" :src="vinylImg" alt="" draggable="false" />
                  <svg class="vinyl-label" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
                    <circle class="label-ring" cx="24" cy="24" r="19" />
                    <circle class="label-ring-in" cx="24" cy="24" r="15.5" />
                    <g
                      v-for="m in MODULES"
                      :key="m.num"
                      class="vol-glyph"
                      :class="'glyph-' + m.num.toLowerCase()"
                      transform="translate(24 24) scale(1.12)"
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
                    <circle class="spindle-hole" cx="24" cy="24" r="1.3" />
                    <circle class="spindle-cap" cx="24" cy="24" r="0.85" />
                    <circle class="spindle-cap-hi" cx="23.6" cy="23.6" r="0.3" />
                  </svg>
                </div>
              </div>
            </div>
            <!-- 轴承座接触影：让唱臂轴承'坐进'底座 -->
            <div class="pivot-socket" aria-hidden="true"></div>
            <!-- 唱臂投影 + 唱臂（千问素材） -->
            <img class="arm-shadow" :src="armImg" alt="" aria-hidden="true" draggable="false" />
            <div class="arm-wrap" aria-hidden="true" @animationend="onArmAnimEnd">
              <img class="arm-img" :src="armImg" alt="" draggable="false" />
            </div>
            <!-- 针尖接触影 + 高光 -->
            <div class="stylus-shadow" aria-hidden="true"></div>
            <div class="stylus-glint" aria-hidden="true"></div>
            <div class="stylus-contact" aria-hidden="true"></div>
          </div>
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
