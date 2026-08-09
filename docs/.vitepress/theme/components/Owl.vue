<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from "vue"
import { withBase } from "vitepress"

const owlEl = ref<HTMLElement | null>(null)
let raf = 0

function onMove(e: MouseEvent) {
  if (raf) return
  raf = requestAnimationFrame(() => {
    const el = owlEl.value
    if (el) {
      const r = el.getBoundingClientRect()
      const dx = Math.max(-3, Math.min(3, (e.clientX - (r.left + r.width / 2)) / 18))
      const dy = Math.max(-3, Math.min(3, (e.clientY - (r.top + r.height / 2)) / 18))
      el.style.setProperty("--px", dx.toFixed(2) + "px")
      el.style.setProperty("--py", dy.toFixed(2) + "px")
    }
    const light = document.querySelector<HTMLElement>(".bg-light")
    if (light) {
      light.style.setProperty("--mx", ((e.clientX / window.innerWidth) * 100).toFixed(2) + "%")
      light.style.setProperty("--my", ((e.clientY / window.innerHeight) * 100).toFixed(2) + "%")
    }
    raf = 0
  })
}

function onLeave() {
  const el = owlEl.value
  if (el) {
    el.style.setProperty("--px", "0px")
    el.style.setProperty("--py", "0px")
  }
}

onMounted(() => {
  window.addEventListener("mousemove", onMove, { passive: true })
  document.addEventListener("mouseleave", onLeave)
})
onBeforeUnmount(() => {
  window.removeEventListener("mousemove", onMove)
  document.removeEventListener("mouseleave", onLeave)
})
</script>

<template>
  <a ref="owlEl" class="owl" :href="withBase('/')" aria-label="返回首页">
    <span class="owl-eye owl-eye-l"><span class="owl-pupil"></span></span>
    <span class="owl-eye owl-eye-r"><span class="owl-pupil"></span></span>
    <span class="owl-beak"></span>
  </a>
</template>
