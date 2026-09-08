// 別紙5.2「正解データを用いた回帰テスト」: 年間指導計画ファイルの抽出。
import { describe, expect, it } from 'vitest'
import { detectFields } from '../src/excel/detect'
import { loadFixture } from './helpers/loadFixture'

describe('annualPlan 検出（実データ）', () => {
  it('教科ごとのシートから単元名・計画時数を検出する', async () => {
    const wb = await loadFixture('annual-plan.xlsx', 'annualPlan')
    const detections = detectFields(wb)

    const kokugoUnit = detections.find((d) => d.key === 'annualPlan.国語５年 .unitName')
    expect(kokugoUnit).toBeDefined()
    expect(kokugoUnit!.confidence).not.toBe('none')
    expect(kokugoUnit!.sampleValues.length).toBeGreaterThan(0)

    const kokugoHours = detections.find((d) => d.key === 'annualPlan.国語５年 .plannedHours')
    expect(kokugoHours).toBeDefined()
    expect(kokugoHours!.confidence).not.toBe('none')
  })

  it('「別葉」シートは単元別の計画表ではないため検出対象にしない', async () => {
    const wb = await loadFixture('annual-plan.xlsx', 'annualPlan')
    const detections = detectFields(wb)
    expect(detections.some((d) => d.sheetName.includes('別葉'))).toBe(false)
  })

  it('「総合的な学習の時間」は1シートに複数系列（【系列名】見出し）が並ぶ構造として検出する', async () => {
    const wb = await loadFixture('annual-plan.xlsx', 'annualPlan')
    const detections = detectFields(wb)
    const seriesUnitNames = detections.filter((d) => d.key.startsWith('annualPlan.総合５年 .series.') && d.key.endsWith('.unitName'))
    // 実データには3系列（本宮の米/まゆみ小の伝統/東日本大震災）が並んでいる。
    expect(seriesUnitNames.length).toBe(3)
    for (const d of seriesUnitNames) {
      expect(d.sampleValues.length).toBeGreaterThan(0)
    }
  })

  it('分科教科と担当者に登録された教科のシートは除外する（担任以外が受け持つ教科）', async () => {
    const wb = await loadFixture('annual-plan.xlsx', 'annualPlan')
    const withExclusion = detectFields(wb, { excludedSubjects: ['理科'] })
    expect(withExclusion.some((d) => d.sheetName.includes('理科'))).toBe(false)

    const withoutExclusion = detectFields(wb, { excludedSubjects: [] })
    expect(withoutExclusion.some((d) => d.sheetName.includes('理科'))).toBe(true)
  })

  it('同じ入力からは常に同じ結果になる（再現性）', async () => {
    const wb = await loadFixture('annual-plan.xlsx', 'annualPlan')
    const first = detectFields(wb, { excludedSubjects: [] })
    const second = detectFields(wb, { excludedSubjects: [] })
    expect(second).toEqual(first)
  })
})
