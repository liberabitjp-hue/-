import type { FieldDetection, ParsedWorkbook, SheetSnapshot } from '../../types'
import { findAllCells, findCell, isBlank, makeDetection, normalize, numericRatio, rangeRef, sampleColumn } from './shared'

function compact(v: unknown): string {
  return normalize(v as never).replace(/\s+/g, '')
}

/** 年間指導計画案 相当。教科ごとにシートが分かれ、列位置は教科によって揺れるため、
 *  各シートで見出し語から候補列を推測し、確度付きで提示する。 */
export function detectAnnualPlan(wb: ParsedWorkbook): FieldDetection[] {
  const out: FieldDetection[] = []
  for (const sheet of wb.sheets) {
    out.push(...detectSheet(sheet))
  }
  return out
}

/** Fraction of *all* rows in [from,to] where this column holds a non-blank
 *  text value - i.e. real per-row coverage, not just "of the cells that
 *  have something, how many are text" (a column with 3 populated rows out
 *  of 36 is a bad 単元名 column even if those 3 happen to be strings). */
function textCoverageRatio(sheet: SheetSnapshot, col: number, from: number, to: number): number {
  const rowSpan = to - from + 1
  if (rowSpan <= 0) return 0
  let text = 0
  for (let r = from; r <= Math.min(to, sheet.rows.length - 1); r++) {
    const v = sheet.rows[r]?.[col]
    if (!isBlank(v) && typeof v === 'string') text++
  }
  return text / rowSpan
}

/** Picks the best numeric column in [fromCol,toCol] after `afterCol`; returns null if nothing scores > 0. */
function bestNumericColumn(
  sheet: SheetSnapshot,
  afterCol: number,
  toCol: number,
  dataFrom: number,
  dataTo: number,
): { col: number; ratio: number } | null {
  let best: { col: number; ratio: number } | null = null
  for (let c = afterCol + 1; c <= toCol; c++) {
    const ratio = numericRatio(sheet, c, dataFrom, dataTo)
    if (ratio > (best?.ratio ?? 0)) best = { col: c, ratio }
  }
  return best
}

function unitNameDetection(
  sheet: SheetSnapshot,
  key: string,
  label: string,
  headerCol: number,
  dataFrom: number,
  dataTo: number,
  searchWidth: number,
): { detection: FieldDetection; unitCol: number } {
  let unitCol = headerCol
  const headerColCoverage = textCoverageRatio(sheet, unitCol, dataFrom, dataTo)
  let confidence: FieldDetection['confidence'] = 'high'
  let note: string | undefined
  if (headerColCoverage < 0.3) {
    let bestCol = unitCol
    let bestCoverage = headerColCoverage
    for (let c = unitCol + 1; c <= Math.min(unitCol + searchWidth, sheet.rows[dataFrom - 1]?.length - 1); c++) {
      const coverage = textCoverageRatio(sheet, c, dataFrom, dataTo)
      if (coverage > bestCoverage) {
        bestCoverage = coverage
        bestCol = c
      }
    }
    unitCol = bestCol
    confidence = bestCoverage >= 0.5 ? 'medium' : 'low'
    note = '見出しの列にはデータが少なかったため、近くの列を候補にしています。必ず内容を確認してください。'
  }
  return {
    unitCol,
    detection: makeDetection(
      key,
      label,
      sheet.name,
      rangeRef(dataFrom, unitCol, dataTo, unitCol),
      sampleColumn(sheet, unitCol, dataFrom, dataTo).filter((v) => !isBlank(v)),
      confidence,
      note,
    ),
  }
}

function plannedHoursDetection(
  sheet: SheetSnapshot,
  key: string,
  label: string,
  afterCol: number,
  toCol: number,
  dataFrom: number,
  dataTo: number,
): FieldDetection {
  const best = bestNumericColumn(sheet, afterCol, toCol, dataFrom, dataTo)
  if (!best) {
    return makeDetection(
      key,
      label,
      sheet.name,
      '(未検出)',
      [],
      'none',
      '数値の列が見つかりませんでした。手動で列を指定してください。',
    )
  }
  return makeDetection(
    key,
    label,
    sheet.name,
    rangeRef(dataFrom, best.col, dataTo, best.col),
    sampleColumn(sheet, best.col, dataFrom, dataTo).filter((v) => !isBlank(v)),
    best.ratio > 0.7 ? 'high' : best.ratio > 0.3 ? 'medium' : 'low',
    '進度（1/6, 2/6...）の分母として使う時数です。内容が違う場合は列を選び直してください。',
  )
}

function findDataEndRow(sheet: SheetSnapshot, dataFrom: number): number {
  for (let r = dataFrom; r < sheet.rows.length; r++) {
    if (sheet.rows[r]?.some((v) => compact(v) === '合計')) return r - 1
  }
  return sheet.rows.length - 1
}

const SERIES_HEADER_RE = /【[^】]+】/

