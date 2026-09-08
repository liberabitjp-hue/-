import type { FieldDetection, FileKind, ParsedWorkbook } from '../types'
import { detectAnnualPlan } from './detectors/annualPlan'
import { detectClassHoursEvents } from './detectors/classHoursEvents'
import { detectFixedTimetable } from './detectors/fixedTimetable'
import { detectFractionsTable } from './detectors/fractionsTable'
import { detectOutputTemplate } from './detectors/outputTemplate'
import { findAllCells, findCell } from './detectors/shared'

/** Bump this whenever a detector's logic changes in a way that would produce
 *  different FieldDetection output for the same file (a new filter, a fixed
 *  bug, a new field). A FileMapping saved under an older version is treated
 *  as stale even if the file's own fingerprint hasn't changed, so an app
 *  update is never silently masked by a previously-confirmed mapping. */
export const DETECTOR_VERSION = 2

/** Context from the active class profile (step 1), used to narrow what the
 *  mapping screen shows: no need to review other grades' columns, or the
 *  unit plan for a subject someone else teaches. */
export interface DetectionContext {
  grade?: string
  /** Subject names (as registered in 分科教科と担当者) the homeroom teacher does NOT teach. */
  excludedSubjects?: string[]
}

export function detectFields(wb: ParsedWorkbook, context: DetectionContext = {}): FieldDetection[] {
  switch (wb.fileKind) {
    case 'fixedTimetable':
      return detectFixedTimetable(wb)
    case 'classHoursEvents':
      return detectClassHoursEvents(wb, context)
    case 'annualPlan':
      return detectAnnualPlan(wb, context)
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

  // Header text in this school's files is often spaced out per character
  // (each kanji separated by a full-width space), same as detectors/fixedTimetable.ts -
  // keep this regex in sync with that one (a real file failed to guess until this was fixed).
  const hasFixedTimetableMarkers = sheets.some(
    (s) => findCell(s, /特\s*別?\s*教\s*室/, { rowTo: 5 }) && findCell(s, /^分\s*科$/, { rowTo: 5 }),
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
