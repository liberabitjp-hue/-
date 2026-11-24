# -*- coding: utf-8 -*-
"""配置スクリプトの月末の進度（教科ごとの最後の単元・進度）を表示する。
翌月の配置スクリプトの UNITS を、この続きから書き始める。

    python3 tools/progress-end.py tools/november-plan.py

注意: これは「初期案どおりに進んだ」場合の進度。前月の確定版（実際に記入された予定表）を
受け取ったら、そちらの進度を優先する。
"""
import importlib.util
import sys


def main(path):
    spec = importlib.util.spec_from_file_location('plan', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    plan = mod.assign_units(mod.build())
    hours, last_prog, last_any, series = {}, {}, {}, {}
    for k in sorted(plan):
        sub, unit, prog, _ = plan[k]
        hours[sub] = hours.get(sub, 0) + 1
        last_any[sub] = (k, unit, prog)
        if prog:
            last_prog[sub] = (k, unit, prog)
            series.setdefault(sub, {})[unit] = prog
    for sub in last_any:
        (d, p), unit, prog = last_prog.get(sub, last_any[sub])
        note = '' if sub in last_prog else '（進度なし）'
        print('%-4s %2d日%d校時  %s %s%s  （この月%d時間）' % (sub, d, p, unit, prog, note, hours[sub]))
        if sub == '総合' and len(series.get(sub, {})) > 1:
            for u, pr in series[sub].items():
                print('       系列ごと: %s %s' % (u, pr))

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    main(sys.argv[1])
