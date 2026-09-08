// 別紙5.2「正解データを用いた回帰テスト」: 授業時数･下校予定時刻ファイルの抽出。
import { describe, expect, it } from 'vitest'
import { detectFields } from '../src/excel/detect'
import { loadFixture } from './helpers/loadFixture'

describe('classHoursEvents 検出（実データ）', () => {
  it('日付・担当学年の授業時数/下校予定時刻・行事列を検出する', async () => {
    const wb = await loadFixture('class-hours-events.xlsx', 'classHoursEvents')
    const detections = detectFields(wb, { grade: '5' })
    const byKey = new Map(detections.map((d) => [d.key, d]))

    expect(byKey.get('classHoursEvents.day')?.confidence).toBe('high')
    expect(byKey.get('classHoursEvents.hours.5')?.confidence).toBe('high')
    expect(byKey.get('classHoursEvents.dismissal.5')?.confidence).toBe('high')
    expect(byKey.get('classHoursEvents.events')).toBeDefined()

    // 担当学年（5学年）だけに絞り込む（利用者からの指示、フェーズA修正2巡目）。
    // 他学年の列がここに紛れ込むのは、過去に実際発生した回帰。
    for (const grade of [1, 2, 3, 4, 6]) {
      expect(byKey.has(`classHoursEvents.hours.${grade}`)).toBe(false)
      expect(byKey.has(`classHoursEvents.dismissal.${grade}`)).toBe(false)
    }
  })

  it('12か月すべてに「◯月に使うシート」の判定があり、改訂版が複数あるページは自動選択しない', async () => {
    const wb = await loadFixture('class-hours-events.xlsx', 'classHoursEvents')
    const detections = detectFields(wb, { grade: '5' })
    const byKey = new Map(detections.map((d) => [d.key, d]))

    for (const m of [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]) {
      const d = byKey.get(`classHoursEvents.monthSheet.${m}`)
      expect(d, `${m}月のmonthSheet検出が無い`).toBeDefined()
      if ((d!.options?.length ?? 0) > 1) {
        // 候補が複数ある月は、どれが最新版か自動で決めない（利用者が選ぶ）。
        expect(d!.confidence).toBe('low')
        expect(d!.rangeRef).toBe('')
      } else {
        expect(d!.confidence).toBe('high')
      }
    }
  })

  it('同じ入力からは常に同じ結果になる（再現性）', async () => {
    const wb = await loadFixture('class-hours-events.xlsx', 'classHoursEvents')
    const first = detectFields(wb, { grade: '5' })
    const second = detectFields(wb, { grade: '5' })
    expect(second).toEqual(first)
  })
})
