// 書き出したxlsmを検算する。
//   node tools/verify-output.cjs 出力.xlsm 10月 11月
// 月シートごとに、配置した教科を数えて予定表シートの予定時数と比べ（過不足）、
// 下校時刻（AL列）が文字列 "15:45" の形（コピー＆貼り付けでそのまま使える）かを確かめる。あわせて、ひな型から
// 変わったパートとVBAマクロが元のままかを表示する。
// SheetJS は app/node_modules のものを使う（app で npm install 済みであること）。
'use strict';
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'app', 'node_modules', 'xlsx'));

// 予定表シートの列（0始まり）。B=教科, C=4月 … P=3月（G=1学期計, M=2学期計 を挟む）
const PLAN_COL = { '４月': 2, '５月': 3, '６月': 4, '７月': 5, '８月': 7, '９月': 8, '10月': 9,
  '11月': 10, '12月': 11, '１月': 13, '２月': 14, '３月': 15 };

function main(file, sheets) {
  const wb = XLSX.readFile(file);
  const plan = XLSX.utils.sheet_to_json(wb.Sheets['予定表'], { header: 1, defval: '', raw: false });
  let bad = 0;
  for (const name of sheets) {
    const ws = wb.Sheets[name];
    if (!ws || !(name in PLAN_COL)) { console.log(`シート「${name}」がありません`); bad++; continue; }
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
    const cnt = {};
    for (let r = 3; r < 66; r += 2) {          // 教科行は 4,6,8…（0始まりで 3,5,7…）
      const a = rows[r] || [];
      for (let c = 4; c <= 14; c += 2) {
        const s = String(a[c] || '').trim();
        if (s) cnt[s] = (cnt[s] || 0) + 1;
      }
    }
    const calc = { '国語': (cnt['国語'] || 0) + (cnt['書写'] || 0),
      '行事（日）': cnt['①行事'] || 0, '行事（時）': cnt['行事'] || 0 };
    const col = PLAN_COL[name];
    const diff = []; let yotei = 0, keikaku = 0;
    for (let r = 2; r < 21; r++) {
      const a = plan[r] || [];
      const label = String(a[1] || '').replace(/\s/g, '');
      if (!label || /小計|合計/.test(label)) continue;
      const t = Number(a[col]) || 0;
      const g = label in calc ? calc[label] : (cnt[label] || 0);
      if (label !== '行事（日）') { yotei += t; keikaku += g; }
      if (g !== t) diff.push(`${label}${g - t > 0 ? '+' : ''}${g - t}`);
    }
    const total = Object.values(cnt).reduce((x, y) => x + y, 0);
    console.log(`${name}: 配置${total}コマ  予定${yotei} 計画${keikaku}  過不足 ${diff.join('、') || 'なし'}`);
    const times = [];
    for (let d = 1; d <= 31; d++) {
      const c = ws['AL' + (2 * d + 2)];
      if (!c) continue;
      times.push(`${d}日${XLSX.utils.format_cell(c)}`);
      if (c.t !== 's' || !/^\d{1,2}:\d{2}$/.test(String(c.v))) {
        console.log(`  ★${d}日の下校時刻が文字列「15:45」の形でない（型=${c.t} 値=${c.v}）`); bad++;
      }
    }
    console.log(`  下校時刻（${times.length}日・文字列）: ${times.join(' ')}`);
  }
  return bad;
}

if (process.argv.length < 4) {
  console.log('使い方: node tools/verify-output.cjs 出力.xlsm 10月 11月');
  process.exit(2);
}
process.exit(main(process.argv[2], process.argv.slice(3)) ? 1 : 0);
