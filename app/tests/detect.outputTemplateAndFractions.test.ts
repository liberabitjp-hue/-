// 別紙5.2「正解データを用いた回帰テスト」: 出力先ひな型・分数一覧ファイルの抽出。
import { describe, expect, it } from 'vitest'
import { detectFields } from '../src/excel/detect'
import { loadFixture } from './helpers/loadFixture'

describe('outputTemplate 検出（実データ）', () => {
  it('4月～翌3月の12の月別シートと、校時ごとの教科名/単元名・進度・備考・下校時刻を検出する', async () => {
    const wb = await loadFixture('output-template.xlsm', 'outputTemplate')
    const detections = detectFields(wb)
    const byKey = new Map(detections.map((d) => [d.key, d]))

    expect(byKey.get('outputTemplate.monthSheets')?.confidence).toBe('high')
    expect(byKey.get('outputTemplate.monthSheets')?.sampleValues.length).toBe(12)

    const periodDetections = detections.filter((d) => d.key.startsWith('outputTemplate.period.'))
    expect(periodDetections.length).toBeGreaterThan(0)

    expect(byKey.get('outputTemplate.dismissal')).toBeDefined()
  })

  it('「予定表」シート（年度・学級名・月別教科別予定時数）は検出しない（利用者入力済みの前提、フェーズA仕様修正）', async () => {
    const wb = await loadFixture('output-template.xlsm', 'outputTemplate')
    const detections = detectFields(wb)
    expect(detections.some((d) => d.sheetName === '予定表')).toBe(false)
  })

  it('同じ入力からは常に同じ結果になる（再現性）', async () => {
    const wb = await loadFixture('output-template.xlsm', 'outputTemplate')
    const first = detectFields(wb)
    const second = detectFields(wb)
    expect(second).toEqual(first)
  })
})

describe('fractionsTable 検出（実データ）', () => {
  it('分母・分数（文字列）の2列を検出する', async () => {
    const wb = await loadFixture('fractions-table.xlsx', 'fractionsTable')
    const detections = detectFields(wb)
    const byKey = new Map(detections.map((d) => [d.key, d]))

    expect(byKey.get('fractionsTable.denominator')?.confidence).toBe('high')
    expect(byKey.get('fractionsTable.fraction')?.confidence).toBe('high')

    // 分数が「1/2」のような文字列のままで、SheetJSがDate等に誤変換していないこと
    // （指示書16章「分数は文字列として保持し、日付へ変換しない」の根拠データ側の確認。
    // 誤変換されていれば "1900-01-02" のようなISO日付文字列になってしまう）。
    const fractionSamples = byKey.get('fractionsTable.fraction')?.sampleValues ?? []
    expect(fractionSamples.length).toBeGreaterThan(0)
    for (const v of fractionSamples) {
      expect(v).toMatch(/^\d+\/\d+$/)
    }
  })
})
