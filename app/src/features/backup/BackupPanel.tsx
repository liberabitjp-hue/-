import { useRef, useState } from 'react'
import { exportAllData, importAllData } from '../../storage/db'

const BACKUP_VERSION = 1

export function BackupPanel() {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleExport = async () => {
    setBusy(true)
    setMessage(null)
    try {
      const data = await exportAllData()
      const payload = { backupVersion: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      a.href = url
      a.download = `月案アプリ_バックアップ_${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setMessage('バックアップファイルを書き出しました。')
    } catch (err) {
      setMessage(`書き出しに失敗しました: ${(err as Error).message}`)
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
      const payload = JSON.parse(text) as { data: Parameters<typeof importAllData>[0] }
      await importAllData(payload.data)
      setMessage('バックアップを復元しました。ページを再読み込みすると反映されます。')
    } catch (err) {
      setMessage(`復元に失敗しました: ${(err as Error).message}`)
    } finally {
      setBusy(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="panel">
      <h3>バックアップ</h3>
      <p className="helptext">
        利用者情報・学級設定・書式設定・確定版などを1つのファイルにまとめて書き出し、別のパソコンに復元できます。
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
      </div>
      {message && <p className="helptext">{message}</p>}
    </div>
  )
}
