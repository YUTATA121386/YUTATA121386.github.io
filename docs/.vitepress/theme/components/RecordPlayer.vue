<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue"
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
  { num: "I", en: "GROWTH", title: "上升清单", color: "#c9993d", desc: "自我剖析 · 关键决策 · 成长轨迹", badge: "扩充中", items: ["卷首 · 概述", "自我剖析 · 即将上架", "关键决策复盘 · 即将上架"], stat: "长期主义 · 五年为尺", link: "growth/" },
  { num: "II", en: "RADAR", title: "行业雷达", color: "#3d7ea6", desc: "每日自动采集 · AI 深度分析 · 曲库行业动态", badge: "LIVE", live: true, items: ["日报概览", "过程日志", "周报", "规则体系", "关键词覆盖"], stat: "每日 12:00 自动更新", link: "daily/" },
  { num: "III", en: "MUSIC PRODUCT", title: "云音乐产品学习", color: "#c03434", desc: "产品分析 · 活动运营 · 用户反馈", items: ["年度报告", "歌词翻译编辑部", "AI 歌曲资料补充", "歌词 AB 实验", "云村用户节"], stat: "8 篇深度拆解", link: "music-product/" },
  { num: "IV", en: "LIBERAL ARTS", title: "通识积累", color: "#5f7a5a", desc: "影视评鉴 · 法餐考据 · 唱片评鉴", items: ["日本影视剧 · 评级", "东京大饭店 · 烹饪技法", "音乐鉴赏 · 唱片评价", "曲库运营 · 多方视角"], stat: "5 个长期专题", link: "general/" },
  { num: "V", en: "PILGRIMAGE", title: "圣地巡礼", color: "#c76b3f", desc: "旅行记录 · 取景地打卡 · 文化考察", badge: "施工中", items: ["卷首 · 概述", "东京篇 · 筹备中"], stat: "下一站 · 东京", link: "pilgrimage/" },
  { num: "VI", en: "INTERVIEW", title: "校招面试话术", color: "#46537e", desc: "简历策略 · 高频问答 · 企业面经", items: ["通用高频问题", "网易云音乐 · 面经", "昆仑天工 · 面经", "荔枝 · 面经", "+ 3 家记录"], stat: "6 家企业实战", link: "interview/" },
]

const current = ref(0)
const dropped = ref(false)
const switching = ref(false)
const slow = ref(false)
const turntableEl = ref<HTMLElement | null>(null)
let switchTimer: number | undefined
let liftTimer: number | undefined
let slowTimer: number | undefined
let observer: IntersectionObserver | undefined

const mod = computed(() => MODULES[current.value])
const spinStyle = computed(() => ({ "--spin-dur": slow.value ? "12s" : "4.5s" }))

function selectModule(i: number) {
  if (i === current.value) return
  current.value = i
  switching.value = true
  if (switchTimer) clearTimeout(switchTimer)
  switchTimer = window.setTimeout(() => { switching.value = false }, 260)
  // 抬起唱臂 → 换碟 → 缓缓落下
  dropped.value = false
  if (liftTimer) clearTimeout(liftTimer)
  liftTimer = window.setTimeout(() => { dropped.value = true }, 650)
}

function startSlow() {
  if (slowTimer) clearTimeout(slowTimer)
  slowTimer = window.setTimeout(() => { slow.value = true }, 1500)
}

function stopSlow() {
  if (slowTimer) clearTimeout(slowTimer)
  slow.value = false
}

