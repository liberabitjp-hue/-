# -*- coding: utf-8 -*-
"""月ごとの配置スクリプトが組んだ初期案を output-template.xlsm の各月シートへ書き込む。

    python3 tools/write-plan.py 出力先.xlsm tools/october-plan.py:10月 tools/november-plan.py:11月

シートXMLを直接書き換えるため、セル書式・数式・他シート・VBAマクロは一切変更しない
（SheetJSでの書き出しはセル書式を落とすため使わない）。予定表シートも変更しない。
進度は t="str" の文字列として書き込む（Excelが日付へ誤変換しないようにするため）。
下校時刻は配置スクリプトの DISMISSAL を、右側の別表のAL列「下校時刻」へ時刻の数値で書き込む。
"""
import importlib.util
import os
import re
import sys
import zipfile

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'test-fixtures',
                   'output-template.xlsm')
SUBJECT_COLS = ['E', 'G', 'I', 'K', 'M', 'O']
PROGRESS_COLS = ['F', 'H', 'J', 'L', 'N', 'P']
NOTE_COL = 'Q'
DISMISSAL_COL = 'AL'     # 右側の別表「下校時刻」。9月までと同じく時刻の数値（1日=1）で入れる
MANAGED = set(SUBJECT_COLS + PROGRESS_COLS + [NOTE_COL, DISMISSAL_COL])
COL_ORDER = ['E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', DISMISSAL_COL]


