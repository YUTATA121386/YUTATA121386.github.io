<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue"
import { withBase } from "vitepress"
import { data } from "../../data/kb.data"
import moodMorning from "../art/mood-morning.jpg"
import moodNoon from "../art/mood-noon.jpg"
import moodDusk from "../art/mood-dusk.jpg"
import moodNight from "../art/mood-night.jpg"

const time = ref("--:--:--")
const dateStr = ref("")
const period = ref("晨")
const NAMES: Record<string, string> = { morning: "晨", noon: "午", dusk: "暮", night: "夜" }
const MOOD: Record<string, string> = { morning: moodMorning, noon: moodNoon, dusk: moodDusk, night: moodNight }
const RECOMMENDED = [
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
      <article class="cell cell-about glass">
        <span class="cell-kicker">ABOUT</span>
        <h3 class="about-line">这里没有观众，<br>只有记录。</h3>
        <ul class="principles">
          <li><b>费曼原则</b>写不清楚，就是没想清楚</li>
          <li><b>长期主义</b>积累五年、十年</li>
          <li><b>真诚记录</b>不为表演，只为自己</li>
        </ul>
        <p class="about-quote">"The beautiful thing about learning<br>is that nobody can take it away."<span>— B.B. King</span></p>
      </article>
      <article class="cell cell-stats glass">
        <span class="cell-kicker">ARCHIVE STATUS</span>
        <div class="stat-grid">
          <div><b>{{ data.totalPages }}</b><span>收录页面</span></div>
          <div><b>06</b><span>已归档卷宗</span></div>
          <div><b>{{ data.dailyCount }}</b><span>雷达期数</span></div>
          <div><b>{{ data.weeklyCount }}</b><span>周报复盘</span></div>
        </div>
      </article>
    </div>
  </section>
</template>
