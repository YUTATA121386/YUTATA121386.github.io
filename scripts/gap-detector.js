参考日报

<div class="scroll-report-list">

| 日期 | 日报 |
|------|------|
';
  for (const f of rFiles) {
    r += '| ' + f.replace('.md','') + ' | [查看](./' + f + ') |
';
  }
  r += '
</div>

<style>
.scroll-report-list {
  max-height: 400px;
  overflow-y: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 4px 12px;
}
.scroll-report-list table {
  margin: 0;
}
</style>'
  return r;
}

function main() {
  console.log('[YUTATA Gap Detection v1]');
  console.log('Analyzing last ' + LOOKBACK_DAYS + ' days...');

  const radar = analyzeRadarReports();
  console.log('  Read ' + radar.files.length + ' reports');
  const sorted = Object.entries(radar.hits).sort((a, b) => b[1] - a[1]);
  for (const [cat, c] of sorted) {
    if (c > 0) console.log('  ' + cat + ': ' + c + ' hits');
  }

  console.log('');
  console.log('Scanning personal knowledge base...');
  const personal = scanPersonalContent();
  console.log('  Scanned ' + (personal.__all_files || []).length + ' notes');

  console.log('');
  console.log('Generating gap report...');
  const report = generateReport(radar, personal);
  fs.writeFileSync(OUTPUT_FILE, report, 'utf-8');
  console.log('Report saved: ' + path.relative(ROOT_DIR, OUTPUT_FILE));
  const highCount = (report.match(/^### /gm) || []).length;
  console.log('  High priority gaps: ' + highCount);
}

main();
