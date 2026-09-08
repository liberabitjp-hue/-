// 別紙5.2「正解データを用いた回帰テスト」: 固定時間割ファイルの抽出。
import { describe, expect, it } from 'vitest'
import { detectFields } from '../src/excel/detect'
import { loadFixture } from './helpers/loadFixture'

describe('fixedTimetable 検出（実データ）', () => {
  it('曜日・校時の並びと、特別教室・分科の固定割当を検出する', async () => {
    const wb = await loadFixture('fixed-timetable.xlsx', 'fixedTimetable')
    const detections = detectFields(wb)
    const byKey = new Map(detections.map((d) => [d.key, d]))

    expect(byKey.get('fixedTimetable.grid')?.confidence).toBe('high')

    const specialRoomKeys = detections.filter((d) => d.key.startsWith('fixedTimetable.specialRoom.'))
    const specialistKeys = detections.filter((d) => d.key.startsWith('fixedTimetable.specialist.'))
    expect(specialRoomKeys.length).toBeGreaterThan(0)
    expect(specialistKeys.length).toBeGreaterThan(0)

    // 実データに含まれる特別教室名の一部（体育館・音楽室・理科室）。
    const roomNames = specialRoomKeys.map((d) => d.label)
    expect(roomNames.some((l) => l.includes('体育館'))).toBe(true)
    expect(roomNames.some((l) => l.includes('音楽室'))).toBe(true)
  })

  it('「分科計画」表（学級ごとの分科担当・時数一覧）は検出しない（利用者の指示によりフェーズAで削除済み）', async () => {
    const wb = await loadFixture('fixed-timetable.xlsx', 'fixedTimetable')
    const detections = detectFields(wb)
    expect(detections.some((d) => d.label.includes('分科計画'))).toBe(false)
  })

  it('同じ入力からは常に同じ結果になる（再現性）', async () => {
    const wb = await loadFixture('fixed-timetable.xlsx', 'fixedTimetable')
    const first = detectFields(wb)
    const second = detectFields(wb)
    expect(second).toEqual(first)
  })
})
