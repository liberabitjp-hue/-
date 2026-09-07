// Pre/post-parse checks for uploaded files (別紙4.2「ファイル取込み時の事前検査」).
//
// The goal is narrow: never let a bad file crash the screen or silently
// corrupt saved state. Real diagnosis of "is this really a 固定時間割?" is
// the detectors' job (section 6) - this module only answers "can this file
// even be read as a spreadsheet at all, safely".

export interface FileCheckResult {
  ok: boolean
  reason?: string
  /** 開発者向けの短い識別コード（別紙4.7「診断情報の書出し」対応）。ok:false の場合のみ持つ。 */
  code?: string
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50MB - every real sample file is a few MB at most
const MAX_SHEET_COUNT = 200 // real files top out around 32 sheets; this is a generous sanity ceiling

// xlsx/xlsm are zip archives (signature "PK"); the legacy .xls binary format
// is an OLE2 compound file with this fixed 8-byte signature.
const ZIP_SIGNATURE = [0x50, 0x4b]
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]

function matchesSignature(head: Uint8Array, sig: number[]): boolean {
  return sig.every((b, i) => head[i] === b)
}

/** Cheap checks that don't require actually parsing the file - catches the
 *  common failure modes (empty file, huge file, not really an Excel file)
 *  before handing anything to SheetJS. */
export async function checkFileBeforeParse(file: File): Promise<FileCheckResult> {
  if (file.size === 0) {
    return { ok: false, code: 'FILE_EMPTY', reason: '空のファイルです（サイズが0バイト）。中身のあるExcelファイルを選択してください。' }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return {
      ok: false,
      code: 'FILE_TOO_LARGE',
      reason: `ファイルサイズが大きすぎます（${mb}MB、上限50MB）。対象のファイルで間違いないか確認してください。`,
    }
  }

  const headBytes = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const looksLikeExcel = matchesSignature(headBytes, ZIP_SIGNATURE) || matchesSignature(headBytes, OLE_SIGNATURE)
  if (!looksLikeExcel) {
    return {
      ok: false,
      code: 'FILE_NOT_EXCEL',
      reason:
        'Excelファイルとして認識できませんでした。拡張子がxlsx/xlsm/xlsであっても、中身が異なる形式（テキストファイル等）の可能性があります。',
    }
  }

  return { ok: true }
}

/** Checked after a successful parse, before the workbook is saved anywhere. */
export function checkParsedWorkbook(sheetCount: number): FileCheckResult {
  if (sheetCount === 0) {
    return { ok: false, code: 'SHEET_NONE', reason: 'このファイルにはシートが1つもありませんでした。対象のシートが含まれるファイルか確認してください。' }
  }
  if (sheetCount > MAX_SHEET_COUNT) {
    return {
      ok: false,
      code: 'SHEET_TOO_MANY',
      reason: `シート数が異常に多い（${sheetCount}枚）ファイルです。想定外のファイルの可能性があるため、取込みを中止しました。`,
    }
  }
  return { ok: true }
}

export interface ParseErrorInfo {
  code: string
  message: string
}

/** Turns a raw (often English, SheetJS-internal) parse error into a plain
 *  Japanese explanation, plus a short developer-facing code (別紙4.7対応).
 *  Falls back to including the original message so a genuinely new failure
 *  mode is still diagnosable, just not user-friendly. */
export function describeParseError(err: unknown): ParseErrorInfo {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  if (lower.includes('password') || lower.includes('encrypt')) {
    return {
      code: 'PARSE_PASSWORD_PROTECTED',
      message: 'このファイルはパスワードで保護されているため読み込めません。パスワードを解除してから取り込んでください。',
    }
  }
  if (lower.includes('corrupt') || lower.includes('central directory') || lower.includes('zip')) {
    return {
      code: 'PARSE_CORRUPTED',
      message: 'ファイルが破損している可能性があります。Excelで開き直して保存し直すか、別のファイルでお試しください。',
    }
  }
  if (lower.includes('unsupported') || lower.includes('unrecognized') || lower.includes('cannot find')) {
    return {
      code: 'PARSE_UNSUPPORTED_FORMAT',
      message: 'この形式は読み込みに対応していません。Excel形式（.xlsx/.xlsm/.xls）で保存し直してください。',
    }
  }
  return {
    code: 'PARSE_UNKNOWN',
    message: `読み込み中に問題が発生しました（詳細: ${message}）。ファイルが壊れていないか確認するか、別のファイルでお試しください。`,
  }
}
