import type { FieldDetection, ParsedWorkbook, SheetSnapshot } from '../../types'
import {
  findAllCells,
  findCell,
  isBlank,
  makeDetection,
  normalize,
  rangeRef,
  sampleColumn,
} from './shared'

const PERIOD_RE = /^\d+校時$/
const MONTH_SHEET_RE = /^\d{1,2}月$/

/** 出力先ひな型（月案 .xlsm）相当。月ごとのシート（曜日×校時の表）を検出する。
 *
 *  「予定表」シート（年度・学級名・月別教科別予定時数）は、アップロード前に
 *  利用者自身が入力を終えている前提の資料のため、確認画面には出さない
 *  （利用者からの指示: フェーズA仕様修正）。生成ロジック（フェーズB以降）が
 *  必要とする際は、保存済みのシート内容から都度読み直せばよい。 */
export function detectOutputTemplate(wb: ParsedWorkbook): FieldDetection[] {
  const out: FieldDetection[] = []

  const monthSheets = wb.sheets.filter((s) => MONTH_SHEET_RE.test(normalize(s.name)))
  out.push(
    makeDetection(
      'outputTemplate.monthSheets',
      '月別シート一覧',
      wb.fileName,
      '(複数シート)',
      monthSheets.map((s) => s.name),
      monthSheets.length >= 12 ? 'high' : monthSheets.length > 0 ? 'medium' : 'none',
      '4月～翌3月の12シートを想定しています。名前が違う場合は個別に確認してください。',
    ),
  )

  const representative = monthSheets[0]
  if (representative) out.push(...detectMonthSheetLayout(representative))

  return out
}

function detectMonthSheetLayout(sheet: SheetSnapshot): FieldDetection[] {
  const out: FieldDetection[] = []
  const periodHeaders = findAllCells(sheet, PERIOD_RE, { rowTo: 5 })
  if (periodHeaders.length === 0) return out
  const headerRow = periodHeaders[0].row

  let dataTo = sheet.rows.length - 1
  const firstCol = periodHeaders[0].col
  const secondOccurrence = findAllCells(sheet, new RegExp(`^${periodHeaders[0].text}$`), {
    rowFrom: headerRow + 1,
    colFrom: firstCol,
    colTo: firstCol,
  })[0]
  if (secondOccurrence) dataTo = secondOccurrence.row - 2

  const dataFrom = headerRow + 1

  for (const ph of periodHeaders) {
    out.push(
      makeDetection(
        `outputTemplate.period.${ph.text}`,
        `${ph.text}: 教科名 / 単元名`,
        sheet.name,
        rangeRef(dataFrom, ph.col, dataTo, ph.col),
        sampleColumn(sheet, ph.col, dataFrom, dataTo).filter((v) => !isBlank(v)),
        'high',
        '1行目=教科名、次の行=単元名という2行1組の並びです。',
      ),
    )
    out.push(
      makeDetection(
        `outputTemplate.progress.${ph.text}`,
        `${ph.text}: 単元内進度`,
        sheet.name,
        rangeRef(dataFrom, ph.col + 1, dataTo, ph.col + 1),
        sampleColumn(sheet, ph.col + 1, dataFrom, dataTo).filter((v) => !isBlank(v)),
        'high',
        '「2/6」のような文字列。日付に変換されないよう文字列として扱います。',
      ),
    )
  }

  const noteHeader = findCell(sheet, /^備考$/, { rowFrom: headerRow, rowTo: headerRow })
  if (noteHeader) {
    out.push(
      makeDetection(
        'outputTemplate.notes',
        '備考',
        sheet.name,
        rangeRef(dataFrom, noteHeader.col, dataTo, noteHeader.col),
        sampleColumn(sheet, noteHeader.col, dataFrom, dataTo).filter((v) => !isBlank(v)),
        'high',
      ),
    )
  }

  const dismissalHeader = findCell(sheet, /下校/, { rowTo: 5 })
  if (dismissalHeader) {
    out.push(
      makeDetection(
        'outputTemplate.dismissal',
        '下校予定時刻',
        sheet.name,
        rangeRef(dataFrom, dismissalHeader.col, dataTo, dismissalHeader.col),
        sampleColumn(sheet, dismissalHeader.col, dataFrom, dataTo).filter((v) => !isBlank(v)),
        'high',
        'コピー範囲「下校時刻をコピー」で使う列です。',
      ),
    )
  }

  return out
}
