import { defineConfig } from "vitepress"

export default defineConfig({
  lang: "zh-CN",
  title: "YUTATA",
  description: "通识 · 产品 · 思考 · 记录",
  head: [
    ["link", { rel: "icon", href: "/favicon.svg" }],
    ["link", { rel: "stylesheet", href: "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css" }],
    ["script", { src: "/lightbox.js" }],
  ],

  themeConfig: {
    logo: "/logo.svg",

    nav: [
      { text: "首页", link: "/" },
      { text: "上升清单", link: "/growth/" },
      { text: "通识积累", link: "/general/" },
      { text: "圣地巡礼", link: "/pilgrimage/" },
      { text: "产品学习", link: "/music-product/" },
      { text: "面试话术", link: "/interview/" },
    ],

    sidebar: {
      "/general/": [
        {
          text: "通识积累",
          items: [
            { text: "概述", link: "/general/" },
            { text: "日本影视剧 · 评级", link: "/general/japanese-dramas" },
            { text: "东京大饭店 · 烹饪技法拆解", link: "/general/grand-maison-tokyo" },
            { text: "音乐鉴赏 · 唱片评价", link: "/general/music-appreciation" },
            { text: "曲库运营 · 多方视角", link: "/general/music-library-ops" },
          ],
        },
      ],
      "/music-product/": [
        {
          text: "三大活动",
          items: [
            { text: "年度报告", link: "/music-product/annual-report" },
            { text: "歌词翻译编辑部", link: "/music-product/lyrics-translation" },
            { text: "AI 歌曲资料补充", link: "/music-product/ai-project" },
          ],
        },
        {
          text: "线下活动",
          items: [
            { text: "云小编茶话会", link: "/music-product/tea-party" },
            { text: "云村用户节", link: "/music-product/cloud-village-festival" },
          ],
        },
        {
          text: "线上交流（用户时期）",
          items: [
            { text: "反馈与回复", link: "/user-period/feedback-reply" },
            { text: "曲库优化方案", link: "/user-period/library-optimization" },
          ],
        },
      ],
      "/user-period/": [
        {
          text: "线上交流（用户时期）",
          items: [
            { text: "概述", link: "/user-period/" },
            { text: "反馈与回复", link: "/user-period/feedback-reply" },
            { text: "曲库优化方案", link: "/user-period/library-optimization" },
          ],
        },
      ],
      "/interview/": [
        {
          text: "面试话术",
          items: [
            { text: "概述", link: "/interview/" },
            { text: "实习准备 · 要点攻略", link: "/interview/internship" },
          ],
        },
        {
          text: "校招面试",
          items: [
            { text: "通用高频问题", link: "/interview/campus/" },
          ],
          collapsed: false,
        },
        {
          text: "校招面试 · 各家记录",
          items: [
            { text: "网易云音乐", link: "/interview/campus/net-ease" },
            { text: "昆仑天工", link: "/interview/campus/kunlun" },
            { text: "东西世界", link: "/interview/campus/dongxi" },
            { text: "荔枝", link: "/interview/campus/lizhi" },
            { text: "橙果视界", link: "/interview/campus/chengguo" },
            { text: "优趣汇", link: "/interview/campus/youquhui" },
          ],
          collapsed: false,
        },
      ],
      "/growth/": [{ text: "上升清单", items: [{ text: "概述", link: "/growth/" }] }],
      "/pilgrimage/": [{ text: "圣地巡礼", items: [{ text: "概述", link: "/pilgrimage/" }] }],
    },

    outline: { level: [2, 3], label: "目录" },
    docFooter: { prev: "←上一篇", next: "下一篇→" },
    darkModeSwitchLabel: "深浅切换",
    sidebarMenuLabel: "菜单",
    returnToTopLabel: "回到顶部",
  },

  markdown: {
    math: true,
  },
})