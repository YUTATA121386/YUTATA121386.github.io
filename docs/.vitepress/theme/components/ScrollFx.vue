<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"

let sts: gsap.plugins.ScrollTriggerInstance[] = []

onMounted(() => {
  if (typeof window === "undefined") return
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
  gsap.registerPlugin(ScrollTrigger)

  const one = (sel: string) => document.querySelector(sel)
  const all = (sel: string) => Array.from(document.querySelectorAll(sel))

  // 唱片机整体随滚动轻微升降（视差）
  const turntable = one(".turntable")
  if (turntable) {
    const t = gsap.fromTo(turntable, { yPercent: 3.2 }, {
      yPercent: -3.2,
      ease: "none",
      scrollTrigger: { trigger: ".player-section", start: "top bottom", end: "bottom top", scrub: true },
    })
    sts.push(t.scrollTrigger as gsap.plugins.ScrollTriggerInstance)
  }

  // 此刻 mood-art 内视差（略放大后随滚动平移）
  const mood = one(".mood-art")
  if (mood) {
    const t = gsap.fromTo(mood, { yPercent: -9, scale: 1.16 }, {
      yPercent: 9,
      scale: 1.16,
      ease: "none",
      scrollTrigger: { trigger: ".cell-now", start: "top bottom", end: "bottom top", scrub: true },
    })
    sts.push(t.scrollTrigger as gsap.plugins.ScrollTriggerInstance)
  }

  // bento 卡片入场（一次性，错落浮现）
  const cells = all(".bento .cell")
  if (cells.length) {
    const t = gsap.fromTo(cells, { y: 26, opacity: 0 }, {
      y: 0,
      opacity: 1,
      duration: 0.8,
      stagger: 0.12,
      ease: "power3.out",
      scrollTrigger: { trigger: ".bento-grid", start: "top 84%", once: true },
    })
    sts.push(t.scrollTrigger as gsap.plugins.ScrollTriggerInstance)
  }
})

onBeforeUnmount(() => {
  sts.forEach((s) => s.kill())
  sts = []
})
</script>

<template>
  <span class="scroll-fx" aria-hidden="true" />
</template>
