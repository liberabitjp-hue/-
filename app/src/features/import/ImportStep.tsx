import { useRef, useState } from 'react'
import { useAppState } from '../../state/AppStateContext'
import { ALL_FILE_KINDS, FILE_KIND_LABELS } from '../../types'
import type { FileKind } from '../../types'
import { guessFileKind } from '../../excel/detect'
import { parseWorkbookRaw, withFileKind } from '../../excel/workbookReader'

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

export function ImportStep() {
  const { workbooks, mappings, saveWorkbook } = useAppState()
  const [busy, setBusy] = useState<FileKind | null>(null)
  const [notice, setNotice] = useState<Partial<Record<FileKind, { type: 'warn' | 'error'; text: string }>>>({})
  const inputRefs = useRef<Partial<Record<FileKind, HTMLInputElement | null>>>({})

  const handleFile = async (kind: FileKind, file: File | undefined) => {
    if (!file) return
    setBusy(kind)
    setNotice((prev) => ({ ...prev, [kind]: undefined }))
    try {
      const raw = await parseWorkbookRaw(file)
      const guessed = guessFileKind(raw.sheets.map((s) => s.name), raw.sheets)
      const wb = withFileKind(raw, kind)
      await saveWorkbook(wb)

      const existingMapping = mappings[kind]
      if (existingMapping && existingMapping.fingerprint !== wb.fingerprint) {
        setNotice((prev) => ({
          ...prev,
          [kind]: {
            type: 'warn',
            text: '前回確認したときと表の形（シート名・見出し・列数など）が変わっている可能性があります。「自動解析結果の確認・対応付け」で内容を見直してください。',
          },
        }))
      } else if (guessed && guessed !== kind) {
        setNotice((prev) => ({
          ...prev,
          [kind]: {
            type: 'warn',
            text: `このファイルの中身は「${FILE_KIND_LABELS[guessed]}」のように見えます。取込み先が間違っていないか確認してください。`,
          },
        }))
      }
    } catch (err) {
      setNotice((prev) => ({
        ...prev,
        [kind]: { type: 'error', text: `読み込みに失敗しました: ${(err as Error).message}` },
      }))
    } finally {
      setBusy(null)
    }
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
          <div className={`file-kind-card${wb ? ' imported' : ''}`} key={kind}>
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
            <div>
              <input
                ref={(el) => {
                  inputRefs.current[kind] = el
                }}
                type="file"
                accept=".xlsx,.xlsm,.xls"
                disabled={busy === kind}
                onChange={(e) => void handleFile(kind, e.target.files?.[0])}
              />
              {busy === kind && <span className="helptext"> 読み込み中...</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