function detectSheet(sheet: SheetSnapshot): FieldDetection[] {
  const out: FieldDetection[] = []

  // Some sheets (総合的な学習の時間 in this school's file) lay out several
  // independent unit series side by side, each introduced by a "【...】"
  // bracketed title instead of a single "単元名" column. Detect that shape
  // first, since the generic single-column guess below would otherwise land
  // on one series and silently ignore the others. Require the series headers
  // to share a row with a "月" header too - otherwise a sheet like 別葉
  // (reference text that happens to use "【...】" for category labels, with
  // no monthly plan structure at all) would be misread as a plan sheet.
  const seriesHeaders = findAllCells(sheet, SERIES_HEADER_RE, { rowTo: 10 })
  if (seriesHeaders.length >= 2) {
    const sameRow = seriesHeaders.filter((h) => h.row === seriesHeaders[0].row)
    const hasMonthHeader = findCell(sheet, /^月$/, { rowFrom: seriesHeaders[0].row, rowTo: seriesHeaders[0].row, colTo: 2 })
    if (sameRow.length >= 2 && hasMonthHeader) {
      return detectMultiSeriesSheet(sheet, sameRow)
    }
  }

  // Header text in this school's files is often spaced out per character
  // (each kanji separated by a full-width space), so allow whitespace between every character. Some
  // sheets also mention "単元" inside a long descriptive paragraph earlier
  // in the sheet ("計画作成上、特に工夫した事項") - skip long matches so we
  // land on the actual short column header instead of that prose.
  const unitHeaderCandidates = findAllCells(sheet, /単\s*元|教\s*材\s*名|題\s*材/, { rowTo: 10 })
  const unitHeader = unitHeaderCandidates.find((c) => c.text.length <= 40) ?? unitHeaderCandidates[0]
  if (!unitHeader) return out // 別葉など、単元別の計画表ではないシートは対象外

  const headerRow = unitHeader.row
  const dataFrom = headerRow + 1
  const dataTo = findDataEndRow(sheet, dataFrom)

  out.push(monthDetection(sheet, headerRow, dataFrom, dataTo))

  const { detection: unitDetection, unitCol } = unitNameDetection(
    sheet,
    `annualPlan.${sheet.name}.unitName`,
    '単元名',
    unitHeader.col,
    dataFrom,
    dataTo,
    4,
  )
  out.push(unitDetection)

  out.push(
    plannedHoursDetection(
      sheet,
      `annualPlan.${sheet.name}.plannedHours`,
      '単元ごとの計画時数',
      unitCol,
      Math.min(unitCol + 5, (sheet.rows[headerRow]?.length ?? 1) - 1),
      dataFrom,
      dataTo,
    ),
  )

  const subtotal = monthlySubtotalDetection(sheet, `annualPlan.${sheet.name}.monthlySubtotal`, headerRow, dataFrom, dataTo)
  if (subtotal) out.push(subtotal)

  return out
}

function monthDetection(sheet: SheetSnapshot, headerRow: number, dataFrom: number, dataTo: number): FieldDetection {
  // 月 column: usually column A on the header row.
  const monthCol = findCell(sheet, /^月$/, { rowFrom: headerRow, rowTo: headerRow, colTo: 2 })?.col ?? 0
  return makeDetection(
    `annualPlan.${sheet.name}.month`,
    '月',
    sheet.name,
    rangeRef(dataFrom, monthCol, dataTo, monthCol),
    sampleColumn(sheet, monthCol, dataFrom, dataTo).filter((v) => !isBlank(v)),
    'high',
  )
}

function monthlySubtotalDetection(
  sheet: SheetSnapshot,
  key: string,
  headerRow: number,
  dataFrom: number,
  dataTo: number,
): FieldDetection | null {
  const hoursHeader = findCell(sheet, /^時数$/, { rowFrom: headerRow, rowTo: headerRow })
  if (!hoursHeader) return null
  return makeDetection(
    key,
    '月別小計時数（参考）',
    sheet.name,
    rangeRef(dataFrom, hoursHeader.col, dataTo, hoursHeader.col),
    sampleColumn(sheet, hoursHeader.col, dataFrom, dataTo).filter((v) => !isBlank(v)),
    'high',
  )
}

/** 総合的な学習の時間のように、1シートに複数の独立した単元系列が並ぶ場合。
 *  系列ごとに「【系列名】」見出しがあるものとして、それぞれ単元名・計画時数を推測する。 */
function detectMultiSeriesSheet(
  sheet: SheetSnapshot,
  seriesHeaders: { row: number; col: number; text: string }[],
): FieldDetection[] {
  const out: FieldDetection[] = []
  const headerRow = seriesHeaders[0].row
  const dataFrom = headerRow + 1
  const dataTo = findDataEndRow(sheet, dataFrom)

  out.push(monthDetection(sheet, headerRow, dataFrom, dataTo))

  const sorted = [...seriesHeaders].sort((a, b) => a.col - b.col)
  sorted.forEach((series, idx) => {
    const seriesName = series.text.replace(/[【】]/g, '').trim()
    const blockEndCol = idx + 1 < sorted.length ? sorted[idx + 1].col - 1 : series.col + 6

    const { detection: unitDetection, unitCol } = unitNameDetection(
      sheet,
      `annualPlan.${sheet.name}.series.${idx}.unitName`,
      `系列「${seriesName}」: 単元名`,
      series.col,
      dataFrom,
      dataTo,
      Math.max(1, blockEndCol - series.col),
    )
    out.push(unitDetection)

    out.push(
      plannedHoursDetection(
        sheet,
        `annualPlan.${sheet.name}.series.${idx}.plannedHours`,
        `系列「${seriesName}」: 計画時数`,
        unitCol,
        blockEndCol,
        dataFrom,
        dataTo,
      ),
    )
  })

  const subtotal = monthlySubtotalDetection(sheet, `annualPlan.${sheet.name}.monthlySubtotal`, headerRow, dataFrom, dataTo)
  if (subtotal) out.push(subtotal)

  return out
}
