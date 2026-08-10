<script setup lang="ts">
import { withBase } from "vitepress"
</script>

<template>
  <a class="owl" :href="withBase('/')" aria-label="拾光声学档案 · 返回首页">
    <img class="owl-img" src="../art/owl.jpg" alt="" aria-hidden="true" decoding="async" />
    <span class="owl-halo" aria-hidden="true"></span>
  </a>
</template>

<style scoped>
.owl {
  --gold: #d4a020;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
  border-radius: 50%;
  text-decoration: none;
  -webkit-tap-highlight-color: transparent;
}
.owl:focus-visible { outline: 2px solid var(--gold); outline-offset: 3px; }
.owl-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  box-shadow: 0 4px 10px -4px rgba(0, 0, 0, .35), inset 0 0 0 1px rgba(255, 255, 255, .35);
  transition: transform .25s cubic-bezier(.34, 1.56, .64, 1);
}
.owl-halo {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--gold) 55%, transparent);
  pointer-events: none;
  opacity: .7;
}
.owl:hover .owl-img { transform: translateY(-2px) rotate(-4deg) scale(1.04); }
.owl:active .owl-img { transform: scale(.95); }
[data-palette="night"] .owl-img {
  box-shadow: 0 4px 12px -4px rgba(0, 0, 0, .6), inset 0 0 0 1px rgba(255, 255, 255, .25), 0 0 12px rgba(212, 160, 32, .35);
}
[data-palette="night"] .owl-halo { animation: owl-glow 3.2s ease-in-out infinite; }
@keyframes owl-glow {
  0%, 100% { opacity: .5; box-shadow: 0 0 4px rgba(212, 160, 32, .5), inset 0 0 0 1px rgba(212, 160, 32, .4); }
  50% { opacity: 1; box-shadow: 0 0 10px rgba(212, 160, 32, .9), inset 0 0 0 1px rgba(212, 160, 32, .6); }
}
@media (prefers-reduced-motion: reduce) {
  .owl-img { transition: none; }
  [data-palette="night"] .owl-halo { animation: none; }
}
</style>