onMounted(() => {
  if (turntableEl.value && "IntersectionObserver" in window) {
    observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        dropped.value = true
        observer?.disconnect()
      }
    }, { threshold: 0.25 })
    observer.observe(turntableEl.value)
  } else {
    dropped.value = true
  }
})
onBeforeUnmount(() => {
  if (switchTimer) clearTimeout(switchTimer)
  if (liftTimer) clearTimeout(liftTimer)
  if (slowTimer) clearTimeout(slowTimer)
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
      <div class="turntable-area" @mouseenter="startSlow" @mouseleave="stopSlow">
        <div ref="turntableEl" class="turntable" :class="{ 'is-slow': slow }">
          <svg class="tt-svg" viewBox="0 0 380 340" aria-hidden="true" focusable="false">
            <!-- 底座 -->
            <rect class="tt-base" x="30" y="282" width="320" height="42" rx="9" />
            <path class="tt-base-edge" d="M39 282 L341 282" />
            <circle class="tt-base-dot" cx="60" cy="303" r="3" />
            <circle class="tt-base-dot" cx="320" cy="303" r="3" />
            <!-- 唱盘 -->
            <circle class="tt-platter" cx="190" cy="168" r="121" />
            <circle class="tt-platter-ring" cx="190" cy="168" r="106" />
            <!-- 唱片（旋转） -->
            <g class="tt-disc" :style="spinStyle">
              <circle class="tt-disc-fill" cx="190" cy="168" r="98" />
              <circle class="tt-disc-rim" cx="190" cy="168" r="95" />
              <circle class="tt-disc-groove" cx="190" cy="168" r="80" />
              <circle class="tt-disc-groove" cx="190" cy="168" r="62" />
              <circle class="tt-disc-groove" cx="190" cy="168" r="46" />
              <circle class="tt-disc-label" cx="190" cy="168" :fill="mod.color" />
              <circle class="tt-disc-labelhole" cx="190" cy="168" r="5" />
              <g class="tt-disc-glyph">
                <g v-if="mod.num === 'I'" class="glyph">
                  <line x1="190" y1="181" x2="190" y2="158" />
                  <path d="M190 153.2 L185.8 160.2 L194.2 160.2 Z" />
                </g>
                <g v-else-if="mod.num === 'II'" class="glyph">
                  <circle cx="190" cy="168" r="11" />
                  <circle cx="190" cy="168" r="5.5" />
                  <line x1="190" y1="168" x2="199.5" y2="162" />
                  <circle class="glyph-dot" cx="199.5" cy="162" r="1.7" />
                  <circle class="glyph-dot" cx="190" cy="168" r="2.2" />
                </g>
                <g v-else-if="mod.num === 'III'" class="glyph">
                  <ellipse cx="184" cy="177" rx="3.4" ry="2.6" />
                  <line x1="187.2" y1="175.6" x2="187.2" y2="160" />
                  <path d="M187.2 160 C 191 161 192.5 164 192 167.5" />
                </g>
                <g v-else-if="mod.num === 'IV'" class="glyph">
                  <rect x="179" y="159.5" width="22" height="21" rx="2.5" />
                  <line x1="185.5" y1="163.5" x2="185.5" y2="176.5" />
                  <line x1="194.5" y1="163.5" x2="194.5" y2="176.5" />
                  <rect class="glyph-dot" x="188.2" y="156" width="3.6" height="8" rx="1.2" />
                </g>
                <g v-else-if="mod.num === 'V'" class="glyph">
                  <circle cx="196" cy="159.5" r="4.5" />
                  <path d="M178.5 180 L185.5 169.5 L189.5 174.5 L193.5 167 L201.5 180 Z" />
                </g>
                <g v-else class="glyph">
                  <path d="M182 158.5 L198 158.5 A 3.5 3.5 0 0 1 201.5 162 L201.5 172 A 3.5 3.5 0 0 1 198 175.5 L192 175.5 L188.5 179 L189 175.5 L182 175.5 A 3.5 3.5 0 0 1 178.5 172 L178.5 162 A 3.5 3.5 0 0 1 182 158.5 Z" />
                  <circle class="glyph-dot" cx="184" cy="167" r="1.3" />
                  <circle class="glyph-dot" cx="190" cy="167" r="1.3" />
                  <circle class="glyph-dot" cx="196" cy="167" r="1.3" />
                </g>
              </g>
              <path class="tt-disc-shine" d="M124 132 A 72 72 0 0 1 176 98" />
              <circle class="tt-disc-tick" cx="190" cy="252" r="3.5" />
            </g>
            <!-- 唱臂：抬起时离碟，落下时触碟 -->
            <g class="tt-arm" :class="{ 'is-dropped': dropped }">
              <circle class="tt-pivot" cx="352" cy="70" r="10" />
              <circle class="tt-pivot-core" cx="352" cy="70" r="3.5" />
              <g class="tt-arm-line">
                <line x1="352" y1="70" x2="258" y2="76" />
                <path class="tt-headshell" d="M256 70 L270 74 L270 92 L256 96 Z" />
                <line class="tt-stylus" x1="263" y1="94" x2="262" y2="114" />
              </g>
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
