// 別紙4.7「診断情報の書出し」対応。
//
// 不具合発生時に開発者が原因を特定しやすくするための、ごく小さな仕組み。
// 記録するのは「いつ・どの処理段階で・どの識別コードのエラーが・どんな日本語
// メッセージで発生したか」というメタ情報のみで、児童名・学級名・元Excelの
// セル内容・ファイルの中身は一切記録しない。ページ内メモリにのみ保持し、
// IndexedDBには保存しない（ページを閉じれば消える）。書き出しは利用者が
// 「診断情報を書き出す」を押した場合だけ発生する。

export interface DiagnosticEntry {
  timestamp: string
  /** 発生した画面・処理段階（例:「②ファイル取込み」「バックアップ復元」）。 */
  stage: string
  /** 開発者向けの短い識別コード（例: FILE_EMPTY, PARSE_PASSWORD_PROTECTED）。 */
  code: string
  /** 利用者向けに実際に表示した日本語メッセージ。 */
  message: string
}

// 際限なく溜め続けない（長時間使っても書き出しファイルが肥大化しないよう上限を設ける）。
const MAX_ENTRIES = 50

let entries: DiagnosticEntry[] = []

export function recordDiagnostic(stage: string, code: string, message: string): void {
  entries.push({ timestamp: new Date().toISOString(), stage, code, message })
  if (entries.length > MAX_ENTRIES) {
    entries = entries.slice(entries.length - MAX_ENTRIES)
  }
}

export function getDiagnosticEntries(): DiagnosticEntry[] {
  return [...entries]
}

export function clearDiagnosticEntries(): void {
  entries = []
}

export interface DiagnosticReport {
  appVersion: string
  userAgent: string
  generatedAt: string
  entryCount: number
  entries: DiagnosticEntry[]
}

export function buildDiagnosticReport(appVersion: string): DiagnosticReport {
  return {
    appVersion,
    userAgent: navigator.userAgent,
    generatedAt: new Date().toISOString(),
    entryCount: entries.length,
    entries: getDiagnosticEntries(),
  }
}

/** 利用者が明示的に操作したときだけファイル化する（自動送信は一切しない）。 */
export function downloadDiagnosticReport(appVersion: string): void {
  const report = buildDiagnosticReport(appVersion)
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  a.href = url
  a.download = `月案アプリ_診断情報_${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
