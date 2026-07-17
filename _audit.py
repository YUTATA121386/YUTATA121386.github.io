import re, os
c = open("scripts/multi-agent-daily.js", "r", encoding="utf-8").read()
a = open("scripts/prompts/analyst.md", "r", encoding="utf-8").read()
e = open("scripts/prompts/editor.md", "r", encoding="utf-8").read()

print("=== DIMENSIONS ===")
print("main.js: " + str(len(c)) + " chars, " + str(c.count("\n")) + " lines")

print()
print("=== KEY PROMPT GAPS ===")
if "\u66f2\u5e93\u4eba\u5fc5\u770b" not in e:
    print("  PROMPT: 曲库人必看 section missing from editor prompt")
if "\u51b7\u77e5\u8bc6" not in a:
    print("  PROMPT: 冷知识 section missing from analyst prompt")

print()
print("=== ERROR HANDLING ===")
print("  try-catch: " + str(c.count("try {")) + "/" + str(c.count("catch")))
silent = len(re.findall(r"catch\s*\([^)]*\)\s*\{/\*\s*skip\s", c))
print("  silent catches: " + str(silent))

print()
print("=== DEPLOYMENT ===")
wf_path = ".github/workflows/deploy.yml"
if os.path.exists(wf_path):
    wf = open(wf_path, "r", encoding="utf-8").read()
    print("  Workflow: " + str(len(wf)) + " chars")
    versions = re.findall(r"deploy-pages@v(\d+)", wf)
    print("  deploy-pages: v" + ",".join(versions))

print()
print("=== HARDCODED DATE ===")
if "new Date(2026, 6, 17" in c:
    print("  WARNING: Date hardcoded to 2026-07-17")
