import type { FieldDetection, ParsedWorkbook } from '../../types'
import { findCell, makeDetection, rangeRef, sampleColumn } from './shared'

/** 【作業補助用】分数一覧 相当: 分母 / 分数 の2列だけの単純な対応表。 */
export function detectFractionsTable(wb: ParsedWorkbook): FieldDetection[] {
  const out: FieldDetection[] = []
  for (const sheet of wb.sheets) {
    const denomHeader = findCell(sheet, /^分母$/, { rowTo: 4 })
    const fracHeader = findCell(sheet, /^分数$/, { rowTo: 4 })
    if (!denomHeader && !fracHeader) continue

    if (denomHeader) {
      const last = lastNonBlankRow(sheet, denomHeader.col, denomHeader.row + 1)
      out.push(
        makeDetection(
          'fractionsTable.denominator',
          '分母',
          sheet.name,
          rangeRef(denomHeader.row + 1, denomHeader.col, last, denomHeader.col),
          sampleColumn(sheet, denomHeader.col, denomHeader.row + 1, last),
          'high',
        ),
      )
    }
    if (fracHeader) {
      const last = lastNonBlankRow(sheet, fracHeader.col, fracHeader.row + 1)
      out.push(
        makeDetection(
          'fractionsTable.fraction',
          '分数（文字列）',
          sheet.name,
          rangeRef(fracHeader.row + 1, fracHeader.col, last, fracHeader.col),
          sampleColumn(sheet, fracHeader.col, fracHeader.row + 1, last),
          'high',
          '分数はExcel上で日付等に誤変換されないよう、文字列として保持されている想定です。',
        ),
      )
    }
  }
  return out
}

function lastNonBlankRow(sheet: ParsedWorkbook['sheets'][number], col: number, from: number): number {
  let last = from
  for (let r = from; r < sheet.rows.length; r++) {
    if (sheet.rows[r]?.[col] != null && String(sheet.rows[r][col]).trim() !== '') last = r
  }
  return last
}
