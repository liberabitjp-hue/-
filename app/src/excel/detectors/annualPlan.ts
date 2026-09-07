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

function detectSheet(sheet: SheetSnapshot): FieldDetection[] {
  const out: FieldDetection[] = []
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
  let dataTo = sheet.rows.length - 1
  for (let r = dataFrom; r < sheet.rows.length; r++) {
    if (compact(sheet.rows[r]?.[0]) === '合計' || sheet.rows[r]?.some((v) => compact(v) === '合計')) {
      dataTo = r - 1
      break
    }
  }

  // 月 column: usually column A on the header row.
  const monthCol = findCell(sheet, /^月$/, { rowFrom: headerRow, rowTo: headerRow, colTo: 2 })?.col ?? 0
  out.push(
    makeDetection(
      `annualPlan.${sheet.name}.month`,
      '月',
      sheet.name,
      rangeRef(dataFrom, monthCol, dataTo, monthCol),
      sampleColumn(sheet, monthCol, dataFrom, dataTo).filter((v) => !isBlank(v)),
      'high',
    ),
  )

  // 単元名 column: prefer the header's own column, but fall back to a nearby
  // mostly-text column if the header column itself is mostly empty in the data
  // rows (this happens on this school's 学活 sheet, for example).
  let unitCol = unitHeader.col
  const headerColCoverage = textCoverageRatio(sheet, unitCol, dataFrom, dataTo)
  let unitConfidence: FieldDetection['confidence'] = 'high'
  let unitNote: string | undefined
  if (headerColCoverage < 0.3) {
    let bestCol = unitCol
    let bestCoverage = headerColCoverage
    for (let c = unitCol + 1; c <= Math.min(unitCol + 4, sheet.rows[headerRow].length - 1); c++) {
      const coverage = textCoverageRatio(sheet, c, dataFrom, dataTo)
      if (coverage > bestCoverage) {
        bestCoverage = coverage
        bestCol = c
      }
    }
    unitCol = bestCol
    unitConfidence = bestCoverage >= 0.5 ? 'medium' : 'low'
    unitNote = '見出しの列にはデータが少なかったため、近くの列を候補にしています。必ず内容を確認してください。'
  }
  out.push(
    makeDetection(
      `annualPlan.${sheet.name}.unitName`,
      '単元名',
      sheet.name,
      rangeRef(dataFrom, unitCol, dataTo, unitCol),
      sampleColumn(sheet, unitCol, dataFrom, dataTo).filter((v) => !isBlank(v)),
      unitConfidence,
      unitNote,
    ),
  )

  // 計画時数 column: scan a few columns after the unit column for the best numeric fit.
  let hoursCol: number | null = null
  let bestRatio = 0
  for (let c = unitCol + 1; c <= Math.min(unitCol + 5, (sheet.rows[headerRow]?.length ?? 1) - 1); c++) {
    const ratio = numericRatio(sheet, c, dataFrom, dataTo)
    if (ratio > bestRatio) {
      bestRatio = ratio
      hoursCol = c
    }
  }
  if (hoursCol != null && bestRatio > 0) {
    out.push(
      makeDetection(
        `annualPlan.${sheet.name}.plannedHours`,
        '単元ごとの計画時数',
        sheet.name,
        rangeRef(dataFrom, hoursCol, dataTo, hoursCol),
        sampleColumn(sheet, hoursCol, dataFrom, dataTo).filter((v) => !isBlank(v)),
        bestRatio > 0.7 ? 'high' : bestRatio > 0.3 ? 'medium' : 'low',
        '進度（1/6, 2/6...）の分母として使う時数です。内容が違う場合は列を選び直してください。',
      ),
    )
  } else {
    out.push(
      makeDetection(
        `annualPlan.${sheet.name}.plannedHours`,
        '単元ごとの計画時数',
        sheet.name,
        '(未検出)',
        [],
        'none',
        '数値の列が見つかりませんでした。手動で列を指定してください。',
      ),
    )
  }

  const hoursHeader = findCell(sheet, /^時数$/, { rowFrom: headerRow, rowTo: headerRow })
  if (hoursHeader) {
    out.push(
      makeDetection(
        `annualPlan.${sheet.name}.monthlySubtotal`,
        '月別小計時数（参考）',
        sheet.name,
        rangeRef(dataFrom, hoursHeader.col, dataTo, hoursHeader.col),
        sampleColumn(sheet, hoursHeader.col, dataFrom, dataTo).filter((v) => !isBlank(v)),
        'high',
      ),
    )
  }

  return out
}
