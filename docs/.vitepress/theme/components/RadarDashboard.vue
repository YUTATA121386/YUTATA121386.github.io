<script setup lang="ts">
import { computed, ref } from "vue"
import { withBase } from "vitepress"
import { data } from "../../data/kb.data"

const reportSet = new Set(data.dailyDates)
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth())
const active = ref<string | null>(data.latestDaily || null)

const MONTHS = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"]
const DOW = ["日", "一", "二", "三", "四", "五", "六"]

const days = computed(() => {
  const first = new Date(year.value, month.value, 1).getDay()
  const count = new Date(year.value, month.value + 1, 0).getDate()
  const cells: (number | null)[] = Array(first).fill(null)
  for (let d = 1; d <= count; d++) cells.push(d)
  return cells
})

function dayKey(d: number) {
  return `${year.value}-${String(month.value + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}
function isReport(d: number) {
  return reportSet.has(dayKey(d))
}
function isToday(d: number) {
  const t = new Date()
  return t.getFullYear() === year.value && t.getMonth() === month.value && t.getDate() === d
}
function pick(d: number) {
  if (!isReport(d)) return
  active.value = dayKey(d)
}
function shift(delta: number) {
  month.value += delta
  if (month.value < 0) { month.value = 11; year.value-- }
  if (month.value > 11) { month.value = 0; year.value++ }
  active.value = null
}

const activeItems = computed(() => (active.value ? data.dailyPreview[active.value] ?? [] : []))
</script>

<template>
  <div class="radar-dashboard">
    <div class="dash-top">
      <div class="dash-stat glass"><b>{{ data.dailyCount }}</b><span>雷达期数</span></div>
      <div class="dash-stat glass"><b>05</b><span>Agent 协作</span></div>
      <div class="dash-stat glass"><b>{{ data.weeklyCount }}</b><span>周报复盘</span></div>
      <div class="dash-stat glass"><b>{{ data.totalPages }}</b><span>收录页面</span></div>
    </div>

    <div class="calendar-wrap">
      <div class="glass">
        <div class="calendar">
          <div class="cal-month">
            <button type="button" class="cal-nav" aria-label="上个月" @click="shift(-1)">←</button>
            <span>{{ year }}年{{ MONTHS[month] }}</span>
            <button type="button" class="cal-nav" aria-label="下个月" @click="shift(1)">→</button>
          </div>
          <div v-for="d in DOW" :key="'d' + d" class="cal-dow">{{ d }}</div>
          <template v-for="(d, i) in days" :key="i">
            <div v-if="d === null" class="cal-day empty"></div>
            <button
              v-else
              type="button"
              :class="['cal-day', { 'has-report': isReport(d), 'is-active': active === dayKey(d), today: isToday(d) }]"
              :data-day="d"
              @click="pick(d)"
            >{{ d }}</button>
          </template>
        </div>
      </div>
      <div class="cal-preview glass">
        <h4>{{ active ? '行业雷达日报 · ' + active : '选择日期' }}</h4>
        <p v-if="!active" class="prev-meta">点击日历中高亮的日期查看日报摘要。</p>
        <p v-else class="prev-meta">READ DAILY REPORT</p>
        <ul v-if="activeItems.length" class="prev-items">
          <li v-for="it in activeItems" :key="it">{{ it }}</li>
        </ul>
        <a v-if="active" class="prev-cta" :href="withBase('daily/' + active)">阅读完整日报 →</a>
      </div>
    </div>

    <div class="dash-quick">
      <a class="landing-card glass" :href="withBase('daily/' + (data.latestDaily || ''))">
        <h4>最新日报</h4><p>{{ data.latestDaily || '暂无' }} · 查看今日行业洞察</p>
      </a>
      <a class="landing-card glass" :href="withBase('logs/')"><h4>过程日志</h4><p>Agent 协作全记录 · 决策链路追踪</p></a>
      <a class="landing-card glass" :href="withBase('weekly/')"><h4>周报复盘</h4><p>数据趋势 · 评分卡 · 关键总结</p></a>
      <a class="landing-card glass" :href="withBase('rules/')"><h4>规则体系</h4><p>采集 · 核查 · 排版 · 通信 · 质量</p></a>
    </div>
  </div>
</template>
