<script setup lang="ts">
import { onMounted, ref } from "vue"

const PALETTES = ["morning", "noon", "dusk", "night"] as const
type Palette = (typeof PALETTES)[number]
const NAMES: Record<Palette, string> = { morning: "晨", noon: "午", dusk: "暮", night: "夜" }
const STORAGE = "yutata-palette"

const current = ref<Palette | "auto">("auto")
const label = ref("晨")
let timer: number | undefined

function hourPalette(h: number): Palette {
  return h < 11 ? "morning" : h < 17 ? "noon" : h < 21 ? "dusk" : "night"
}

function apply(p: Palette) {
  const root = document.documentElement
  root.dataset.palette = p
  root.classList.toggle("dark", p === "night")
  label.value = NAMES[p]
}

function setPalette(p: Palette | "auto") {
  try { localStorage.setItem(STORAGE, p) } catch { /* ignore */ }
  if (timer) { clearTimeout(timer); timer = undefined }
  if (p === "auto") {
    current.value = "auto"
    apply(hourPalette(new Date().getHours()))
    scheduleTick()
  } else {
    current.value = p
    apply(p)
  }
}

function scheduleTick() {
  timer = window.setTimeout(() => {
    apply(hourPalette(new Date().getHours()))
    scheduleTick()
  }, 60_000)
}

onMounted(() => {
  let saved: string | null = null
  try { saved = localStorage.getItem(STORAGE) } catch { /* ignore */ }
  if (saved === "morning" || saved === "noon" || saved === "dusk" || saved === "night") {
    current.value = saved
    apply(saved)
  } else {
    current.value = "auto"
    apply(hourPalette(new Date().getHours()))
    scheduleTick()
  }
})
</script>

<template>
  <div class="palette-switch" role="group" aria-label="时段配色">
    <span class="ps-label">此刻 · {{ label }}</span>
    <button
      v-for="p in PALETTES"
      :key="p"
      type="button"
      :class="{ on: current === p }"
      :data-p="p"
      @click="setPalette(p)"
    >{{ NAMES[p] }}</button>
    <button type="button" :class="{ on: current === 'auto' }" class="ps-auto" @click="setPalette('auto')">自动</button>
  </div>
</template>
