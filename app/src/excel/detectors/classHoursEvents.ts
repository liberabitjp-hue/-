import type { FieldDetection, ParsedWorkbook, SheetSnapshot } from '../../types'
import type { DetectionContext } from '../detect'
import { findCell, isBlank, makeDetection, normalize, rangeRef, sampleColumn } from './shared'

/** 授業時数･下校予定時刻 相当: 月ごとのシートから、日/曜/学年別時数/下校時刻/行事等を検出する。
 *  学年別の列は、担当学級の学年（context.grade）だけを表示する。全学年分を見せても
 *  確認の手間が増えるだけで、他学年の列は使わないため（利用者からの指示）。 */
export function detectClassHoursEvents(wb: ParsedWorkbook, context: DetectionContext = {}): FieldDetection[] {
  const out: FieldDetection[] = []

  const monthOf = (sheet: SheetSnapshot): number | null => {
    const fromName = /^(\d{1,2})\s*月/.exec(sheet.name)
    if (fromName) return Number(fromName[1])
    const cell = findCell(sheet, /^\d{1,2}月/, { rowTo: 3 })
    if (cell) return Number(/\d{1,2}/.exec(cell.text)?.[0])
    return null
  }

  // Pick one representative, well-formed sheet to detect the shared column layout from.
  const representative = wb.sheets.find((s) => findCell(s, /^曜$/, { rowTo: 5 }))
  if (representative) {
    out.push(...detectColumns(representative, context.grade))
  }

  // Which sheet is the real timetable for each calendar month? This file commonly
  // contains revised duplicates (e.g. "5月", "5月 (2)"), and which one is current
  // is a judgment call the system cannot make reliably - so every month with more
  // than one candidate sheet is left unselected (no default) and must be chosen
  // by the user; a month with exactly one candidate needs no choice.
  const byMonth = new Map<number, SheetSnapshot[]>()
  for (const sheet of wb.sheets) {
    const m = monthOf(sheet)
    if (m == null) continue
    if (!byMonth.has(m)) byMonth.set(m, [])
    byMonth.get(m)!.push(sheet)
  }
  for (const m of [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3]) {
    const sheets = byMonth.get(m)
    if (!sheets || sheets.length === 0) {
      out.push(
        makeDetection(
          `classHoursEvents.monthSheet.${m}`,
          `${m}月に使うシート`,
          wb.fileName,
          '',
          [],
          'none',
          'この月のシートが見つかりませんでした。ファイルの中身を確認してください。',
        ),
      )
      continue
    }
    if (sheets.length === 1) {
      out.push(
        makeDetection(
          `classHoursEvents.monthSheet.${m}`,
          `${m}月に使うシート`,
          wb.fileName,
          sheets[0].name,
          [sheets[0].name],
          'high',
        ),
      )
      continue
    }
    const detection = makeDetection(
      `classHoursEvents.monthSheet.${m}`,
      `${m}月に使うシート`,
      wb.fileName,
      '',
      sheets.map((s) => s.name),
      'low',
      `${sheets.length}件の候補シートが見つかりました。どれが正しい最新版か選んでください（自動では決めません）。`,
    )
    detection.options = sheets.map((s) => s.name)
    out.push(detection)
  }

  return out
}

const GRADE_RE = /^(\d{1,2})学年$/

function detectColumns(sheet: SheetSnapshot, grade?: string): FieldDetection[] {
  const out: FieldDetection[] = []
  const headerRowIdx = findCell(sheet, /^曜$/, { rowTo: 5 })?.row
  if (headerRowIdx == null) return out
  const headerRow = sheet.rows[headerRowIdx]

  const dayCol = findCell(sheet, /^日$/, { rowFrom: headerRowIdx, rowTo: headerRowIdx })?.col
  const dataFrom = headerRowIdx + 1
  const noteRow = findCell(sheet, /留意点/, { rowFrom: dataFrom, colTo: 1 })?.row
  const dataTo = (noteRow ?? dataFrom + 32) - 1
  const targetGrade = grade?.trim()

  if (dayCol != null) {
    out.push(
      makeDetection('classHoursEvents.day', '日付', sheet.name, rangeRef(dataFrom, dayCol, dataTo, dayCol + 1), sampleColumn(sheet, dayCol, dataFrom, dataTo), 'high'),
    )
  }

  headerRow.forEach((v, c) => {
    const m = GRADE_RE.exec(normalize(v))
    if (!m) return
    const grade = m[1]
    if (targetGrade && grade !== targetGrade) return // 担当学年のみ表示
    out.push(
      makeDetection(
        `classHoursEvents.hours.${grade}`,
        `第${grade}学年 授業時数`,
        sheet.name,
        rangeRef(dataFrom, c, dataTo, c),
        sampleColumn(sheet, c, dataFrom, dataTo),
        'high',
      ),
    )
    out.push(
      makeDetection(
        `classHoursEvents.dismissal.${grade}`,
        `第${grade}学年 下校予定時刻`,
        sheet.name,
        rangeRef(dataFrom, c + 1, dataTo, c + 1),
        sampleColumn(sheet, c + 1, dataFrom, dataTo),
        'high',
      ),
    )
  })

  // Header text in this school's files is sometimes spaced out per character
  // (each kanji separated by a full-width space), so allow whitespace between every character.
  for (const [re, key, label] of [
    [/特\s*別\s*日\s*程/, 'specialSchedule', '特別日程・短縮日程'],
    [/給\s*食/, 'lunch', '給食'],
    [/行\s*事/, 'events', '行事と備考'],
  ] as const) {
    const cell = findCell(sheet, re, { rowFrom: headerRowIdx, rowTo: headerRowIdx })
    if (!cell) continue
    out.push(
      makeDetection(
        `classHoursEvents.${key}`,
        label,
        sheet.name,
        rangeRef(dataFrom, cell.col, dataTo, cell.col),
        sampleColumn(sheet, cell.col, dataFrom, dataTo, 3).filter((s) => !isBlank(s)),
        'high',
      ),
    )
  }

  return out
}
