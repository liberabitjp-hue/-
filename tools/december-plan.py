# -*- coding: utf-8 -*-
"""令和8年度12月「月学習予定表」（5年2組）の初期案を組み立てる作業用スクリプト。

11月と同じく、上の層ほど優先して枠を確定させる:
  1) 利用可能な日・校時        授業時数･下校予定時刻一覧表 12月
  2) 行事枠                    同上の行事欄（8日⑥児童会、18日⑤美化活動、23日③終業式）
  3) 分科の確定枠              12月 学習予定表 外国語（渡部先生）の5-2（黄色の蛍光ペン）
  4) 学年で合わせる枠          5年1組の12月学習予定表の紫色のセル。
                               5-2の家庭科は1組担任の手が空く時間（4日・18日の1組図工）と、1日③の合同
  5) 分科の振替                11日②の理科（佐藤先生の固定時間割で金2が空き）
  6) 前月までの曜日・校時パターン
  7) 残りの枠の調整            時数を1組の表の数字に合わせる（理由つき）
通級は「R8 通級II 固定時間割表（12月）改訂版」の5-2の枠（月5算・火2国・水3算・水5国）で点検する。
"""

# --- 1) 利用可能な日・校時（5学年列） ---
DAYS = [
    (1, '火', 5), (2, '水', 6), (3, '木', 6), (4, '金', 5),
    (7, '月', 5), (8, '火', 6), (9, '水', 6), (10, '木', 6), (11, '金', 5),
    (14, '月', 5), (15, '火', 6), (16, '水', 6), (17, '木', 6), (18, '金', 5),
    (21, '月', 5), (22, '火', 5), (23, '水', 4),
]

# 下校予定時刻（5学年列）。月シートのAL列「下校時刻」へ書き込む
DISMISSAL = {
    1: '14:00', 2: '15:40', 3: '15:15', 4: '14:50',
    7: '14:50', 8: '15:15', 9: '15:40', 10: '15:15', 11: '14:00',
    14: '14:50', 15: '15:15', 16: '15:40', 17: '15:15', 18: '14:50',
    21: '14:50', 22: '14:25', 23: '12:00',
}

# --- 2) 行事枠 ---
EVENTS = {
    (8, 6): ('児童会', '委員会活動'),          # 児童会委員会⑥（上：児1）
    (18, 5): ('行事', '第2回校内美化活動'),    # ⑤（全：行1）
    (23, 3): ('行事', '第2学期終業式'),        # （全：行1）。1組の表も③
}

# --- 利用者指定の枠（12月は指定なし） ---
USER_FIXED = {}
HOKYO = set()

# --- 3) 分科の確定枠（外国語・渡部先生の12月予定表で5-2に蛍光ペンの枠） ---
BUNKA_FIXED = {
    (3, 2): '外国語', (4, 1): '外国語', (10, 2): '外国語', (11, 1): '外国語',
    (17, 2): '外国語', (18, 1): '外国語', (22, 1): '外国語',
}

# --- 4) 学年で合わせる枠（5年1組の紫色のセル） ---
GRADE_ALIGN = {
    # 体育（7）
    (1, 5): '体育', (3, 5): '体育', (7, 3): '体育', (8, 5): '体育',
    (10, 5): '体育', (15, 5): '体育', (22, 5): '体育',
    # 17日⑤: 1組の表の下段「2組保健」。1組が外国語の時間に1組担任が2組の保健を受け持つ
    (17, 5): '体育',
    # 総合（5）: 9日⑥・16日⑥・21日⑤はお米、10日⑥・17日⑥は鼓笛
    (9, 6): '総合', (10, 6): '総合', (16, 6): '総合', (17, 6): '総合', (21, 5): '総合',
    # 学活（お米）
    (14, 5): '学活',
}
PRESENTATION_DAY = {}

# 5-2の家庭科（1組担任が受け持つ）。下段に書く内容
KATEI = {
    (1, 3): '1組と合同（お米）',     # 1組の表「家庭 2組と合同お米」（紫）
    (4, 3): '1組図工', (4, 4): '1組図工',
    (18, 3): '1組図工', (18, 4): '1組図工',
}
KATEI_ALIGN = {(1, 3)}

