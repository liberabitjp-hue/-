import type { FieldDetection, FileKind, ParsedWorkbook } from '../types'
import { detectAnnualPlan } from './detectors/annualPlan'
import { detectClassHoursEvents } from './detectors/classHoursEvents'
import { detectFixedTimetable } from './detectors/fixedTimetable'
import { detectFractionsTable } from './detectors/fractionsTable'
import { detectOutputTemplate } from './detectors/outputTemplate'
import { findAllCells, findCell } from './detectors/shared'

export function detectFields(wb: ParsedWorkbook): FieldDetection[] {
  switch (wb.fileKind) {
    case 'fixedTimetable':
      return detectFixedTimetable(wb)
    case 'classHoursEvents':
      return detectClassHoursEvents(wb)
    case 'annualPlan':
      return detectAnnualPlan(wb)
    case 'outputTemplate':
      return detectOutputTemplate(wb)
    case 'fractionsTable':
      return detectFractionsTable(wb)
  }
}

/** Best-effort guess of which of the 5 file kinds an uploaded workbook is, from its shape alone. */
export function guessFileKind(sheetNames: string[], sheets: ParsedWorkbook['sheets']): FileKind | null {
  // Exact-match, not substring: explanatory text elsewhere ("...分子/分母と入力する")
  // would otherwise false-positive against instructional notes in other files.
  const hasFraction = sheets.some(
    (s) => findCell(s, /^分母$/, { rowTo: 3 }) && findCell(s, /^分数$/, { rowTo: 3 }),
  )
  if (hasFraction) return 'fractionsTable'

  const hasFixedTimetableMarkers = sheets.some(
    (s) => findCell(s, /特別?\s*教室/, { rowTo: 5 }) && findCell(s, /^分\s*科$/, { rowTo: 5 }),
  )
  if (hasFixedTimetableMarkers) return 'fixedTimetable'

  const hasPeriodHeaders = sheets.some((s) => findAllCells(s, /^\d+校時$/, { rowTo: 5 }).length >= 3)
  if (hasPeriodHeaders) return 'outputTemplate'

  const monthSheetCount = sheetNames.filter((n) => /^\d{1,2}月/.test(n)).length
  const hasGradeColumns = sheets.some(
    (s) => findAllCells(s, /^\d{1,2}学年$/, { rowTo: 5 }).length >= 3,
  )
  if (monthSheetCount >= 3 && hasGradeColumns) return 'classHoursEvents'

  const hasUnitHeaders = sheets.filter((s) => findCell(s, /単元|教材名|題材/, { rowTo: 10 })).length
  if (hasUnitHeaders >= 3) return 'annualPlan'

  return null
}
