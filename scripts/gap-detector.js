#!/usr/bin/env node

/**
 * YUTATA ?????? v1
 * 
 * ????????????? vs ?????????
 * ?????????????????????
 */

const fs = require("fs");
const path = require("path");

const ROOT_DIR = path.join(__dirname, "..");
const DAILY_DIR = path.join(ROOT_DIR, "docs", "daily");
const SOURCES_FILE = path.join(__dirname, "sources.json");
const OUTPUT_FILE = path.join(ROOT_DIR, "docs", "growth", "knowledge-gap-report.md");
const LOOKBACK_DAYS = 7;
const MIN_GAP_HITS = 2;

const PERSONAL_SECTIONS = [
  "docs/general", "docs/music-product", "docs/user-period",
  "docs/interview", "docs/interview/campus",
  "docs/pilgrimage", "docs/growth",
];

// ===== ???? =====
const CONFIG = JSON.parse(fs.readFileSync(SOURCES_FILE, "utf-8"));
const KEYWORDS = CONFIG.keywords;
const CATEGORY_NAMES = Object.keys(KEYWORDS);

// ===== ??????? =====
function scanPersonalContent() {
  const coverage = {};
  for (const cat of CATEGORY_NAMES) {
    coverage[cat] = { files: [], hitCount: 0 };
  }
  coverage["__all_files"] = [];

  for (const section of PERSONAL_SECTIONS) {
    const dirPath = path.join(ROOT_DIR, section);
    let files;
    try {
      files = fs.readdirSync(dirPath).filter(f => f.endsWith(".md"));
    } catch { continue; }

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const content = fs.readFileSync(filePath, "utf-8").toLowerCase();
      const relPath = section + "/" + file;
      coverage["__all_files"].push(relPath);
      for (const [cat, keywords] of Object.entries(KEYWORDS)) {
        const lowerKws = keywords.map(k => k.toLowerCase());
        const matched = lowerKws.filter(kw => content.includes(kw));
        if (matched.length > 0) {
          coverage[cat].files.push({ file: relPath, matched: matched.length });
        }
      }
    }
  }

  for (const cat of CATEGORY_NAMES) {
    const seen = new Set();
    coverage[cat].files = coverage[cat].files
      .filter(f => !f.file.endsWith("/index.md"))
      .filter(f => { if (seen.has(f.file)) return false; seen.add(f.file); return true; });
    coverage[cat].hitCount = coverage[cat].files.length;
  }
  return coverage;
}

// ===== ???????? =====
function analyzeRadarReports() {
  const hits = {};
  for (const cat of CATEGORY_NAMES) hits[cat] = 0;

  let files;
  try {
    files = fs.readdirSync(DAILY_DIR)
      .filter(f => f.endsWith(".md") && f !== "index.md" && f !== "keywords.md")
      .filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort().reverse().slice(0, LOOKBACK_DAYS);
  } catch { return { hits, files: [] }; }

  for (const file of files) {
    const content = fs.readFileSync(path.join(DAILY_DIR, file), "utf-8").toLowerCase();
    for (const [cat, keywords] of Object.entries(KEYWORDS)) {
      const lowerKws = keywords.map(k => k.toLowerCase());
      const matched = lowerKws.filter(kw => content.includes(kw));
      if (matched.length > 0) hits[cat] += matched.length;
    }
  }
  return { hits, files };
}

// ===== ???? =====
function getAdvice(cat) {
  const m = {
    "????": "?????/???/??????????????????????",
    "????DDEX": "????????????? DDEX ??????????????",
    "ISRC/UPC": "??????????????????????????",
    "????": "?????????????AI???????????????",
    "????": "Spotify/Apple Music/???????????????",
    "AI??": "AI?????????????????????????????",
    "????": "????????????????????????????",
    "????": "?????????????"????18????"?????",
    "??????": "TME vs ??? vs ????????????",
    "?????": "?????????????????CTF?????",
  };
  return m[cat] || "???????????????????????";
}

