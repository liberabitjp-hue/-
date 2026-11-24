# -*- coding: utf-8 -*-
"""書き出したxlsmが、ひな型から書き込んだ月シート（と書式）以外変わっていないかを確かめる。

    python3 tools/compare-template.py 出力.xlsm
"""
import os
import sys
import zipfile

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'test-fixtures',
                   'output-template.xlsm')


def main(out):
    a, b = zipfile.ZipFile(SRC), zipfile.ZipFile(out)
    names_a, names_b = set(a.namelist()), set(b.namelist())
    if names_a != names_b:
        print('パートの増減:', sorted(names_a ^ names_b))
        return 1
    changed = [n for n in a.namelist() if a.read(n) != b.read(n)]
    print('ひな型から変わったパート:', changed)
    vba = a.read('xl/vbaProject.bin') == b.read('xl/vbaProject.bin')
    print('VBAマクロ:', '元のまま' if vba else '★変わっている')
    return 0 if vba else 1


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    sys.exit(main(sys.argv[1]))
