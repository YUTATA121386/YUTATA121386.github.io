<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue"
import { useRoute } from "vitepress"

const route = useRoute()
const items = ref<{ id: string; label: string }[]>([])
const active = ref(-1)
let observer: IntersectionObserver | null = null
let anchors: HTMLElement[] = []

function build() {
  observer?.disconnect()
  observer = null
  items.value = []
  anchors = []
  const doc = document.querySelector(".vp-doc")
  if (!doc) return
  anchors = Array.from(doc.querySelectorAll("h2[id], h3[id]")) as HTMLElement[]
  items.value = anchors
    .map((h) => ({ id: h.id, label: h.textContent?.trim() ?? "" }))
    .filter((it) => it.label.length > 0)
  if (!items.value.length) return
  observer = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        if (en.isIntersecting) {
          const idx = anchors.findIndex((h) => h.id === (en.target as HTMLElement).id)
          if (idx >= 0) active.value = idx
        }
      }
    },
    { rootMargin: "-20% 0px -70% 0px" }
  )
  anchors.forEach((h) => observer!.observe(h))
}

function go(i: number) {
  const h = document.getElementById(items.value[i].id)
  if (h) h.scrollIntoView({ behavior: "smooth" })
}

watch(() => route.path, () => nextTick(build))
onMounted(() => nextTick(build))
onBeforeUnmount(() => observer?.disconnect())
</script>

<template>
  <nav v-if="items.length" class="dot-nav" aria-label="章节导航">
    <a
      v-for="(it, i) in items"
      :key="it.id"
      :class="{ active: active === i }"
      :href="'#' + it.id"
      @click.prevent="go(i)"
    >
      <span class="dot-label">{{ it.label }}</span>
      <span class="dot-dot"></span>
    </a>
  </nav>
</template>
