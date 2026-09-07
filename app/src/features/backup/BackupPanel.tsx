import { useRef, useState } from 'react'
import { exportAllData, importAllData } from '../../storage/db'
import type { StoreName, Identified } from '../../storage/db'
import { buildBackupPayload, validateBackupPayload } from '../../storage/backup'

function downloadJson(payload: unknown, filenamePrefix: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  a.href = url
  a.download = `${filenamePrefix}_${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function BackupPanel() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'info' | 'warn' | 'error'; text: string } | null>(null)
  const [preRestoreSnapshot, setPreRestoreSnapshot] = useState<Record<StoreName, Identified[]> | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleExport = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const data = await exportAllData()
      downloadJson(buildBackupPayload(data), '月案アプリ_バックアップ')
      setMessage({ type: 'info', text: 'バックアップファイルを書き出しました。' })
    } catch (err) {
      setMessage({ type: 'error', text: `書き出しに失敗しました: ${(err as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setMessage(null)
    try {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        setMessage({
          type: 'error',
          text: 'ファイルの中身がJSON形式として読み取れませんでした。壊れているか、別の種類のファイルの可能性があります。現在のデータは変更していません。',
        })
        return
      }

      // 現在データへ何も書き込む前に、まず構造を検証する。ここで弾かれた場合は
      // 一切書き込みが起きないので、現在のデータは必ず無事なまま残る。
      const validation = validateBackupPayload(parsed)
      if (!validation.ok) {
        setMessage({
          type: 'error',
          text: `${validation.reason}（現在のデータは変更していません。）`,
        })
        return
      }

      // 復元を実行する前に、現在のデータを自動でバックアップとして書き出しておく。
      // 復元後に問題があれば、このファイルから元に戻せる。あわせて、このセッション中は
      // 「直前の状態に戻す」ボタンでも即座に戻せるようにする。
      const currentSnapshot = await exportAllData()
      downloadJson(buildBackupPayload(currentSnapshot), '月案アプリ_復元前の自動バックアップ')
      setPreRestoreSnapshot(currentSnapshot as Record<StoreName, Identified[]>)

      await importAllData(validation.payload.data)

      const legacyNote = validation.isLegacyFormat
        ? '（旧バージョン形式のバックアップでした。読み込みには対応していますが、可能であれば最新版で書き出し直すことをおすすめします。）'
        : ''
      setMessage({
        type: 'info',
        text: `バックアップを復元しました。ページを再読み込みすると反映されます。復元前の状態は自動的に別ファイルとして書き出し済みです。${legacyNote}`,
      })
    } catch (err) {
      setMessage({ type: 'error', text: `復元に失敗しました: ${(err as Error).message}` })
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleUndo = async () => {
    if (!preRestoreSnapshot) return
    setBusy(true)
    setMessage(null)
    try {
      await importAllData(preRestoreSnapshot)
      setPreRestoreSnapshot(null)
      setMessage({ type: 'info', text: '復元直前の状態に戻しました。ページを再読み込みすると反映されます。' })
    } catch (err) {
      setMessage({ type: 'error', text: `元に戻す処理に失敗しました: ${(err as Error).message}` })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="panel">
      <h3>バックアップ</h3>
      <p className="helptext">
        利用者情報・学級設定・書式設定・確定版などを1つのファイルにまとめて書き出し、別のパソコンに復元できます。
        復元前には、壊れたファイルで現在のデータが失われないよう内容を確認し、現在の状態を自動的に別ファイルへ
        バックアップしてから復元します。
      </p>
      <div className="step-actions">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void handleExport()}>
          バックアップを書き出す
        </button>
        <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
          バックアップから復元する
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            disabled={busy}
            onChange={(e) => void handleImportFile(e.target.files?.[0])}
          />
        </label>
        {preRestoreSnapshot && (
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void handleUndo()}>
            直前の状態に戻す
          </button>
        )}
      </div>
      {message && <div className={`notice notice-${message.type}`}>{message.text}</div>}
    </div>
  )
}
