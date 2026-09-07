// Turns a raw uploaded file into a ParsedWorkbook: a plain, storable
// snapshot of every sheet's shape and cell values. Nothing here knows
// what a "固定時間割" or "月案" *means* - that's the detectors' job.

import * as XLSX from 'xlsx'
import type { CellValue, FileKind, ParsedWorkbook, SheetSnapshot } from '../types'

// Safety caps so one abnormal sheet can't blow up memory/IndexedDB.
// Every real sample file we inspected fits well inside these.
const MAX_ROWS = 400
const MAX_COLS = 60

function cellToValue(cell: XLSX.CellObject | undefined): CellValue {
  if (!cell) return null
  if (cell.t === 'd') {
    const d = cell.v as Date
    // Times (no meaningful date part) are common in the 授業時数 file's
    // 下校時刻 columns; format both cases as readable Japanese-friendly text.
    const isMidnightEpoch = d.getFullYear() === 1899 || d.getFullYear() === 1900
    if (isMidnightEpoch) {
      const hh = String(d.getHours()).padStart(2, '0')
      const mm = String(d.getMinutes()).padStart(2, '0')
      return `${hh}:${mm}`
    }
    return d.toISOString().slice(0, 10)
  }
  if (cell.t === 'n') return cell.v as number
  if (cell.t === 'b') return cell.v as boolean
  if (cell.t === 's') return String(cell.v)
  return cell.v == null ? null : String(cell.v)
}

function readSheet(ws: XLSX.WorkSheet, name: string): SheetSnapshot {
  const ref = ws['!ref'] ?? 'A1'
  const range = XLSX.utils.decode_range(ref)
  const rowCount = Math.min(range.e.r - range.s.r + 1, MAX_ROWS)
  const colCount = Math.min(range.e.c - range.s.c + 1, MAX_COLS)

  const rows: CellValue[][] = []
  for (let r = 0; r < rowCount; r++) {
    const row: CellValue[] = []
    for (let c = 0; c < colCount; c++) {
      const addr = XLSX.utils.encode_cell({ r: range.s.r + r, c: range.s.c + c })
      row.push(cellToValue(ws[addr]))
    }
    rows.push(row)
  }

  const merges = (ws['!merges'] ?? []).map((m) => XLSX.utils.encode_range(m))

  const hiddenRows: number[] = []
  ;(ws['!rows'] ?? []).forEach((rowInfo, idx) => {
    if (rowInfo?.hidden) hiddenRows.push(idx + 1)
  })

  const hiddenCols: number[] = []
  ;(ws['!cols'] ?? []).forEach((colInfo, idx) => {
    if (colInfo?.hidden) hiddenCols.push(idx + 1)
  })

  return {
    name,
    ref,
    rowCount: range.e.r - range.s.r + 1,
    colCount: range.e.c - range.s.c + 1,
    merges,
    hiddenRows,
    hiddenCols,
    rows,
  }
}

/** Cheap, order-independent hash used only to notice "this file's shape changed". */
export function computeFingerprint(sheets: SheetSnapshot[]): string {
  const parts = sheets
    .map((s) => `${s.name}|${s.ref}|${s.merges.length}|${s.hiddenRows.length}|${s.hiddenCols.length}`)
    .sort()
  const input = parts.join('\n')
  let h1 = 0xdeadbeef ^ input.length
  let h2 = 0x41c6ce57 ^ input.length
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16)
}

/** Parses the file's structure only; the caller attaches a FileKind afterwards
 *  (confirmed or overridden by the user), since guessing the kind needs the
 *  parsed sheets first. */
export async function parseWorkbookRaw(
  file: File,
): Promise<Omit<ParsedWorkbook, 'fileKind'>> {
  const buf = await file.arrayBuffer()
  const wb = XLSX.read(buf, { type: 'array', cellDates: true, cellNF: false })
  const sheets = wb.SheetNames.map((name) => readSheet(wb.Sheets[name], name))
  return {
    fileName: file.name,
    fingerprint: computeFingerprint(sheets),
    sheets,
    importedAt: new Date().toISOString(),
  }
}

export function withFileKind(
  raw: Omit<ParsedWorkbook, 'fileKind'>,
  fileKind: FileKind,
): ParsedWorkbook {
  return { ...raw, fileKind }
}

/** True if this sheet's real dimensions exceeded the MAX_ROWS/MAX_COLS sampling
 *  cap - `rowCount`/`colCount` hold the sheet's real size, while `rows` holds
 *  only the (possibly smaller) sampled window. 別紙4.2「使用範囲が異常に
 *  大きい場合は…説明する」への対応: 事故防止のため上限で打ち切ってはいるが、
 *  黙って切り詰めるのではなく利用者に知らせる。 */
export function isSheetTruncated(sheet: ParsedWorkbook['sheets'][number]): boolean {
  const sampledRows = sheet.rows.length
  const sampledCols = sheet.rows[0]?.length ?? 0
  return sheet.rowCount > sampledRows || sheet.colCount > sampledCols
}

/** Names of every sheet in the workbook whose real size exceeded the sampling cap. */
export function getTruncatedSheetNames(wb: ParsedWorkbook): string[] {
  return wb.sheets.filter(isSheetTruncated).map((s) => s.name)
}