# 総合の下段。お米は本宮の米の系列で進め、鼓笛は進度なし
SOGO = {
    (9, 6): ('本宮の米を全国に発信しよう', 'お米'),
    (10, 6): ('鼓笛', ''),
    (16, 6): ('本宮の米を全国に発信しよう', 'お米'),
    (17, 6): ('鼓笛', ''),
    (21, 5): ('本宮の米を全国に発信しよう', 'お米'),
}
KOME_START, KOME_TOTAL = 24, 42      # 11月末で23/42

# --- 5) 分科の振替 ---
# 11日は外国語①のほかに4教科が要る（同じ日に同じ教科を置かないため）。
# 佐藤先生はR8固定時間割で金2が空いているので、木1（3日）の理科を11日②へ
RIKA_MOVE = {(11, 2)}
NO_BASE = set()

# --- 6) 曜日・校時の基本パターン（9～11月と同じ） ---
BASE = {
    '月': ['図工', '図工', '国語', '算数', '学活', None],
    '火': ['社会', '国語', '算数', '理科', '体育', '総合'],
    '水': ['社会', '理科', '算数', '算数', '国語', '総合'],
    '木': ['理科', '外国語', '書写', '音楽', '体育', '総合'],
    '金': ['外国語', '算数', '家庭', '家庭', '道徳', None],
}

# --- 7) 残りの枠の調整 ---
ADJUST = {
    (1, 4):  ('算数', '理科は8時間（1組と同じ）。火4の理科を1日・22日は置かない'),
    (2, 4):  ('道徳', '水曜は通級で③算数・⑤国語が決まるため、④を道徳に（2日の算数を1時間に）'),
    (2, 6):  ('学活', '総合は1組と合わせる5時間のみ。1組も2日⑥は学活（学級会）'),
    (3, 1):  ('国語', '理科を11日②へ振り替えた分'),
    (3, 6):  ('算数', '総合は1組と合わせる5時間のみ'),
    (4, 5):  ('国語', '道徳を水④へ移した分'),
    (7, 4):  ('国語', '③が学年の体育になった分。⑤は通級の算数'),
    (7, 5):  ('算数', '通級の算数枠（月5）'),
    (9, 4):  ('道徳', '水曜は通級で③算数・⑤国語が決まるため'),
    (11, 3): ('算数', '金2を理科にした分'),
    (11, 4): ('社会', '金3・4は1組が国語・算数で家庭を置けない'),
    (11, 5): ('国語', '授業参観（1組は道徳）。道徳は水④で3時間'),
    (15, 6): ('音楽', '火曜に教科を重ねないため（音楽室の火6要確認）'),
    (16, 4): ('道徳', '水曜は通級で③算数・⑤国語が決まるため'),
    (21, 1): ('算数', '図工は7日・14日で4時間'),
    (21, 2): ('社会', '図工は7日・14日で4時間'),
    (21, 4): ('音楽', '音楽室の月4'),
    (22, 4): ('社会', '理科は8時間（1組と同じ）'),
    (23, 1): ('国語', '短縮日（4時間）'),
    (23, 2): ('算数', '短縮日。理科は8時間のため水2に置かない'),
    (23, 4): ('学活', '二学期の反省と冬休みの過ごし方（1組も④学活）'),
}

# 1組の表の「計画」欄に合わせる。ただし外国語は渡部先生の予定表で5-2が7時間（1組は6時間）
# のため、合計92を保つよう算数を1組の16から15にした
# （予定表との過不足: 国語+1、算数+1、外国語+1、合計92（予定89））
TARGET = {
    '国語': 14, '書写': 3, '社会': 9, '算数': 15, '理科': 8, '音楽': 5,
    '図工': 4, '家庭': 5, '体育': 8, '道徳': 3, '外国語': 7, '総合': 5,
    '学活': 3, '児童会': 1, '行事': 2,
}

UPPER_LAYER_SUBJECTS = ('外国語', '家庭', '総合', '体育')


