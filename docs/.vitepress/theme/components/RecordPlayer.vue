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
const slow = ref(false)
const switching = ref(false)
const deckEl = ref<HTMLElement | null>(null)
const areaEl = ref<HTMLElement | null>(null)

let switchTimer: number | undefined
let liftTimer: number | undefined
let slowTimer: number | undefined
let raiseTimer: number | undefined
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

function startSlow() {
  if (slowTimer) clearTimeout(slowTimer)
  slowTimer = window.setTimeout(() => { slow.value = true }, 1400)
}
function stopSlow() {
  if (slowTimer) clearTimeout(slowTimer)
  slow.value = false
}

/* 指针跟随倾斜：让唱片机像实物一样随视角转动 */
function applyTilt() {
  tiltRaf = 0
  tiltCx += (tiltTx - tiltCx) * 0.09
  tiltCy += (tiltTy - tiltCy) * 0.09
  const deck = deckEl.value
  if (deck) {
    deck.style.setProperty("--tilt-x", tiltCy.toFixed(3))
    deck.style.setProperty("--tilt-y", tiltCx.toFixed(3))
  }
  if (Math.abs(tiltTx - tiltCx) > 0.004 || Math.abs(tiltTy - tiltCy) > 0.004) {
    tiltRaf = requestAnimationFrame(applyTilt)
  }
}
function onAreaMove(e: MouseEvent) {
  const r = areaEl.value?.getBoundingClientRect()
  if (!r || r.width === 0) return
  tiltTx = (((e.clientX - r.left) / r.width) * 2 - 1) * 8
  tiltTy = (((e.clientY - r.top) / r.height) * 2 - 1) * 6
  if (!tiltRaf) tiltRaf = requestAnimationFrame(applyTilt)
}
function onAreaLeave() {
  stopSlow()
  tiltTx = 0
  tiltTy = 0
  if (!tiltRaf) tiltRaf = requestAnimationFrame(applyTilt)
  // 离开后抬起唱针（模拟暂停），再次进入时重新落下
  if (dropTimer) clearTimeout(dropTimer)
  if (raiseTimer) clearTimeout(raiseTimer)
  raiseTimer = window.setTimeout(raiseArm, 2200)
}
function onAreaEnter() {
  startSlow()
  if (raiseTimer) clearTimeout(raiseTimer)
  if (!dropped.value) dropTimer = window.setTimeout(dropArm, 450)
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
  if (slowTimer) clearTimeout(slowTimer)
  if (raiseTimer) clearTimeout(raiseTimer)
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
      <div ref="areaEl" class="turntable-area" @mouseenter="onAreaEnter" @mousemove="onAreaMove" @mouseleave="onAreaLeave">
        <div
          ref="deckEl"
          class="deck"
          :class="{ 'is-dropped': dropped, 'is-slow': slow }"
          role="img"
          aria-label="六卷档案黑胶唱片机"
        >
          <div class="deck__scene">
            <!-- 地面投影 -->
            <div class="deck__shadow"></div>

            <!-- 底座：顶面 + 6 层挤出厚度 -->
            <div class="plinth">
              <div class="plinth__face face-front"></div>
              <div class="plinth__face face-right"></div>
              <div class="plinth__top"></div>
            </div>

            <!-- 转盘 -->
            <div class="platter">
              <div class="platter__mat"></div>
              <i class="platter__ring"></i>
            </div>

            <!-- 唱片落影 -->
            <div class="vinyl-cast"></div>

            <!-- 黑胶唱片（自转层） -->
            <div class="vinyl">
              <div class="vinyl__spin">

                <div class="vinyl__label">
                  <div
                    v-for="(m, i) in MODULES"
                    :key="m.num"
                    class="vol-art"
                    :class="{ 'is-active': i === current }"
                  >
                    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
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
                    </svg>
                  </div>
                  <span class="label-dot d1"></span>
                  <span class="label-dot d2"></span>
                  <span class="label-dot d3"></span>
                </div>
                <div class="vinyl__hole"><i></i></div>
                <i class="vinyl__shimmer"></i>
              </div>
            </div>

            <!-- 光楔：与唱片分离，不随自转 -->
            <div class="vinyl__sheen"></div>

            <!-- 唱臂：外层定位，内层落针 -->
            <div class="tonearm">
              <div class="tonearm__swing">
                <div class="tonearm__wand"></div>
                <div class="tonearm__headshell"></div>
                <div class="tonearm__stylus"></div>
                <div class="tonearm__counterweight"></div>
              </div>
              <div class="tonearm__pivot"></div>
            </div>
            <!-- 针尖接触投影：落在唱片表面，仅落针后可见 -->
            <div class="tonearm__cast"></div>

            <!-- 面板点缀 -->
            <div class="deck__knob knob-1"></div>
            <div class="deck__knob knob-2"></div>
            <div class="deck__led led-1"></div>
            <div class="deck__led led-2"></div>
            <!-- 环境光扫过：缓慢旋转的光，营造时间感 -->
            <div class="deck__sweep"></div>
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
