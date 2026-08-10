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
  { num: "I", en: "GROWTH", title: "上升清单", color: "#d9a441", desc: "自我剖析 · 关键决策 · 成长轨迹", badge: "扩充中", items: ["卷首 · 概述", "自我剖析 · 即将上架", "关键决策复盘 · 即将上架"], stat: "长期主义 · 五年为尺", link: "growth/" },
  { num: "II", en: "RADAR", title: "行业雷达", color: "#3d7ea6", desc: "每日自动采集 · AI 深度分析 · 曲库行业动态", badge: "LIVE", live: true, items: ["日报概览", "过程日志", "周报", "规则体系", "关键词覆盖"], stat: "每日 12:00 自动更新", link: "daily/" },
  { num: "III", en: "MUSIC PRODUCT", title: "云音乐产品学习", color: "#c03434", desc: "产品分析 · 活动运营 · 用户反馈", items: ["年度报告", "歌词翻译编辑部", "AI 歌曲资料补充", "歌词 AB 实验", "云村用户节"], stat: "8 篇深度拆解", link: "music-product/" },
  { num: "IV", en: "LIBERAL ARTS", title: "通识积累", color: "#5f7a5a", desc: "影视评鉴 · 法餐考据 · 唱片评鉴", items: ["日本影视剧 · 评级", "东京大饭店 · 烹饪技法", "音乐鉴赏 · 唱片评价", "曲库运营 · 多方视角"], stat: "5 个长期专题", link: "general/" },
  { num: "V", en: "PILGRIMAGE", title: "圣地巡礼", color: "#c76b3f", desc: "旅行记录 · 取景地打卡 · 文化考察", badge: "施工中", items: ["卷首 · 概述", "东京篇 · 筹备中"], stat: "下一站 · 东京", link: "pilgrimage/" },
  { num: "VI", en: "INTERVIEW", title: "校招面试话术", color: "#46537e", desc: "简历策略 · 高频问答 · 企业面经", items: ["通用高频问题", "网易云音乐 · 面经", "昆仑天工 · 面经", "荔枝 · 面经", "+ 3 家记录"], stat: "6 家企业实战", link: "interview/" },
]

const current = ref(0)
const spinning = true
const dropped = ref(false)
const switching = ref(false)
const slow = ref(false)
let switchTimer: number | undefined
let slowTimer: number | undefined

const mod = computed(() => MODULES[current.value])
const spinStyle = computed(() => ({ "--spin-dur": slow.value ? "12s" : "4.5s" }))

function selectModule(i: number) {
  if (i === current.value) return
  current.value = i
  switching.value = true
  if (switchTimer) clearTimeout(switchTimer)
  switchTimer = window.setTimeout(() => { switching.value = false }, 220)
  dropped.value = false
  nextTick(() => { dropped.value = true })
}

function startSlow() {
  if (slowTimer) clearTimeout(slowTimer)
  slowTimer = window.setTimeout(() => { slow.value = true }, 1500)
}

function stopSlow() {
  if (slowTimer) clearTimeout(slowTimer)
  slow.value = false
}

onMounted(() => { dropped.value = true })
onBeforeUnmount(() => {
  if (switchTimer) clearTimeout(switchTimer)
  if (slowTimer) clearTimeout(slowTimer)
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
        <div class="turntable">
          <div class="tt-plinth"><div class="tt-plinth-top"></div></div>
          <div class="tt-platter" :class="{ spinning }" :style="spinStyle"><div class="tt-platter-rim"></div><div class="tt-platter-mat"></div></div>
          <div class="tt-record" :class="{ spinning }" :style="[spinStyle, { '--mod-color': mod.color }]">
            <div class="tt-record-grooves"></div>
            <div class="tt-label" :style="{ background: mod.color }">{{ mod.num }}</div>
          </div>
          <div class="tt-tonearm-base"></div>
          <div class="tt-tonearm" :class="{ 'is-dropped': dropped }">
            <div class="tt-arm-tube"></div>
            <div class="tt-headshell"><div class="tt-cartridge"></div><div class="tt-stylus"></div></div>
            <div class="tt-counterweight"></div>
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
