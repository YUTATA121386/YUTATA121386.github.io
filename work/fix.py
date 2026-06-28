path = r"C:\Users\beppi\Documents\Codex\YUTATA121386.github.io\scripts\multi-agent-daily.js"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Find the updateDailyIndex function
func_start = content.find("function updateDailyIndex")
func_end = content.find("\nfunction ", func_start + 10)
if func_end == -1:
    func_end = content.find("\n// ===", func_start + 10)
if func_end == -1:
    func_end = content.find("\nmain()", func_start + 10)

print(f"updateDailyIndex: {func_start} to {func_end}")

new_func = """function updateDailyIndex(dateStr) {
  var indexPath = path.join(OUTPUT_DIR, "index.md");
  var content;
  try { content = fs.readFileSync(indexPath, "utf-8"); } catch (e) { return; }

  // Insert new entry in the scroll-list div
  var marker = '<div class="scroll-list">';
  var insertPos = content.indexOf(marker);
  if (insertPos > 0) {
    var lineStart = content.indexOf("\\n", insertPos) + 1;
    var newEntry = "- [" + dateStr + "](./" + dateStr + ".md) — [📝 过程日志](../logs/" + dateStr + ".md)\\n";
    content = content.substring(0, lineStart) + newEntry + content.substring(lineStart);
    fs.writeFileSync(indexPath, content, "utf-8");
  }
}"""

content = content[:func_start] + new_func + content[func_end:]

with open(path, "w", encoding="utf-8", newline="") as f:
    f.write(content)
print("Done")
