import { defineLoader } from "vitepress"
import fs from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"

export interface VolumeStats {
  dailyCount: number
  logCount: number
  weeklyCount: number
  ruleCount: number
  generalCount: number
  musicCount: number
  interviewCount: number
  totalPages: number
  dailyDates: string[]
  dailyPreview: Record<string, string[]>
  latestUpdates: { title: string; url: string; date: string }[]
  latestDaily: string
}

const DOCS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")

function mdIn(dir: string): string[] {
  const full = path.join(DOCS, dir)
  if (!fs.existsSync(full)) return []
  return fs
    .readdirSync(full)
    .filter((f) => f.endsWith(".md") && f !== "index.md")
    .sort()
}

function countMd(dir: string): number {
  return mdIn(dir).length
}

function walkMd(dir: string): number {
  const full = path.join(DOCS, dir)
  if (!fs.existsSync(full)) return 0
  let n = 0
  for (const f of fs.readdirSync(full)) {
    const p = path.join(full, f)
    const st = fs.statSync(p)
    if (st.isDirectory()) n += walkMd(path.join(dir, f))
    else if (f.endsWith(".md")) n++
  }
  return n
}

function headingsOf(file: string, max: number): string[] {
  const text = fs.readFileSync(file, "utf-8")
  const out: string[] = []
  for (const m of text.matchAll(/^#{2,3}\s+(.+)$/gm)) {
    const t = m[1].trim().replace(/^[#*`\s]+/, "").replace(/[#*`]/g, "").trim()
    if (t && t.length > 2) {
      out.push(t.length > 22 ? t.slice(0, 22) + "…" : t)
      if (out.length >= max) break
    }
  }
  return out
}

const TITLE_OVERRIDES: Record<string, string> = {
  "rules/verification-rules": "核查规则",
  "rules/collection-rules": "采集规则",
  "rules/style-guide": "排版规范",
  "rules/communication-rules": "通信规则",
  "rules/quality_standards": "质量标准",
  "rules/credit_score_system": "信誉分规则",
  "rules/CHANGELOG": "规则变更日志",
  "daily/keywords": "关键词覆盖",
  "daily/knowledge-gap-report": "知识缺口报告",
}

function titleOf(dir: string, name: string, file: string): string {
  const override = TITLE_OVERRIDES[dir + "/" + name]
  if (override) return override
  const text = fs.readFileSync(file, "utf-8")
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  let title = ""
  if (fm) {
    const m = fm[1].match(/^title:\s*(.+)$/m)
    if (m) title = m[1].trim().replace(/^['"]|['"]$/g, "")
  }
  const hasCJK = /[\u4e00-\u9fa5]/.test(title)
  const isSlug = /^[a-z0-9_\-]+$/i.test(title)
  if (!title || (!hasCJK && isSlug)) {
    const h1 = text.match(/^#\s+(.+)$/m)
    const h2 = text.match(/^##\s+(.+)$/m)
    const h = (h1 || h2)?.[1]
    if (h) title = h
  }
  title = title.replace(/[#*`]/g, "").replace(/^[\s\-—|:：·>]+/, "").trim()
  return title.slice(0, 28) || name
}

function dateOf(dir: string, name: string, file: string): string {
  if (dir === "daily" && /^\d{4}-\d{2}-\d{2}$/.test(name)) return name
  const head = fs.readFileSync(file, "utf-8").slice(0, 400)
  const m = head.match(/^(?:updated|date):\s*(\d{4}-\d{2}-\d{2})/m)
  if (m) return m[1]
  return fs.statSync(file).mtime.toISOString().slice(0, 10)
}

export default defineLoader({
  watch: [
    "../../daily/*.md",
    "../../logs/*.md",
    "../../weekly/*.md",
    "../../rules/*.md",
    "../../general/*.md",
    "../../music-product/*.md",
    "../../interview/*.md",
    "../../growth/*.md",
    "../../pilgrimage/*.md",
    "../../user-period/*.md",
  ],
  load(): VolumeStats {
    const dailyDates = mdIn("daily").map((f) => f.replace(/\.md$/, ""))
    const latestDaily = dailyDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).pop() || ""

    const dailyPreview: Record<string, string[]> = {}
    for (const d of dailyDates) {
      dailyPreview[d] = headingsOf(path.join(DOCS, "daily", d + ".md"), 4)
    }

    const sections: [string, string][] = [
      ["daily", "daily/"],
      ["logs", "logs/"],
      ["weekly", "weekly/"],
      ["rules", "rules/"],
      ["general", "general/"],
      ["music-product", "music-product/"],
      ["interview", "interview/"],
      ["growth", "growth/"],
      ["pilgrimage", "pilgrimage/"],
      ["user-period", "user-period/"],
    ]
    const latestUpdates: { title: string; url: string; date: string }[] = []
    for (const [dir, urlBase] of sections) {
      const full = path.join(DOCS, dir)
      if (!fs.existsSync(full)) continue
      for (const f of fs.readdirSync(full)) {
        if (!f.endsWith(".md") || f === "index.md") continue
        const p = path.join(full, f)
        const st = fs.statSync(p)
        const name = f.replace(/\.md$/, "")
        const title = titleOf(dir, name, p)
        const date = dateOf(dir, name, p)
        latestUpdates.push({ title, url: urlBase + name + ".html", date })
      }
    }
    latestUpdates.sort((a, b) => (a.date < b.date ? 1 : -1))
    const top = latestUpdates.slice(0, 5)

    return {
      dailyCount: dailyDates.length,
      logCount: countMd("logs"),
      weeklyCount: countMd("weekly"),
      ruleCount: countMd("rules"),
      generalCount: countMd("general"),
      musicCount: countMd("music-product"),
      interviewCount: countMd("interview"),
      totalPages: walkMd(".") - walkMd(".vitepress"),
      dailyDates,
      dailyPreview,
      latestUpdates: top,
      latestDaily,
    }
  },
})
