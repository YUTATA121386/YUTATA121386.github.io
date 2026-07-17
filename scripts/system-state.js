/**
 * 系统状态持久化模块
 * 管理运行统计、系统记忆的读写
 */

const fs = require("fs");
const path = require("path");
const { ROOT_DIR } = require("./agents/shared");

const SYSTEM_STATS_FILE = ROOT_DIR + "/scripts/system-stats.json";
const SYSTEM_MEMORY_FILE = ROOT_DIR + "/scripts/system-memory.json";

function loadSystemStats() {
  try { return JSON.parse(fs.readFileSync(SYSTEM_STATS_FILE, "utf-8")); }
  catch { return { totalRuns: 0, firstRunDate: null, lastRunDate: null }; }
}

function saveSystemStats(stats) {
  fs.writeFileSync(SYSTEM_STATS_FILE, JSON.stringify(stats, null, 2), "utf-8");
}

function loadSystemMemory() {
  try { return JSON.parse(fs.readFileSync(SYSTEM_MEMORY_FILE, "utf-8")); }
  catch { return { entries: [] }; }
}

function saveSystemMemory(mem) {
  if (mem.entries.length > 30) mem.entries = mem.entries.slice(-30);
  fs.writeFileSync(SYSTEM_MEMORY_FILE, JSON.stringify(mem, null, 2), "utf-8");
}

module.exports = { loadSystemStats, saveSystemStats, loadSystemMemory, saveSystemMemory };
