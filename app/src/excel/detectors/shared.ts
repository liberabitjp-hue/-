// Small building blocks shared by every per-file-kind detector.
//
// The guiding rule (instructions section 6.1): never hard-code a cell
// address. Every detector below finds things by scanning header *text*
// and value *shape*, then reports what it found with a confidence level
// so the human can correct it on the mapping screen.

import type { CellValue, Confidence, FieldDetection, SheetSnapshot } from '../../types'

const FULLWIDTH_DIGITS: Record<string, string> = {
  '０': '0', '１': '1', '２': '2', '３': '3', '４': '4',
  '５': '5', '６': '6', '７': '7', '８': '8', '９': '9',
}

/** Full-width digits -> half-width, trims whitespace. Leaves other chars alone. */
export function normalize(v: CellValue): string {
  if (v == null) return ''
  const s = String(v).trim()
  return s.replace(/[０-９]/g, (d) => FULLWIDTH_DIGITS[d] ?? d)
}

export function isBlank(v: CellValue): boolean {
  return v == null || String(v).trim() === ''
}

export function colLetter(col0: number): string {
  let n = col0 + 1
  let s = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    s = String.fromCharCode(65 + rem) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

export function cellRef(row0: number, col0: number): string {
  return `${colLetter(col0)}${row0 + 1}`
}

export function rangeRef(r0: number, c0: number, r1: number, c1: number): string {
  return `${cellRef(r0, c0)}:${cellRef(r1, c1)}`
}

/** First {row,col} (0-based) whose normalized text matches `re`, within an optional row window. */
export function findCell(
  sheet: SheetSnapshot,
  re: RegExp,
  opts: { rowFrom?: number; rowTo?: number; colFrom?: number; colTo?: number } = {},
): { row: number; col: number; text: string } | null {
  const rowFrom = opts.rowFrom ?? 0
  const rowTo = Math.min(opts.rowTo ?? sheet.rows.length - 1, sheet.rows.length - 1)
  for (let r = rowFrom; r <= rowTo; r++) {
    const rowValues = sheet.rows[r]
    if (!rowValues) continue
    const colFrom = opts.colFrom ?? 0
    const colTo = Math.min(opts.colTo ?? rowValues.length - 1, rowValues.length - 1)
    for (let c = colFrom; c <= colTo; c++) {
      const text = normalize(rowValues[c])
      if (text && re.test(text)) return { row: r, col: c, text }
    }
  }
  return null
}

/** All {row,col} matches of `re`, within an optional row window. */
export function findAllCells(
  sheet: SheetSnapshot,
  re: RegExp,
  opts: { rowFrom?: number; rowTo?: number; colFrom?: number; colTo?: number } = {},
): { row: number; col: number; text: string }[] {
  const rowFrom = opts.rowFrom ?? 0
  const rowTo = Math.min(opts.rowTo ?? sheet.rows.length - 1, sheet.rows.length - 1)
  const out: { row: number; col: number; text: string }[] = []
  for (let r = rowFrom; r <= rowTo; r++) {
    const rowValues = sheet.rows[r]
    if (!rowValues) continue
    const colFrom = opts.colFrom ?? 0
    const colTo = Math.min(opts.colTo ?? rowValues.length - 1, rowValues.length - 1)
    for (let c = colFrom; c <= colTo; c++) {
      const text = normalize(rowValues[c])
      if (text && re.test(text)) out.push({ row: r, col: c, text })
    }
  }
  return out
}

/** Up to `limit` non-blank, stringified sample values from a column, starting at rowFrom. */
export function sampleColumn(
  sheet: SheetSnapshot,
  col: number,
  rowFrom: number,
  rowTo: number,
  limit = 5,
): string[] {
  const out: string[] = []
  for (let r = rowFrom; r <= Math.min(rowTo, sheet.rows.length - 1) && out.length < limit; r++) {
    const v = sheet.rows[r]?.[col]
    if (!isBlank(v)) out.push(String(v))
  }
  return out
}

/** Fraction of non-blank cells in [rowFrom,rowTo] on `col` that are finite numbers. */
export function numericRatio(sheet: SheetSnapshot, col: number, rowFrom: number, rowTo: number): number {
  let total = 0
  let numeric = 0
  for (let r = rowFrom; r <= Math.min(rowTo, sheet.rows.length - 1); r++) {
    const v = sheet.rows[r]?.[col]
    if (isBlank(v)) continue
    total++
    if (typeof v === 'number') numeric++
  }
  return total === 0 ? 0 : numeric / total
}

export function makeDetection(
  key: string,
  label: string,
  sheetName: string,
  rangeRefStr: string,
  sampleValues: string[],
  confidence: Confidence,
  note?: string,
): FieldDetection {
  return { key, label, sheetName, rangeRef: rangeRefStr, sampleValues, confidence, note }
}
