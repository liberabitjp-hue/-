import { useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { useAppState } from '../../state/AppStateContext'
import { ALL_FILE_KINDS, FILE_KIND_LABELS } from '../../types'
import type { FileKind } from '../../types'
import { guessFileKind } from '../../excel/detect'
import { getTruncatedSheetNames, parseWorkbookRaw, withFileKind } from '../../excel/workbookReader'
import { checkFileBeforeParse, checkParsedWorkbook, describeParseError } from '../../excel/fileValidation'
import { recordDiagnostic } from '../../diagnostics/diagnosticLog'

const DIAGNOSTIC_STAGE = '②ファイル取込み'

/** エラー画面に、利用者向け説明と開発者向け識別コードを併記する（別紙4.7対応）。
 *  同時に、不具合調査用の診断ログにも記録する（児童名・ファイルの中身は記録しない）。 */
function reportImportError(kind: FileKind, code: string, message: string): { type: 'error'; text: string } {
  recordDiagnostic(`${DIAGNOSTIC_STAGE}（${kind}）`, code, message)
  return { type: 'error', text: `${message}（識別コード: ${code}）` }
}

const FILE_KIND_HINTS: Record<FileKind, string> = {
  outputTemplate: '例: R8月案　５年２組.xlsm（出力先のひな型。マクロ付きでも読み込みだけなら問題ありません）',
  fixedTimetable: '例: R8 固定時間割.xlsx（曜日・校時ごとの固定授業、特別教室、分科の一覧）',
  classHoursEvents: '例: 授業時数･下校予定時刻.xlsx（月ごとのシート、日別の時数・下校時刻・行事）',
  annualPlan: '例: 年間指導計画案（５年）.xlsx（教科ごとのシート、単元名と計画時数）',
  fractionsTable: '例: 【作業補助用】分数一覧_分母1から15.xlsx（進度の分数の入力補助・検証用）',
}

/** These two are living documents that get revised during the year (行事の変更、
 *  分科の異動等）。同じ枠に最新版を取り込み直せば、いつでも差し替えられる。 */
const LIVING_FILE_KINDS: FileKind[] = ['classHoursEvents', 'fixedTimetable']

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP')
}

/** `dataTransfer.files` is usually populated for a real OS file drop, but some
 *  sources (an email attachment, a compressed-folder view, certain Windows
 *  drag sessions) only populate `.items`, where the File must be pulled out
 *  via `getAsFile()`. Try both so a "the UI reacts but nothing loads" drop
 *  isn't silently swallowed. */
function extractDroppedFile(dt: DataTransfer | null): File | undefined {
  if (!dt) return undefined
  if (dt.files && dt.files.length > 0) return dt.files[0]
  if (dt.items) {
    for (let i = 0; i < dt.items.length; i++) {
      const item = dt.items[i]
      if (item.kind === 'file') {
        const f = item.getAsFile()
        if (f) return f
      }
    }
  }
  return undefined
}

