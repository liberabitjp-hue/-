// Domain model shared across the app.
//
// This file intentionally holds *only* plain data shapes - no logic - so
// that storage, parsing, generation and UI code can all depend on it
// without depending on each other (see instructions section 23,
// "将来拡張を妨げない設計": ファイル解析 / 学校別マッピング / 時間割生成 /
// 制約評価 / 単元進度管理 / 画面表示・編集 / 保存 / 出力 を分離する).

/** The five reference file categories this app knows how to read. */
export type FileKind =
  | 'fixedTimetable' // R8 固定時間割.xlsx 相当
  | 'classHoursEvents' // 授業時数･下校予定時刻.xlsx 相当
  | 'annualPlan' // 年間指導計画案.xlsx 相当
  | 'outputTemplate' // 出力先ひな型（月案 .xlsm）相当
  | 'fractionsTable' // 分数一覧（作業補助用）相当

export const FILE_KIND_LABELS: Record<FileKind, string> = {
  fixedTimetable: '固定時間割',
  classHoursEvents: '授業時数･下校予定時刻',
  annualPlan: '年間指導計画',
  outputTemplate: '出力先ひな型（月案）',
  fractionsTable: '分数一覧（作業補助用）',
}

export const ALL_FILE_KINDS: FileKind[] = [
  'outputTemplate',
  'fixedTimetable',
  'classHoursEvents',
  'annualPlan',
  'fractionsTable',
]

/** A single subject taught by someone other than the homeroom teacher. */
export interface SubjectTeacher {
  subject: string
  teacherName: string
}

/** 担当者・学級 (instructions section 5). */
export interface ClassProfile {
  id: string
  fiscalYear: number // 年度 (和暦でも西暦でも、入力そのまま数値として保持)
  grade: string // 学年。数値に固定しない（複式学級名等もあり得るため文字列）
  className: string // 組
  teacherName: string
  subjectTeachers: SubjectTeacher[]
  createdAt: string
  updatedAt: string
}

export type Confidence = 'high' | 'medium' | 'low' | 'none'

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: '高',
  medium: '中',
  low: '低',
  none: '未検出',
}

export type CellValue = string | number | boolean | null

/** A read-only snapshot of one worksheet, sampled up to a safety cap. */
export interface SheetSnapshot {
  name: string
  ref: string
  rowCount: number
  colCount: number
  merges: string[]
  hiddenRows: number[]
  hiddenCols: number[]
  /** rows[r][c] – 0-based into the sampled window (r=0 is sheet row 1, c=0 is column A). */
  rows: CellValue[][]
}

/** The full result of reading one uploaded workbook. */
export interface ParsedWorkbook {
  fileName: string
  fileKind: FileKind
  /** Hash of sheet names + dims + merge counts, used to detect format drift. */
  fingerprint: string
  sheets: SheetSnapshot[]
  importedAt: string
}

/** One field the system auto-detected, shown to the user for review (section 6.2). */
export interface FieldDetection {
  key: string
  label: string
  sheetName: string
  rangeRef: string
  sampleValues: string[]
  confidence: Confidence
  note?: string
  /** True once the user has manually edited this detection away from the guess. */
  overridden?: boolean
  /** When set, the mapping screen renders a dropdown of these choices instead of a
   *  free-text range box (e.g. "which sheet is this month's real timetable?"),
   *  and `rangeRef` holds the selected option. */
  options?: string[]
  /** True for a row the user added by hand (not system-detected). Always shown as
   *  already reviewed, and removable from the mapping screen. */
  custom?: boolean
}

/** The confirmed, saved mapping for one file kind ("学校別書式設定"). */
export interface FileMapping {
  fileKind: FileKind
  fingerprint: string
  sourceFileName: string
  detections: FieldDetection[]
  confirmedAt: string
}

export const STEP_IDS = [
  'profile',
  'import',
  'mapping',
  'preferences',
  'specialists',
  'generate',
  'edit',
  'checks',
  'finalize',
] as const

export type StepId = (typeof STEP_IDS)[number]

export const STEP_LABELS: Record<StepId, string> = {
  profile: '利用者・担当学級設定',
  import: 'ファイル取込み',
  mapping: '自動解析結果の確認・対応付け',
  preferences: '担任希望設定',
  specialists: '分科資料の取込み・確認',
  generate: '自動作成の実行状況',
  edit: '月案の確認・修正',
  checks: '時数・競合チェック',
  finalize: '確定・コピー・バックアップ',
}

/** Which phase (A-D, per instructions section 22) each step belongs to. */
export const STEP_PHASE: Record<StepId, 'A' | 'B' | 'C' | 'D'> = {
  profile: 'A',
  import: 'A',
  mapping: 'A',
  preferences: 'B',
  specialists: 'C',
  generate: 'B',
  edit: 'D',
  checks: 'B',
  finalize: 'D',
}
