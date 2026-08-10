<script setup lang="ts">
import { computed, onMounted, watch } from "vue"
import { useRoute } from "vitepress"
import DefaultTheme from "vitepress/theme"
import Owl from "./components/Owl.vue"
import PaletteSwitch from "./components/PaletteSwitch.vue"
import DotNav from "./components/DotNav.vue"
import Feathers from "./components/Feathers.vue"

const route = useRoute()
const isPortalDeploy = import.meta.env.BASE_URL !== "/"

const isArticle = computed(() => {
  const p = route.path
  return p !== "/" && p !== "/404.html" && !p.endsWith("/")
})

function syncBodyClass() {
  const root = document.documentElement
  root.classList.toggle("is-home", route.path === "/")
  root.classList.toggle("is-section", route.path !== "/" && route.path.endsWith("/"))
}

function goPortal() {
  // VitePress client router would hijack <a href="/">; do a full page load instead
  window.location.assign("/")
}

watch(() => route.path, () => syncBodyClass())
onMounted(() => syncBodyClass())
</script>

<template>
  <DefaultTheme.Layout>
    <template #nav-bar-title-after><Owl /></template>
    <template #nav-bar-content-after>
      <a v-if="isPortalDeploy" class="portal-back" href="/" aria-label="返回登录门户" @click.prevent="goPortal">← 返回门户</a>
      <PaletteSwitch />
    </template>
    <template #layout-bottom>
      <div class="bg" aria-hidden="true">
        <div class="bg-wash"></div>
        <div class="bg-glass"></div>
        <div class="bg-light"></div>
        <div class="bg-grain"></div>
      </div>
      <DotNav v-if="isArticle" />
      <Feathers v-if="isArticle" />
    </template>
  </DefaultTheme.Layout>
</template>
