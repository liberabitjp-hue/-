# -*- coding: utf-8 -*-
"""2組の配置を、5年1組の学習予定表（書き起こし）と1コマずつ突き合わせる。

    python3 tools/check-class1.py tools/november-plan.py tools/data/class1-11月.txt

点検すること:
  - 紫色のセル（* 付き）と行事が、2組でも同じ教科になっているか
  - 分科（理科・書写・外国語）が1組と同じ時間に重なっていないか（学年合同の * 枠は除く）
  - 音楽室・家庭科室が重なっていないか
  - 2組の家庭科は1組担任が受け持つので、1組が図工・外国語・理科・書写（または未定 ?）の時間か
  - 1組の図工は2組担任が受け持つので、その時間の2組は家庭か分科か
あわせて、書き起こした1組の表の時数を表示する。1組の集計欄と一致すれば読み取りは正しい。
"""
import importlib.util
import sys

BUNKA = ('理科', '書写', '外国語')
CLASS1_TEACHER_FREE = ('図工', '外国語', '理科', '書写', '?')


def load_plan(path):
    spec = importlib.util.spec_from_file_location('plan', path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return {k: v[0] for k, v in mod.build().items()}


def load_class1(path):
    grid, purple = {}, set()
    for line in open(path, encoding='utf-8'):
        line = line.split('#', 1)[0].strip()
        if not line:
            continue
        day, *subs = line.split()
        for p, s in enumerate(subs, 1):
            if s.endswith('*'):
                purple.add((int(day), p))
                s = s[:-1]
            grid[(int(day), p)] = s
    return grid, purple


def main(plan_path, class1_path):
    g2 = load_plan(plan_path)
    g1, purple = load_class1(class1_path)

    counts = {}
    for s in g1.values():
        counts[s] = counts.get(s, 0) + 1
    kokugo = counts.get('国語', 0) + counts.get('書写', 0)
    order = ['国語', '社会', '算数', '理科', '音楽', '図工', '家庭', '体育', '道徳', '外国語',
             '総合', '学活', '児童会', 'クラブ', '行事']
    shown = ['国語%d（書写含む）' % kokugo] + ['%s%d' % (s, counts[s]) for s in order[1:] if s in counts]
    if '?' in counts:
        shown.append('未定?%d' % counts['?'])
    print('書き起こした1組の表: 合計%d  %s' % (len(g1), ' '.join(shown)))
    print('  → 1組の集計欄の「計画」と一致するか確かめること')

    problems = []
    for k in sorted(set(g1) | set(g2)):
        a, b = g1.get(k), g2.get(k)
        where = '%d日%d校時' % k
        if a is None or b is None:
            problems.append('%s 1組と2組で枠の有無が違う（1組=%s 2組=%s）' % (where, a, b))
            continue
        if k in purple and a != b:
            problems.append('%s 紫のセルがずれている（1組=%s 2組=%s）' % (where, a, b))
        if a == '行事' and b != '行事':
            problems.append('%s 行事がずれている（2組=%s）' % (where, b))
        if a == b and a in BUNKA and k not in purple:
            problems.append('%s %sが1組と同時（分科の先生が重なる）' % (where, a))
        if a == b and a in ('音楽', '家庭') and k not in purple:
            problems.append('%s %sが1組と同時（特別教室が重なる）' % (where, a))
        if b == '家庭' and a not in CLASS1_TEACHER_FREE and k not in purple:
            problems.append('%s 2組が家庭だが、1組担任は1組の%sを指導中' % (where, a))
        if a == '図工' and b not in ('家庭',) + BUNKA:
            problems.append('%s 1組の図工（2組担任が指導）の時間に、2組が%s' % (where, b))
    print('\n'.join(problems) if problems else '重複・ずれ なし')
    return 1 if problems else 0


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    sys.exit(main(sys.argv[1], sys.argv[2]))
