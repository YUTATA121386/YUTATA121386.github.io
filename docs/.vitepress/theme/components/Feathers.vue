<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue"

const pool = ref<HTMLElement[]>([])
const POS = ["2%", "14%", "27%", "40%", "53%", "66%", "79%", "92%"]
const speeds: number[] = []
const phases: number[] = []
let ticking = false

function update() {
  const sy = window.scrollY
  const vh = window.innerHeight
  pool.value.forEach((f, i) => {
    const y = (sy * speeds[i] + phases[i]) % (vh + 500) - 250
    const sway = Math.sin(sy * 0.0015 + i * 1.2) * 22
    const rot = Math.sin(sy * 0.0018 + i * 0.9) * 18
    f.style.transform = `translateY(${y.toFixed(1)}px) translateX(${sway.toFixed(1)}px) rotate(${rot.toFixed(1)}deg)`
    f.style.opacity = y > -30 && y < vh + 30 ? "0.6" : "0"
  })
  ticking = false
}

function onScroll() {
  if (!ticking) {
    ticking = true
    requestAnimationFrame(update)
  }
}

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  for (let i = 0; i < 8; i++) {
    speeds.push(0.5 + Math.random() * 0.9)
    phases.push(Math.random() * 1400)
  }
  window.addEventListener("scroll", onScroll, { passive: true })
  update()
})

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll)
})
</script>

<template>
  <div v-for="i in 8" :key="i" ref="pool" class="feather" :style="{ left: POS[i - 1] }" aria-hidden="true"></div>
</template>
