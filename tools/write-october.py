# -*- coding: utf-8 -*-
"""october-plan.py が組んだ10月の初期案を output-template.xlsm の「10月」シートへ書き込む。

シートXMLを直接書き換えるため、セル書式・数式・他シート・VBAマクロは一切変更しない。
進度は t="str" の文字列として書き込む（Excelが日付へ誤変換しないようにするため）。
"""
import os
import re
import shutil
import sys
import zipfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from importlib import import_module
op = import_module('october-plan'.replace('-', '_')) if False else None

import importlib.util
spec = importlib.util.spec_from_file_location(
    'october_plan', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'october-plan.py'))
op = importlib.util.module_from_spec(spec)
spec.loader.exec_module(op)

SRC = '/home/user/-/app/test-fixtures/output-template.xlsm'
SHEET = 'xl/worksheets/sheet7.xml'    # 「10月」
PLAN_SHEET = 'xl/worksheets/sheet13.xml'  # 「予定表」

# 授業時数･下校予定時刻（9/17版）で10/5の上学年に6校時（児童会活動日＝委員会活動）が
# 追加され、5学年の実施できる時数が113→114になった。予定表の10月「児童会」は
# 追加前の1のままなので、これを2に直す。ここを直さないと過不足欄に+1が残る。
# （J17は数式ではなく値。学期計・合計はすべて数式なのでExcel側で自動的に追従する）
PLAN_FIXES = {'J17': (1, 2)}
SUBJECT_COLS = ['E', 'G', 'I', 'K', 'M', 'O']
PROGRESS_COLS = ['F', 'H', 'J', 'L', 'N', 'P']
NOTE_COL = 'Q'
MANAGED = set(SUBJECT_COLS + PROGRESS_COLS + [NOTE_COL])
COL_ORDER = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q']


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


def cell_xml(col, row, text):
    return '<c r="%s%d" t="str"><v>%s</v></c>' % (col, row, esc(text))


def col_of(ref):
    return re.match(r'([A-Z]+)', ref).group(1)


def col_num(c):
    n = 0
    for ch in c:
        n = n * 26 + (ord(ch) - 64)
    return n


def rewrite_row(row_xml, row_no, values):
    """row_xml の E..Q 列を values ({列: 文字列}) で置き換える。"""
    m = re.match(r'(<row\b[^>]*>)(.*)(</row>)$', row_xml, re.S)
    if not m:                              # <row .../> の自己終了形
        m2 = re.match(r'<row\b([^>]*)/>$', row_xml, re.S)
        if not m2 or not values:
            return row_xml
        open_tag, body, close_tag = '<row%s>' % m2.group(1), '', '</row>'
    else:
        open_tag, body, close_tag = m.group(1), m.group(2), m.group(3)

    cells = re.findall(r'<c\b[^>]*?(?:/>|>.*?</c>)', body, re.S)
    kept = [c for c in cells
            if col_of(re.search(r'r="([A-Z]+\d+)"', c).group(1)) not in MANAGED]
    new = [cell_xml(c, row_no, values[c]) for c in COL_ORDER if values.get(c)]
    allc = kept + new
    allc.sort(key=lambda c: col_num(col_of(re.search(r'r="([A-Z]+\d+)"', c).group(1))))
    return open_tag + ''.join(allc) + close_tag


def build_values():
    """行番号 -> {列: 文字列}"""
    plan = op.assign_units(op.build())
    periods = {d: p for d, _, p in op.DAYS}
    rows = {}
    for day in range(1, 32):
        sub_row, unit_row = 2 * day + 2, 2 * day + 3
        rows[sub_row], rows[unit_row] = {}, {}
        if day not in periods:
            continue
        for p in range(1, periods[day] + 1):
            sub, unit, prog, _ = plan[(day, p)]
            rows[sub_row][SUBJECT_COLS[p - 1]] = sub
            if prog:
                rows[sub_row][PROGRESS_COLS[p - 1]] = prog
            if unit:
                rows[unit_row][SUBJECT_COLS[p - 1]] = unit
        if op.NOTES.get(day):
            rows[sub_row][NOTE_COL] = op.NOTES[day]
    return rows


def main(dest):
    rows = build_values()
    with zipfile.ZipFile(SRC) as zin:
        names = zin.namelist()
        blobs = {n: zin.read(n) for n in names}
        infos = {n: zin.getinfo(n) for n in names}

    xml = blobs[SHEET].decode('utf-8')
    touched = 0

    def repl(m):
        nonlocal touched
        row_no = int(re.search(r'r="(\d+)"', m.group(0)).group(1))
        if row_no not in rows:
            return m.group(0)
        touched += 1
        return rewrite_row(m.group(0), row_no, rows[row_no])

    xml = re.sub(r'<row\b[^>]*?(?:/>|>.*?</row>)', repl, xml, flags=re.S)

    # 元のシートに存在しない行（休日・空行）は、必要なものだけ順序を守って挿入する
    present = {int(m) for m in re.findall(r'<row r="(\d+)"', xml)}
    missing = sorted(r for r, v in rows.items() if v and r not in present)
    for row_no in missing:
        body = ''.join(cell_xml(c, row_no, rows[row_no][c])
                       for c in COL_ORDER if rows[row_no].get(c))
        block = '<row r="%d">%s</row>' % (row_no, body)
        after = [r for r in sorted(present) if r > row_no]
        if after:
            anchor = re.search(r'<row r="%d"[ >]' % after[0], xml)
            xml = xml[:anchor.start()] + block + xml[anchor.start():]
        else:
            xml = xml.replace('</sheetData>', block + '</sheetData>')
        present.add(row_no)
        touched += 1

    expected = sum(1 for v in rows.values() if v)
    written = len({r for r, v in rows.items() if v})
    if touched < written:
        raise SystemExit('書き換えきれなかった行があります（%d/%d）' % (touched, written))
    blobs[SHEET] = xml.encode('utf-8')

    plan_xml = blobs[PLAN_SHEET].decode('utf-8')
    for ref, (before, after) in PLAN_FIXES.items():
        old = '<c r="%s"><v>%d</v></c>' % (ref, before)
        new = '<c r="%s"><v>%d</v></c>' % (ref, after)
        if old not in plan_xml:
            raise SystemExit('予定表!%s が想定の値(%d)ではありません' % (ref, before))
        plan_xml = plan_xml.replace(old, new, 1)
        print('予定表!%s を %d → %d に直しました' % (ref, before, after))
    blobs[PLAN_SHEET] = plan_xml.encode('utf-8')

    with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            zi = zipfile.ZipInfo(n, date_time=infos[n].date_time)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = infos[n].external_attr
            zout.writestr(zi, blobs[n])
    print('書き出しました: %s（%d行を更新）' % (dest, touched))


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else '/home/user/-/月学習予定表_令和8年10月_5年2組.xlsm')
