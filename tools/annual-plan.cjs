// 年間指導計画（annual-plan.xlsx）から、指定した月の単元配当を教科ごとに表示する。
//   node tools/annual-plan.cjs 12            # 12月の配当
//   node tools/annual-plan.cjs 12 算数       # 算数のシートだけ
// A列の月番号が変わるまでの行を、その月の行として扱う。空でないセルを列記号つきで出すので、
// 教科ごとの列の違い（学活は単元名がD列、総合は系列が横に並ぶ等）もそのまま読める。
// 読み方: B列=単元名、D列=単元の計画時数、F列の (n)=その月に配当する時数（残りは翌月の繰越欄）、
//         H列=月計。単元行に (n) が無ければ、その単元はその月に全時数を配当。
'use strict';
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'app', 'node_modules', 'xlsx'));
const FILE = path.join(__dirname, '..', 'app', 'test-fixtures', 'annual-plan.xlsx');

const month = String(process.argv[2] || '');
const only = process.argv[3];
if (!/^\d+$/.test(month)) {
  console.log('使い方: node tools/annual-plan.cjs 月 [教科名の一部]');
  process.exit(2);
}
const wb = XLSX.readFile(FILE);
for (const name of wb.SheetNames) {
  if (only && !name.includes(only)) continue;
  const ws = wb.Sheets[name];
  const range = XLSX.utils.decode_range(ws['!ref']);
  let cur = '';
  const lines = [];
  for (let r = 8; r <= range.e.r; r++) {            // 9行目から（見出しの下）
    const a = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    const m = a ? String(a.v).trim() : '';
    if (/^\d+$/.test(m)) cur = m;
    if (cur !== month) continue;
    const cells = [];
    for (let c = 1; c <= Math.min(range.e.c, 19); c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (!cell) continue;
      const v = String(cell.w != null ? cell.w : cell.v).replace(/\s+/g, ' ').trim();
      if (v) cells.push(`${XLSX.utils.encode_col(c)}:${v}`);
    }
    if (cells.length) lines.push(`  ${r + 1}行 ` + cells.join(' | '));
  }
  if (lines.length) console.log(`== ${name.trim()}\n` + lines.join('\n'));
}