def build():
    """(日, 校時) -> (教科, 由来) の割当てを返す。"""
    slots = {}
    for day, dow, periods in DAYS:
        for p in range(1, periods + 1):
            k = (day, p)
            if k in EVENTS:
                slots[k] = (EVENTS[k][0], '行事')
            elif k in USER_FIXED:
                slots[k] = (USER_FIXED[k], '利用者指定')
            elif k in BUNKA_FIXED:
                slots[k] = (BUNKA_FIXED[k], '分科確定')
            elif k in GRADE_ALIGN:
                slots[k] = (GRADE_ALIGN[k], '学年合わせ')
            elif k in PRESENTATION_DAY:
                slots[k] = (PRESENTATION_DAY[k], '学年合わせ')
            elif k in KATEI:
                slots[k] = ('家庭', '学年合わせ' if k in KATEI_ALIGN else '交換授業')
            elif k in RIKA_MOVE:
                slots[k] = ('理科', '分科振替')
            elif k in ADJUST:
                slots[k] = (ADJUST[k][0], '調整')
            elif k in NO_BASE:
                raise AssertionError('%d日%d校時は基本パターンを使えない。調整表で埋めること' % k)
            else:
                sub = BASE[dow][p - 1]
                if sub is None or sub in UPPER_LAYER_SUBJECTS:
                    raise AssertionError(
                        '%d日%d校時: 基本パターン(%s)は使えない。調整表で埋めること' % (day, p, sub))
                slots[k] = (sub, '分科' if sub in ('理科', '書写') else '前月パターン')
    return slots


def tally(slots):
    counts = {}
    for sub, _ in slots.values():
        counts[sub] = counts.get(sub, 0) + 1
    return counts


# =====================================================================
# 単元名・進度（年間指導計画の11月配当 + 10月の初期案の進度の続き）
# =====================================================================

def seq(unit, start, total, n):
    return [(unit, '%d/%d' % (start + i, total)) for i in range(n)]


def fixed(unit, n):
    return [(unit, '')] * n


UNITS = {
    # 11月は「やなせたかし」を1/5まで。年間計画の12月配当（繰越3+6+1+2+言葉でスケッチ1）に1時間足す
    '国語': (seq('やなせたかし－アンパンマンの勇気', 2, 5, 4)
           + seq('あなたは、どう考える', 1, 6, 6)
           + seq('冬の朝', 1, 1, 1)
           + seq('好きな詩のよさを伝えよう', 1, 2, 2)
           + seq('言葉でスケッチ', 1, 2, 1)),
    '書写': fixed('大浦先生の案による', 3),
    # 11月は「情報産業」を2/6まで
    '社会': (seq('情報産業とわたしたちのくらし', 3, 6, 4)
           + seq('情報を生かす産業', 1, 5, 5)),
    # 11月は「面積」を6/13まで。年間計画の比べ方(2)の12月配当7時間より1時間先行
    '算数': (seq('面積の求め方を考えよう', 7, 13, 7)
           + seq('比べ方を考えよう(2)', 1, 10, 8)),
    '理科': fixed('佐藤（和）先生の案による', 8),
    '音楽': (seq('豊かな表現', 4, 4, 1)
           + seq('音のスケッチ', 1, 2, 2)
           + seq('にっぽんのうた みんなのうた', 1, 2, 2)),
    # 選択題材は「地球まるごと たからばこ」で仮置き（「この空間がいい感じ」との選択）
    '図工': (seq('進め！　糸のこたん検隊！', 5, 6, 2)
           + seq('地球まるごと たからばこ', 1, 2, 2)),
    # 11月はタッチフットボール5/6まで。17日⑤の保健は UNIT_AT で別に指定
    '体育': (seq('タッチフットボール', 6, 6, 1)
           + seq('マット運動', 1, 6, 6)),
    '道徳': [('そういうものにわたしはなりたい――宮沢賢治', '24/35'),
             ('最後のおくり物', '25/35'), ('正月料理', '26/35')],
    '外国語': fixed('渡部先生の案による', 7),
    # 14日⑤は学年のお米。年間計画の「防災について考えよう」と学級会1時間は1月以降へ
    '学活': [('学級会', '25/36'), ('学級会（お米・学年）', '26/36'),
             ('二学期の反省と冬休みの過ごし方', '27/36')],
}

