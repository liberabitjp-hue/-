import type { FieldDetection, ParsedWorkbook, SheetSnapshot } from '../../types'
import { findCell, isBlank, makeDetection, normalize, rangeRef, sampleColumn } from './shared'

const WEEKDAY_RE = /^[月火水木金土日]$/

/** R8 固定時間割 相当: 曜日×校時の固定枠 + 特別教室/分科の固定割当。 */
export function detectFixedTimetable(wb: ParsedWorkbook): FieldDetection[] {
  const out: FieldDetection[] = []
  for (const sheet of wb.sheets) {
    out.push(...detectSheet(sheet))
  }
  return out
}

function detectSheet(sheet: SheetSnapshot): FieldDetection[] {
  const out: FieldDetection[] = []

  // 1. weekday / period index columns.
  const weekdayCounts = new Map<number, number>()
  for (const row of sheet.rows) {
    row.forEach((v, c) => {
      if (WEEKDAY_RE.test(normalize(v))) weekdayCounts.set(c, (weekdayCounts.get(c) ?? 0) + 1)
    })
  }
  const weekdayCol = [...weekdayCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (weekdayCol == null) return out // doesn't look like a fixed-timetable sheet

  const weekdayRows = sheet.rows
    .map((row, r) => (WEEKDAY_RE.test(normalize(row[weekdayCol])) ? r : -1))
    .filter((r) => r >= 0)
  const gridFirstRow = weekdayRows[0]
  const gridLastRow = Math.max(...weekdayRows) + 6 // each weekday block is ~5 periods tall

  out.push(
    makeDetection(
      'fixedTimetable.grid',
      '曜日・校時の並び',
      sheet.name,
      rangeRef(gridFirstRow, weekdayCol, gridLastRow, weekdayCol + 1),
      weekdayRows.slice(0, 5).map((r) => normalize(sheet.rows[r][weekdayCol])),
      'high',
    ),
  )

  // 2. 特別教室 / 分科 header blocks: header text row, room/teacher names one row below.
  // Header text in the wild is often spaced out per character (全角スペース区切り),
  // (each kanji separated by a full-width space), so allow whitespace between every character.
  const specialRoomHeader = findCell(sheet, /特\s*別?\s*教\s*室/, { rowTo: 5 })
  const specialistHeader = findCell(sheet, /^分\s*科$/, { rowTo: 5 })

  if (specialRoomHeader) {
    const nameRow = specialRoomHeader.row + 1
    const endCol = specialistHeader ? specialistHeader.col : sheet.rows[nameRow]?.length ?? 0
    for (let c = specialRoomHeader.col; c < endCol; c++) {
      const name = normalize(sheet.rows[nameRow]?.[c])
      if (!name) continue
      out.push(
        makeDetection(
          `fixedTimetable.specialRoom.${name}`,
          `特別教室固定割当: ${name}`,
          sheet.name,
          rangeRef(gridFirstRow, c, gridLastRow, c),
          sampleColumn(sheet, c, gridFirstRow, gridLastRow),
          'medium',
          '曜日・校時ごとに、この教室を使う学級が入っています。',
        ),
      )
    }
  }

  if (specialistHeader) {
    const nameRow = specialistHeader.row + 1
    let endCol = nameRow < sheet.rows.length ? sheet.rows[nameRow].length : 0
    for (let c = specialistHeader.col; c < endCol; c++) {
      if (isBlank(sheet.rows[nameRow]?.[c]) && c > specialistHeader.col + 6) {
        endCol = c
        break
      }
    }
    for (let c = specialistHeader.col; c < endCol; c++) {
      const name = normalize(sheet.rows[nameRow]?.[c])
      if (!name) continue
      out.push(
        makeDetection(
          `fixedTimetable.specialist.${name}`,
          `分科担当者の固定授業: ${name}`,
          sheet.name,
          rangeRef(gridFirstRow, c, gridLastRow, c),
          sampleColumn(sheet, c, gridFirstRow, gridLastRow),
          'medium',
          '曜日・校時ごとに、この担当者が入っている学級・教科が入っています。',
        ),
      )
    }
  }

  // 学級ごとの分科担当・時数一覧（「分科計画」表）は、確認画面には不要という
  // 利用者からの指示により検出しない（フェーズA仕様修正）。

  return out
}
