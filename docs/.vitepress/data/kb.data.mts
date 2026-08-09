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

export default defineLoader({
  watch: [
    "../../daily/*.md",
    "../../logs/*.md",
    "../../weekly/*.md",
    "../../rules/*.md",
    "../../general/*.md",
    "../../music-product/*.md",
    "../../interview/*.md",
  ],
  load(): VolumeStats {
    const dailyDates = mdIn("daily").map((f) => f.replace(/\.md$/, ""))
    const latestDaily = dailyDates.length ? dailyDates[dailyDates.length - 1] : ""

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
        let title = name
        const head = fs.readFileSync(p, "utf-8").slice(0, 400)
        const m = head.match(/^title:\s*(.+)$/m) || head.match(/^#\s+(.+)$/m)
        if (m) title = m[1].trim().replace(/^[^\u4e00-\u9fa5a-zA-Z0-9]+/, "").replace(/[#*`]/g, "").slice(0, 24)
        latestUpdates.push({ title, url: urlBase + name, date: st.mtime.toISOString().slice(0, 10) })
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
