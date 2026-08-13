<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"
import { withBase } from "vitepress"
import { data } from "../../data/kb.data"
import moodMorning from "../art/mood-morning.jpg"
import moodNoon from "../art/mood-noon.jpg"
import moodDusk from "../art/mood-dusk.jpg"
import moodNight from "../art/mood-night.jpg"
import cover01 from "../art/covers/cover-01.jpg"
import cover02 from "../art/covers/cover-02.jpg"
import cover03 from "../art/covers/cover-03.jpg"
import cover04 from "../art/covers/cover-04.jpg"
import cover05 from "../art/covers/cover-05.jpg"
import cover06 from "../art/covers/cover-06.jpg"
import cover07 from "../art/covers/cover-07.jpg"
import cover08 from "../art/covers/cover-08.jpg"
import cover09 from "../art/covers/cover-09.jpg"
import cover10 from "../art/covers/cover-10.jpg"

const time = ref("--:--:--")
const dateStr = ref("")
const period = ref("晨")
const NAMES: Record<string, string> = { morning: "晨", noon: "午", dusk: "暮", night: "夜" }
const MOOD: Record<string, string> = { morning: moodMorning, noon: moodNoon, dusk: moodDusk, night: moodNight }
const ALBUMS = [
  { year: "2016", name: "飞行器的执行周期", art: cover01 },
  { year: "2017", name: "逆輸入 〜航空局〜", art: cover02 },
  { year: "2018", name: "寻宝游戏", art: cover03 },
  { year: "2019", name: "爱的呼唤", art: cover04 },
  { year: "2020", name: "STRAY SHEEP", art: cover05 },
  { year: "2021", name: "Fresh Soul", art: cover06 },
  { year: "2022", name: "马拉美的星期二", art: cover07 },
  { year: "2023", name: "裘德", art: cover08 },
  { year: "2024", name: "珍珠刑", art: cover09 },
  { year: "2025", name: "过客", art: cover10 },
]
const RECOMMENDED = [
  { title: "22岁 | 2026年度OKR", url: "growth/okr-2026.html", meta: "上升清单" },
  { title: "第 07 周复盘 · 记忆管理师环评", url: "weekly/review-2026-W07.html", meta: "2026-08-09" },
  { title: "通信规则 · V2.2.33", url: "rules/communication-rules.html", meta: "规则体系" },
  { title: "东京大饭店 · 法餐与日式材料的可能性", url: "general/grand-maison-tokyo.html", meta: "通识积累" },
  { title: "实习准备 · 要点攻略与事后复盘", url: "interview/internship.html", meta: "面试专栏" },
]

const moodSrc = ref<string>(MOOD.morning)
let moodObserver: MutationObserver | undefined

function syncMood() {
  const p = document.documentElement.getAttribute("data-palette") || "morning"
  moodSrc.value = MOOD[p] || MOOD.morning
}
let timer: number | undefined

function tick() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, "0")
  const mm = String(d.getMinutes()).padStart(2, "0")
  const ss = String(d.getSeconds()).padStart(2, "0")
  time.value = `${hh}:${mm}:${ss}`
  const week = "日一二三四五六"[d.getDay()]
  dateStr.value = `${d.getFullYear()} / ${String(d.getMonth() + 1).padStart(2, "0")} / ${String(d.getDate()).padStart(2, "0")} · 星期${week}`
  const h = d.getHours()
  period.value = NAMES[h < 11 ? "morning" : h < 17 ? "noon" : h < 21 ? "dusk" : "night"]
}

onMounted(() => {
  tick()
  timer = window.setInterval(tick, 1000)
  syncMood()
  moodObserver = new MutationObserver(syncMood)
  moodObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["data-palette"] })
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  moodObserver?.disconnect()
})
</script>

<template>
  <section class="epigraph">
    <span class="epigraph-kicker">卷首语 · FOREWORD</span>
    <p class="epigraph-fr">Ah Je me réveille à peine<br />Je suis encore toute décoiffée<br />Ma fleur est là quelque part</p>
  </section>

  <section class="bento">
    <div class="section-head"><span class="sh-cn">此刻</span><span class="sh-en">NOW PLAYING</span></div>
    <div class="bento-grid">
      <article class="cell cell-now glass">
        <div class="mood-art" :style="{ backgroundImage: 'url(' + moodSrc + ')' }" aria-hidden="true"></div>
        <div class="now-clock">
          <span class="now-time">{{ time }}</span>
          <span class="now-date">{{ dateStr }}</span>
          <span class="now-period">此刻 · {{ period }}</span>
        </div>
        <div class="now-updates">
          <p class="update-label">推荐阅读</p>
          <a v-for="u in RECOMMENDED" :key="u.url" class="update-item" :href="withBase(u.url)">
            <span class="update-bullet"></span>
            <span class="update-text">{{ u.title }}<span class="update-meta">{{ u.meta }}</span></span>
            <span class="update-arrow">→</span>
          </a>
        </div>
      </article>
      <article class="cell cell-covers glass">
        <span class="cell-kicker">人生专辑 · 2016–2025</span>
        <div class="covers-grid">
          <div v-for="a in ALBUMS" :key="a.year" class="cover-item">
            <img class="cover-art" :src="a.art" :alt="a.year + ' ' + a.name" loading="lazy" />
            <span class="cover-label"><span class="cover-year">{{ a.year }}</span><span class="cover-name">{{ a.name }}</span></span>
          </div>
        </div>
      </article>
      <div class="stats-bar glass">
        <div class="stat-cell"><b>{{ data.totalPages }}</b><span>收录页面</span></div>
        <div class="stat-cell"><b>06</b><span>已归档卷宗</span></div>
        <div class="stat-cell"><b>{{ data.dailyCount }}</b><span>雷达期数</span></div>
        <div class="stat-cell"><b>{{ data.weeklyCount }}</b><span>周报复盘</span></div>
      </div>
    </div>
  </section>

  <footer class="foot">
    <p class="foot-line">YUTATA · 2026</p>
  </footer>
</template>
