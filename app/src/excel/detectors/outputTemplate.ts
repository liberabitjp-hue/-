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

/** 出力先ひな型（月案 .xlsm）相当。月ごとのシート（曜日×校時の表）と、
 *  年間の教科別予定時数表（"予定表"シート相当）を検出する。 */
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

  const planSheet = wb.sheets.find((s) => s.name === '予定表') ?? findPlanSheetByShape(wb.sheets)
  if (planSheet) out.push(...detectPlanSheet(planSheet))

  return out
}

function findPlanSheetByShape(sheets: SheetSnapshot[]): SheetSnapshot | undefined {
  return sheets.find((s) => findAllCells(s, MONTH_SHEET_RE, { rowTo: 3 }).length >= 6)
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

function detectPlanSheet(sheet: SheetSnapshot): FieldDetection[] {
  const out: FieldDetection[] = []

  const yearCell = findCell(sheet, /^(19|20)\d{2}$/, { rowTo: 2 })
  if (yearCell) {
    out.push(
      makeDetection('outputTemplate.plan.year', '年度', sheet.name, rangeRef(yearCell.row, yearCell.col, yearCell.row, yearCell.col), [yearCell.text], 'high'),
    )
  }
  const classCell = findCell(sheet, /^\d+年\d+組$/, { rowTo: 2 })
  if (classCell) {
    out.push(
      makeDetection('outputTemplate.plan.className', '学年・組', sheet.name, rangeRef(classCell.row, classCell.col, classCell.row, classCell.col), [classCell.text], 'high'),
    )
  }

  const monthHeaders = findAllCells(sheet, MONTH_SHEET_RE, { rowTo: 3 })
  if (monthHeaders.length > 0) {
    const headerRow = monthHeaders[0].row
    const subjectRows: number[] = []
    for (let r = headerRow + 1; r < sheet.rows.length; r++) {
      const label = sheet.rows[r]?.[1] // column B
      if (!isBlank(label) && typeof label === 'string') subjectRows.push(r)
      // Stop once we've collected the 教科+特別活動 block and hit a long empty gap.
      if (subjectRows.length > 0 && r - subjectRows[subjectRows.length - 1] > 3) break
    }
    const firstCol = Math.min(...monthHeaders.map((m) => m.col))
    const lastCol = Math.max(...monthHeaders.map((m) => m.col))
    const lastRow = subjectRows[subjectRows.length - 1] ?? headerRow
    const sample = subjectRows.slice(0, 6).map((r) => {
      const name = String(sheet.rows[r][1])
      const vals = monthHeaders.slice(0, 4).map((m) => sheet.rows[r][m.col])
      return `${name}: ${vals.join(', ')}...`
    })
    out.push(
      makeDetection(
        'outputTemplate.plan.subjectMonthlyTargets',
        '月別・教科等別 予定時数表',
        sheet.name,
        rangeRef(headerRow, 1, lastRow, lastCol),
        sample,
        'high',
        '各月シートのT列相当の「予定」は、この表を数式で参照しています。この表を予定時数の基準とします。',
      ),
    )
    out.push(
      makeDetection(
        'outputTemplate.plan.monthColumns',
        '月の並び（列）',
        sheet.name,
        rangeRef(headerRow, firstCol, headerRow, lastCol),
        monthHeaders.map((m) => m.text),
        'high',
      ),
    )
  }

  return out
}