function generateReport(radar, personal) {
  const radarFiles = radar.files;
  const radarHits = radar.hits;
  const gaps = [];

  for (const cat of CATEGORY_NAMES) {
    const rc = radarHits[cat];
    const pc = personal[cat].hitCount;
    const pf = personal[cat].files.map(f => f.file);
    const score = rc * (pc === 0 ? 3 : pc === 1 ? 2 : pc <= 2 ? 1 : 0);
    gaps.push({ category: cat, radarCount: rc, personalCount: pc, personalFiles: pf, gapScore: score });
  }
  gaps.sort((a, b) => b.gapScore - a.gapScore);

  const highP = gaps.filter(g => g.gapScore >= 6);
  const midP = gaps.filter(g => g.gapScore >= 2 && g.gapScore < 6 && g.radarCount >= MIN_GAP_HITS);
  const good = gaps.filter(g => g.personalCount >= 2 && g.radarCount > 0);

  const table = gaps.map(g => {
    const s = g.personalCount >= 2 ? "?" : g.personalCount >= 1 ? "?\u{fe0f}" : "??";
    const files = g.personalFiles.length > 0
      ? g.personalFiles.map(f => "`" + f + "`").join(" ")
      : "?";
    return "| " + s + " | **" + g.category + "** | " + g.radarCount + " | " + g.personalCount + " | " + files + " |";
  }).join("\n");

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const dateRange = radarFiles.length > 0
    ? radarFiles[radarFiles.length - 1].replace(".md", "") + " ~ " + radarFiles[0].replace(".md", "")
    : "??????";

  const totalKws = Object.values(KEYWORDS).flat().length;

  let r = "---\ntitle: ??????\noutline: [2, 3]\n---\n\n";
  r += "# ?? ??????\n\n";
  r += "> ????: " + dateStr + "\n";
  r += "> ????: " + dateRange + "?? " + radarFiles.length + " ??????\n";
  r += "> ????: " + CATEGORY_NAMES.length + " ? | " + totalKws + " ????\n";
  r += "> " + personal["__all_files"].length + " ???????????\n\n---\n\n";

  r += "## ?? ??????\n\n";
  if (highP.length === 0) {
    r += "?? ???????????????????\n\n";
  } else {
    r += "> ?????????????????**??????**?\n\n";
    for (const g of highP) {
      r += "### " + g.category + "\n";
      r += "- ?? **" + g.radarCount + "** ???" + LOOKBACK_DAYS + "??\n";
      r += "- ????: ? ?\n";
      r += "- ??: " + getAdvice(g.category) + "\n\n";
    }
  }

  r += "---\n\n## ?? ?????\n\n";
  if (midP.length === 0) {
    r += "???\n\n";
  } else {
    for (const g of midP) {
      r += "- **" + g.category + "** ? ?? " + g.radarCount + " ???? " + g.personalCount + " ?";
      if (g.personalFiles.length > 0) {
        r += "???: " + g.personalFiles.map(f => "`" + f + "`").join("?") + "?";
      }
      r += "\n";
    }
    r += "\n";
  }

  r += "---\n\n## ? ????\n\n";
  const goodF = good.filter(g => g.radarCount >= MIN_GAP_HITS);
  if (goodF.length === 0) r += "???\n\n";
  else {
    for (const g of goodF) {
      r += "- **" + g.category + "** ? ?? " + g.radarCount + " ? ? ?? " + g.personalCount + " ?\n";
    }
    r += "\n";
  }

  r += "---\n\n## ?? ??????\n\n";
  r += "| ?? | ?? | ???? | ???? | ???? |\n";
  r += "|------|------|---------|---------|---------|\n";
  r += table + "\n\n";
  r += "## ?? ????\n\n| ?? | ?? |\n|------|------|\n";
  for (const f of radarFiles) {
    r += "| " + f.replace(".md", "") + " | [?? ??](./" + f + ") |\n";
  }
  r += "\n> ?? **??**: ???????"???????????"?????????????????\n";
  r += "> ?? ???????? `scripts/gap-detector.js` ???\n";
  return r;
}

// ===== ??? =====
function main() {
  console.log("?? YUTATA ?????? v1");
  console.log("=================================");

  console.log("\\u{1f50d} ??? " + LOOKBACK_DAYS + " ??????...");
  const radar = analyzeRadarReports();
  console.log("   ?? " + radar.files.length + " ???");
  for (const [cat, c] of Object.entries(radar.hits).sort((a, b) => b[1] - a[1])) {
    if (c > 0) console.log("   " + cat + ": " + c + " ???");
  }

  console.log("\\n\\u{1f4d6} ???????...");
  const personal = scanPersonalContent();
  console.log("   ?? " + personal["__all_files"].length + " ???");
  for (const [cat, info] of Object.entries(personal)) {
    if (cat === "__all_files") continue;
    if (info.hitCount > 0) console.log("   " + cat + ": " + info.hitCount + " ?");
  }

  console.log("\\n\\u{1f4c4} ??????...");
  const report = generateReport(radar, personal);
  fs.writeFileSync(OUTPUT_FILE, report, "utf-8");
  console.log("\\u2705 ?????: " + path.relative(ROOT_DIR, OUTPUT_FILE));
  const highCount = (report.match(/^### /gm) || []).length;
  console.log("   ??????: " + highCount + " ?");
}

main();
