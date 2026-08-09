<script setup lang="ts">
import { withBase } from "vitepress"

defineProps<{
  vol: string
  en: string
  title: string
  desc: string
  badge?: string
  live?: boolean
}>()
</script>

<template>
  <div class="vol-hero">
    <a class="back-link" :href="withBase('/')">← 返回首页</a>
    <header class="landing-hero">
      <span class="landing-vol">{{ vol }}</span>
      <h2 class="landing-title">{{ title }}</h2>
      <p class="landing-en">{{ en }}</p>
      <p class="landing-desc">{{ desc }}</p>
      <span v-if="badge" :class="['landing-badge', { live }]">{{ badge }}</span>
    </header>
  </div>
</template>
