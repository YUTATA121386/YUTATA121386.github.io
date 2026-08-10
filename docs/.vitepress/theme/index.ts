import DefaultTheme from "vitepress/theme"
import Layout from "./Layout.vue"
import RecordPlayer from "./components/RecordPlayer.vue"
import HomeBento from "./components/HomeBento.vue"
import SectionHero from "./components/SectionHero.vue"
import RadarDashboard from "./components/RadarDashboard.vue"
import ScrollFx from "./components/ScrollFx.vue"
import "./style.css"

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component("RecordPlayer", RecordPlayer)
    app.component("HomeBento", HomeBento)
    app.component("SectionHero", SectionHero)
    app.component("RadarDashboard", RadarDashboard)
    app.component("ScrollFx", ScrollFx)
  },
}