# 特定の枠に決まった単元（キューより優先）
UNIT_AT = {
    (17, 5): ('けがの防止（事故やけがの原因と防止１）', ''),   # 保健。11月に入れられなかった分
}

EVENT_UNITS = {k: (v[1], '') for k, v in EVENTS.items()}

NOTES = {
    1: '【短】個別懇談予備日、安全点検、防火診断2 家庭③1組と合同（お米）',
    2: 'モトム号',
    4: '※11月月案反省提出',
    7: 'ドリーム文庫回収',
    8: '児童会委員会⑥（上：児1）',
    9: '総合⑥お米（学年）',
    10: '総合⑥鼓笛（学年） ※口座振替日1',
    11: '【短】授業参観、学年学級懇談会',
    14: 'ドリーム文庫配本 学活⑤お米（学年）',
    16: '総合⑥お米（学年）',
    17: '教育長訪問 体育⑤保健（1組担任） 総合⑥鼓笛（学年）',
    18: '第2回校内美化活動⑤（全：行1）',
    21: '総合⑤お米（学年）',
    23: '【短】第2学期終業式（全：行1）（給食なし） 冬季休業日は24日から',
}


def assign_units(slots):
    """(日, 校時) -> (教科, 単元名, 進度, 由来)"""
    queues = {k: list(v) for k, v in UNITS.items()}
    kome = iter(range(KOME_START, KOME_TOTAL + 1))
    out = {}
    for k in sorted(slots):
        sub, origin = slots[k]
        if k in EVENT_UNITS:
            unit, prog = EVENT_UNITS[k]
        elif k in UNIT_AT:
            unit, prog = UNIT_AT[k]
        elif sub == '総合':
            unit, _activity = SOGO[k]
            prog = ('%d/%d' % (next(kome), KOME_TOTAL)) if unit.startswith('本宮の米') else ''
        elif sub == '家庭':
            unit, prog = KATEI[k], ''
        else:
            q = queues.get(sub)
            if not q:
                raise AssertionError('%s の単元が足りません（%d日%d校時）' % (sub, k[0], k[1]))
            unit, prog = q.pop(0)
        out[k] = (sub, unit, prog, origin)
    left = {k: len(v) for k, v in queues.items() if v}
    if left:
        raise AssertionError('割り当てきれなかった単元があります: %s' % left)
    return out


TSUKYU = {('月', 5): '算数', ('火', 2): '国語', ('水', 3): '算数', ('水', 5): '国語'}   # R8 通級II 固定時間割表（12月）改訂版

# 担任が出張の日。2組担任の教科（音楽・道徳など）は置けない。置けるのは分科（外国語・理科・書写）、
# 学年合同の枠、1組が分科の時間に1組担任が受け持つ授業だけ
TRIP_DAYS = set()
# 1組が分科（外国語・理科・書写）の時間 = 1組担任が2組を受け持てる時間（1組の11月学習予定表）
CLASS1_BUNKA = set()
TEACHER_FREE_OK = ('外国語', '理科', '書写')


BUNKA_SUBJECTS = ('外国語', '理科', '書写')


def check_bunka_runs(slots):
    """分科（外国語・理科・書写）の点検（利用者指示）。
    同じ分科の教科は1日1時間まで（理科②理科③も、理科①理科④も不可）。
    教科が違えば続けてよい（理科①外国語②は可）。
    """
    per_day = {}
    for (d, p), (s, _) in sorted(slots.items()):
        if s in ('外国語', '理科', '書写'):
            per_day.setdefault((d, s), []).append(p)
    return ['%d日 %sが%d時間（%s校時）' % (d, s, len(ps), '・'.join(map(str, ps)))
            for (d, s), ps in sorted(per_day.items()) if len(ps) > 1]