def load_plan(path):
    spec = importlib.util.spec_from_file_location(os.path.basename(path).replace('-', '_'), path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def sheet_part(blobs, sheet_name):
    """シート名から xl/worksheets/sheetN.xml を引く。"""
    wb = blobs['xl/workbook.xml'].decode('utf-8')
    rels = blobs['xl/_rels/workbook.xml.rels'].decode('utf-8')
    m = re.search(r'<sheet name="%s"[^>]*r:id="(rId\d+)"' % re.escape(sheet_name), wb)
    if not m:
        raise SystemExit('シート「%s」がありません' % sheet_name)
    rel = re.search(r'<Relationship\b[^>]*\bId="%s"[^>]*>' % m.group(1), rels).group(0)
    return 'xl/' + re.search(r'Target="([^"]+)"', rel).group(1).lstrip('/').replace('xl/', '', 1)


def esc(s):
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')


TIME_STYLE = None   # 時刻書式（h:mm）の cellXfs 番号。main() で決める


def ensure_time_style(styles_xml):
    """styles.xml に h:mm 書式の cellXfs が無ければ追加し、(新しいXML, 番号) を返す。

    サンプルのブックは書式が落ちていて cellXfs が1つしか無いため、時刻の数値が
    小数で表示されてしまう。既存の書式には手を付けず、末尾に1つ足すだけにする。
    """
    fmt = re.search(r'<numFmt numFmtId="(\d+)" formatCode="h:mm[^"]*"/>', styles_xml)
    if fmt:
        fmt_id = fmt.group(1)
    else:
        fmt_id = '177'
        if '<numFmts' in styles_xml:
            styles_xml = re.sub(r'<numFmts count="(\d+)">',
                                lambda m: '<numFmts count="%d">' % (int(m.group(1)) + 1),
                                styles_xml, 1)
            styles_xml = styles_xml.replace(
                '</numFmts>', '<numFmt numFmtId="177" formatCode="h:mm"/></numFmts>', 1)
        else:
            styles_xml = styles_xml.replace(
                '<fonts', '<numFmts count="1"><numFmt numFmtId="177" formatCode="h:mm"/></numFmts><fonts', 1)
    block = re.search(r'<cellXfs count="(\d+)">(.*?)</cellXfs>', styles_xml, re.S)
    xfs = re.findall(r'<xf\b[^>]*?(?:/>|>.*?</xf>)', block.group(2), re.S)
    for i, xf in enumerate(xfs):
        if 'numFmtId="%s"' % fmt_id in xf:
            return styles_xml, i
    new_xf = '<xf numFmtId="%s" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' % fmt_id
    new_block = '<cellXfs count="%d">%s%s</cellXfs>' % (len(xfs) + 1, block.group(2), new_xf)
    return styles_xml[:block.start()] + new_block + styles_xml[block.end():], len(xfs)


def cell_xml(col, row, value):
    if isinstance(value, float):
        style = ' s="%d"' % TIME_STYLE if TIME_STYLE else ''
        return '<c r="%s%d"%s><v>%r</v></c>' % (col, row, style, value)
    return '<c r="%s%d" t="str"><v>%s</v></c>' % (col, row, esc(value))


def time_value(hhmm):
    h, m = hhmm.split(':')
    return (int(h) * 60 + int(m)) / 1440.0


def col_of(cell):
    return re.search(r'r="([A-Z]+)\d+"', cell).group(1)


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
    kept = [c for c in cells if col_of(c) not in MANAGED]
    new = [cell_xml(c, row_no, values[c]) for c in COL_ORDER if values.get(c) not in (None, '')]
    allc = sorted(kept + new, key=lambda c: col_num(col_of(c)))
    return open_tag + ''.join(allc) + close_tag


def build_values(plan_mod):
    """行番号 -> {列: 文字列}。日 d の教科行は 2d+2、単元行は 2d+3。"""
    plan = plan_mod.assign_units(plan_mod.build())
    periods = {d: p for d, _, p in plan_mod.DAYS}
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
        if plan_mod.NOTES.get(day):
            rows[sub_row][NOTE_COL] = plan_mod.NOTES[day]
        dismissal = getattr(plan_mod, 'DISMISSAL', {}).get(day)
        if dismissal:
            rows[sub_row][DISMISSAL_COL] = time_value(dismissal)
    missing = sorted(set(periods) - set(getattr(plan_mod, 'DISMISSAL', {})))
    if hasattr(plan_mod, 'DISMISSAL') and missing:
        raise SystemExit('下校時刻が無い授業日があります: %s' % missing)
    return rows


def write_sheet(xml, rows):
    """月シートのXMLへ rows を書き込み、(新しいXML, 更新行数) を返す。"""
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
    for row_no in sorted(r for r, v in rows.items() if v and r not in present):
        body = ''.join(cell_xml(c, row_no, rows[row_no][c])
                       for c in COL_ORDER if rows[row_no].get(c) not in (None, ''))
        block = '<row r="%d">%s</row>' % (row_no, body)
        after = [r for r in sorted(present) if r > row_no]
        if after:
            anchor = re.search(r'<row r="%d"[ >]' % after[0], xml)
            xml = xml[:anchor.start()] + block + xml[anchor.start():]
        else:
            xml = xml.replace('</sheetData>', block + '</sheetData>')
        present.add(row_no)
        touched += 1

    needed = {r for r, v in rows.items() if v}
    if not needed <= present:
        raise SystemExit('書き換えきれなかった行があります: %s' % sorted(needed - present))
    return xml, touched


def main(dest, specs):
    global TIME_STYLE
    with zipfile.ZipFile(SRC) as zin:
        names = zin.namelist()
        blobs = {n: zin.read(n) for n in names}
        infos = {n: zin.getinfo(n) for n in names}

    styles, TIME_STYLE = ensure_time_style(blobs['xl/styles.xml'].decode('utf-8'))
    blobs['xl/styles.xml'] = styles.encode('utf-8')

    for spec in specs:
        script, sheet_name = spec.rsplit(':', 1)
        part = sheet_part(blobs, sheet_name)
        xml, touched = write_sheet(blobs[part].decode('utf-8'), build_values(load_plan(script)))
        blobs[part] = xml.encode('utf-8')
        print('「%s」(%s) に書き込みました（%d行）' % (sheet_name, part, touched))

    with zipfile.ZipFile(dest, 'w', zipfile.ZIP_DEFLATED) as zout:
        for n in names:
            zi = zipfile.ZipInfo(n, date_time=infos[n].date_time)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = infos[n].external_attr
            zout.writestr(zi, blobs[n])
    print('書き出しました: %s' % dest)


if __name__ == '__main__':
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2:])