export function ImportStep() {
  const { workbooks, mappings, saveWorkbook, setCurrentStep } = useAppState()
  const [busy, setBusy] = useState<FileKind | null>(null)
  const [notice, setNotice] = useState<Partial<Record<FileKind, { type: 'warn' | 'error'; text: string }>>>({})
  const [dragOver, setDragOver] = useState<FileKind | null>(null)
  const inputRefs = useRef<Partial<Record<FileKind, HTMLInputElement | null>>>({})

  const processFile = async (kind: FileKind, file: File) => {
    setBusy(kind)
    setNotice((prev) => ({ ...prev, [kind]: undefined }))
    try {
      // 別紙4.2: 拡張子だけでなく、実際にExcelとして読める見込みがあるかを
      // 解析前に確認する。ここで弾かれた場合、保存処理には一切進まない。
      const preCheck = await checkFileBeforeParse(file)
      if (!preCheck.ok) {
        setNotice((prev) => ({ ...prev, [kind]: reportImportError(kind, preCheck.code!, preCheck.reason!) }))
        return
      }

      let raw: Awaited<ReturnType<typeof parseWorkbookRaw>>
      try {
        raw = await parseWorkbookRaw(file)
      } catch (err) {
        const info = describeParseError(err)
        setNotice((prev) => ({ ...prev, [kind]: reportImportError(kind, info.code, info.message) }))
        return
      }

      const postCheck = checkParsedWorkbook(raw.sheets.length)
      if (!postCheck.ok) {
        setNotice((prev) => ({ ...prev, [kind]: reportImportError(kind, postCheck.code!, postCheck.reason!) }))
        return
      }

      const guessed = guessFileKind(raw.sheets.map((s) => s.name), raw.sheets)
      const wb = withFileKind(raw, kind)
      await saveWorkbook(wb)

      const warnings: string[] = []
      const existingMapping = mappings[kind]
      if (existingMapping && existingMapping.fingerprint !== wb.fingerprint) {
        warnings.push(
          '前回確認したときと表の形（シート名・見出し・列数など）が変わっている可能性があります。「自動解析結果の確認・対応付け」で内容を見直してください。',
        )
      } else if (guessed && guessed !== kind) {
        warnings.push(`このファイルの中身は「${FILE_KIND_LABELS[guessed]}」のように見えます。取込み先が間違っていないか確認してください。`)
      }
      const truncatedSheets = getTruncatedSheetNames(wb)
      if (truncatedSheets.length > 0) {
        warnings.push(
          `一部のシート（${truncatedSheets.join('、')}）は行数・列数が想定より大きいため、一部分だけを読み込みました。表示や判定に影響する場合があります。`,
        )
      }
      if (warnings.length > 0) {
        setNotice((prev) => ({ ...prev, [kind]: { type: 'warn', text: warnings.join(' ') } }))
      }

      // 5つすべて取り込めたら、選択操作を挟まず自動的に確認画面へ進める。
      const nowImportedKinds = new Set(ALL_FILE_KINDS.filter((k) => k === kind || workbooks[k]))
      if (nowImportedKinds.size === ALL_FILE_KINDS.length) {
        setCurrentStep('mapping')
      }
    } catch (err) {
      // ここに来るのは事前検査・解析・分類のいずれにも当てはまらない想定外の失敗のみ。
      const info = describeParseError(err)
      setNotice((prev) => ({
        ...prev,
        [kind]: reportImportError(kind, info.code, info.message),
      }))
    } finally {
      setBusy(null)
    }
  }

  // ファイル選択ダイアログ経由: 選択せずキャンセルした場合は file が undefined になるので、
  // 何もせず静かに終える（エラー表示しない）。
  const handleFilePicked = (kind: FileKind, file: File | undefined) => {
    if (!file) return
    void processFile(kind, file)
  }

  // ドラッグ＆ドロップ経由: ここで file を取り出せなかった場合は、キャンセルではなく
  // 読み取り失敗なので、はっきりエラーを表示する（無反応のまま終わらせない）。
  const handleDrop = (kind: FileKind, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(null)
    const file = extractDroppedFile(e.dataTransfer)
    if (!file) {
      setNotice((prev) => ({
        ...prev,
        [kind]: reportImportError(
          kind,
          'DROP_NO_FILE',
          'ドロップされたファイルを読み取れませんでした。もう一度ドラッグするか、下の「ファイルを選択」からお試しください。',
        ),
      }))
      return
    }
    void processFile(kind, file)
  }

  return (
    <div className="panel">
      <h2>2. ファイル取込み</h2>
      <p className="helptext">
        参照資料と出力先ひな型のExcel/Excelマクロファイルを、それぞれの枠に取り込んでください。ファイルは
        この端末の中だけで読み取り、外部へは送信されません。元のファイルを書き換えることもありません。
      </p>

      {ALL_FILE_KINDS.map((kind) => {
        const wb = workbooks[kind]
        const n = notice[kind]
        return (
          <div
            className={`file-kind-card${wb ? ' imported' : ''}${dragOver === kind ? ' drag-over' : ''}`}
            key={kind}
            onDragEnter={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOver(kind)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
              setDragOver(kind)
            }}
            onDragLeave={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDragOver((prev) => (prev === kind ? null : prev))
            }}
            onDrop={(e) => handleDrop(kind, e)}
          >
            <div className="file-kind-card-head">
              <span className="file-kind-name">{FILE_KIND_LABELS[kind]}</span>
              <span className="file-kind-status">
                {wb
                  ? `取込み済み: ${wb.fileName}（${wb.sheets.length}シート、${formatDateTime(wb.importedAt)} 取込み）`
                  : '未取込み'}
              </span>
            </div>
            <p className="helptext">{FILE_KIND_HINTS[kind]}</p>
            {LIVING_FILE_KINDS.includes(kind) && (
              <p className="helptext">
                この資料は年間を通じて随時更新されます。新しい版が出たら、この枠に取り込み直してください。
                取り込み直すと内容はすべて新しいファイルに置き換わります（表の形が変わった場合は「自動解析結果の
                確認・対応付け」で警告し、確認をやり直せるようにしています）。
              </p>
            )}
            {n && <div className={`notice notice-${n.type}`}>{n.text}</div>}
            <div className="file-kind-dropzone">
              <input
                ref={(el) => {
                  inputRefs.current[kind] = el
                }}
                type="file"
                accept=".xlsx,.xlsm,.xls"
                disabled={busy === kind}
                onChange={(e) => handleFilePicked(kind, e.target.files?.[0])}
              />
              <span className="helptext">ここにファイルをドラッグ＆ドロップしても取り込めます。</span>
              {busy === kind && <span className="helptext"> 読み込み中...</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
