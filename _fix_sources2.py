import json
with open("scripts/sources.json", "r", encoding="utf-8") as f:
    sources = json.load(f)
new_source = {"name": "少数派", "url": "https://sspai.com/feed", "lang": "zh", "weight": 4}
existing = {s["name"] for s in sources["sources"]}
if new_source["name"] not in existing:
    sources["sources"].append(new_source)
for s in sources["sources"]:
    if s["name"] == "音乐财经":
        s["weight"] = 0  # disable (weight 0 = skip)
with open("scripts/sources.json", "w", encoding="utf-8") as f:
    json.dump(sources, f, ensure_ascii=False, indent=2)
print("Added 少数派, disabled 音乐财经")
cnt = sum(1 for s in sources["sources"] if s["weight"] > 0)
print("Active sources: " + str(cnt))
