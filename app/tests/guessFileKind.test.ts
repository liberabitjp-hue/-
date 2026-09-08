// 別紙5.2「正解データを用いた回帰テスト」: ファイル種別の自動推測（②ファイル取込み時の警告表示に使用）。
import { describe, expect, it } from 'vitest'
import { guessFileKind } from '../src/excel/detect'
import { parseWorkbookRaw } from '../src/excel/workbookReader'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { FileKind } from '../src/types'

const FIXTURES_DIR = join(__dirname, '..', 'test-fixtures')

const cases: [string, FileKind][] = [
  ['output-template.xlsm', 'outputTemplate'],
  ['fixed-timetable.xlsx', 'fixedTimetable'],
  ['class-hours-events.xlsx', 'classHoursEvents'],
  ['annual-plan.xlsx', 'annualPlan'],
  ['fractions-table.xlsx', 'fractionsTable'],
]

describe('guessFileKind（実データ5点）', () => {
  for (const [fileName, expected] of cases) {
    it(`${fileName} は ${expected} と推測される`, async () => {
      const buf = readFileSync(join(FIXTURES_DIR, fileName))
      const file = new File([buf], fileName)
      const raw = await parseWorkbookRaw(file)
      const guessed = guessFileKind(raw.sheets.map((s) => s.name), raw.sheets)
      expect(guessed).toBe(expected)
    })
  }
})