SAME_DAY_EXEMPT = ('図工', '家庭')     # 利用者指示: 図工・家庭は同日に重なってよい
SAME_DAY_FIXED = ('行事', '学年合わせ')  # 行事・1組と合わせる枠は動かせないため点検から外す


def check_same_day(slots):
    """同じ日に同じ教科が2時間以上入っている日を返す（図工・家庭、行事・学年合わせの枠は除く）。"""
    per = {}
    for (d, p), (s, o) in sorted(slots.items()):
        if s in SAME_DAY_EXEMPT or o in SAME_DAY_FIXED:
            continue
        per.setdefault((d, s), []).append(p)
    return ['%d日 %sが%d時間（%s校時）' % (d, s, len(ps), '・'.join(map(str, ps)))
            for (d, s), ps in sorted(per.items()) if len(ps) > 1]


def check_trip(plan):
    ng = []
    for (day, period), (sub, _u, _p, origin) in sorted(plan.items()):
        if day not in TRIP_DAYS or sub in TEACHER_FREE_OK or origin == '学年合わせ':
            continue
        if (day, period) in CLASS1_BUNKA or (day, period) in HOKYO:
            continue
        ng.append('%d日%d校時: %s（担任出張の日に担任の教科）' % (day, period, sub))
    return ng


def check_tsukyu(plan):
    ng = []
    for day, w, n in DAYS:
        for (tw, tp), want in TSUKYU.items():
            if tw != w or tp > n:
                continue
            sub, _u, _p, origin = plan[(day, tp)]
            if sub != want:
                ng.append('%d日(%s)%d校時: %s［%s］（通級は%sを想定）' % (day, w, tp, sub, origin, want))
    return ng


def main():
    slots = build()
    counts = tally(slots)
    print('総コマ数 = %d （実施できる時数 92）\n' % len(slots))
    print('教科     目標  配置  差')
    ok = True
    for sub in TARGET:
        got = counts.get(sub, 0)
        ok &= got == TARGET[sub]
        print('%-6s %4d %5d %4s' % (sub, TARGET[sub], got, got - TARGET[sub] or '0'))
    extra = set(counts) - set(TARGET)
    if extra:
        ok = False
        print('目標にない教科:', extra)
    print('\n判定:', '1組の表の数字と一致' if ok else '不一致あり')

    plan = assign_units(slots)
    print('\n===== 令和8年12月　月学習予定表（5年2組）初期案 =====')
    for day, w, periods in DAYS:
        print('\n%2d日(%s)  %d時間   %s' % (day, w, periods, NOTES.get(day, '')))
        for p in range(1, periods + 1):
            sub, unit, prog, origin = plan[(day, p)]
            print('   %d校時  %-4s %-7s %-26s [%s]' % (p, sub, prog or '', unit, origin))
    same = check_same_day(slots)
    print('\n--- 同じ日に同じ教科（図工・家庭を除く）の点検 ---')
    print('\n'.join('   ' + x for x in same) if same else '   なし')
    runs = check_bunka_runs(slots)
    print('\n--- 分科の点検（同じ教科は1日1時間まで） ---')
    print('\n'.join('   ' + x for x in runs) if runs else '   なし')
    trip = check_trip(plan)
    print('\n--- 担任出張の日（%s）の点検 ---' % ('・'.join(map(str, sorted(TRIP_DAYS))) + '日' if TRIP_DAYS else 'なし'))
    print('\n'.join('   ' + x for x in trip) if trip else '   担任の教科なし（補教の枠を除く）')
    print('   補教の枠: ' + '、'.join('%d日%d校時 %s' % (k[0], k[1], plan[k][0]) for k in sorted(HOKYO)))
    banned = [k for k in plan if k[0] in TRIP_DAYS and plan[k][0] in ('音楽', '道徳')]
    print('   音楽・道徳: ' + ('あり %s' % banned if banned else 'なし'))
    ng = check_tsukyu(plan)
    print('\n--- 通級（月5算数・火2国語・水3算数・水5国語）の点検 ---')
    print('\n'.join('   ' + x for x in ng) if ng else '   すべて想定どおり')


if __name__ == '__main__':
    main()
