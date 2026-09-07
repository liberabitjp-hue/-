import { useEffect, useMemo, useState } from 'react'
import { useAppState } from '../../state/AppStateContext'
import { ALL_FILE_KINDS, CONFIDENCE_LABEL, FILE_KIND_LABELS } from '../../types'
import type { FieldDetection, FileKind, ParsedWorkbook } from '../../types'
import { detectFields } from '../../excel/detect'

interface EditableDetection extends FieldDetection {
  acknowledged: boolean
}

/** Freshly computed guesses: only a high/medium confidence guess counts as already reviewed. */
function seedFromComputed(detections: FieldDetection[]): EditableDetection[] {
  return detections.map((d) => ({ ...d, acknowledged: d.confidence === 'high' || d.confidence === 'medium' }))
}

/** Detections loaded from a mapping the user already confirmed once (same file
 *  shape) - confirming them the first time *was* the review, so don't force
 *  re-checking a low-confidence row every time this screen is reopened. */
function seedFromSaved(detections: FieldDetection[]): EditableDetection[] {
  return detections.map((d) => ({ ...d, acknowledged: true }))
}

function groupBySheet(items: EditableDetection[]): [string, EditableDetection[]][] {
  const map = new Map<string, EditableDetection[]>()
  for (const item of items) {
    if (!map.has(item.sheetName)) map.set(item.sheetName, [])
    map.get(item.sheetName)!.push(item)
  }
  return [...map.entries()]
}

function newCustomKey(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function AddCustomRow({ wb, onAdd }: { wb: ParsedWorkbook; onAdd: (d: EditableDetection) => void }) {
  const [sheetName, setSheetName] = useState(wb.sheets[0]?.name ?? '')
  const [label, setLabel] = useState('')
  const [rangeRefValue, setRangeRefValue] = useState('')

  const handleAdd = () => {
    if (!label.trim() || !rangeRefValue.trim()) return
    onAdd({
      key: newCustomKey(),
      label: label.trim(),
      sheetName,
      rangeRef: rangeRefValue.trim(),
      sampleValues: [],
      confidence: 'high',
      custom: true,
      acknowledged: true,
    })
    setLabel('')
    setRangeRefValue('')
  }

  return (
    <div className="subject-teacher-row" style={{ flexWrap: 'wrap' }}>
      <select value={sheetName} onChange={(e) => setSheetName(e.target.value)} style={{ padding: 8, border: '1px solid #c7d0dc', borderRadius: 6 }}>
        {wb.sheets.map((s) => (
          <option key={s.name} value={s.name}>
            {s.name}
          </option>
        ))}
      </select>
      <input
        placeholder="項目名（例: 系列4の単元名）"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        style={{ padding: 8, border: '1px solid #c7d0dc', borderRadius: 6, minWidth: 200 }}
      />
      <input
        placeholder="範囲（例: N9:N62）"
        value={rangeRefValue}
        onChange={(e) => setRangeRefValue(e.target.value)}
        style={{ padding: 8, border: '1px solid #c7d0dc', borderRadius: 6, width: 140 }}
      />
      <button type="button" className="btn btn-secondary" onClick={handleAdd}>
        + 追加
      </button>
    </div>
  )
}

function FileMappingPanel({ kind }: { kind: FileKind }) {
  const { workbooks, mappings, saveMapping } = useAppState()
  const wb = workbooks[kind]
  const existingMapping = mappings[kind]

  const computed = useMemo(() => (wb ? detectFields(wb) : []), [wb])
  const [items, setItems] = useState<EditableDetection[]>([])
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    if (!wb) {
      setItems([])
      return
    }
    if (existingMapping && existingMapping.fingerprint === wb.fingerprint) {
      setItems(seedFromSaved(existingMapping.detections))
    } else {
      setItems(seedFromComputed(computed))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wb?.fingerprint])

  if (!wb) {
    return (
      <div className="panel">
        <h3>{FILE_KIND_LABELS[kind]}</h3>
        <p className="helptext">まだ取り込まれていません。「ファイル取込み」で取り込んでください。</p>
      </div>
    )
  }

  const formatChanged = existingMapping && existingMapping.fingerprint !== wb.fingerprint
  const pendingAck = items.filter((i) => !i.acknowledged)

  const updateItem = (key: string, patch: Partial<EditableDetection>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)))

  const removeItem = (key: string) => setItems((prev) => prev.filter((it) => it.key !== key))

  const handleConfirm = async () => {
    await saveMapping({
      fileKind: kind,
      fingerprint: wb.fingerprint,
      sourceFileName: wb.fileName,
      detections: items.map(({ acknowledged: _a, ...d }) => d),
      confirmedAt: new Date().toISOString(),
    })
    setSavedAt(new Date().toISOString())
  }

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3>{FILE_KIND_LABELS[kind]}</h3>
        <span className="helptext">元ファイル: {wb.fileName}</span>
      </div>

      {formatChanged && (
        <div className="notice notice-warn">
          前回確定した設定と、表の形（シート名・見出し・列数など）が変わっている可能性があります。
          内容をもう一度確認してから確定し直してください。
        </div>
      )}
      {existingMapping && !formatChanged && (
        <div className="notice notice-info">
          この内容は {new Date(existingMapping.confirmedAt).toLocaleString('ja-JP')} に確定済みです。
          必要であれば修正して再確定できます。
        </div>
      )}

      {items.length === 0 && (
        <p className="helptext">
          このファイルから自動判定できる項目が見つかりませんでした。ファイルの中身とファイル種別の対応が正しいか、
          「ファイル取込み」画面で確認してください。下の欄から手動で項目を追加することもできます。
        </p>
      )}

      {groupBySheet(items).map(([sheetName, group]) => (
        <div className="mapping-group" key={sheetName}>
          <div className="mapping-group-title">シート: {sheetName}</div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>項目</th>
                  <th>範囲</th>
                  <th>サンプル値</th>
                  <th>確度</th>
                  <th>確認</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {group.map((item) => (
                  <tr key={item.key}>
                    <td>
                      {item.label}
                      {item.note && <div className="helptext">{item.note}</div>}
                    </td>
                    <td>
                      {item.options && item.options.length > 0 ? (
                        <select
                          value={item.rangeRef}
                          onChange={(e) =>
                            updateItem(item.key, {
                              rangeRef: e.target.value,
                              overridden: true,
                              acknowledged: e.target.value !== '',
                            })
                          }
                          style={{ padding: 6, border: '1px solid #c7d0dc', borderRadius: 6 }}
                        >
                          <option value="">（選んでください）</option>
                          {item.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          value={item.rangeRef}
                          onChange={(e) => updateItem(item.key, { rangeRef: e.target.value, overridden: true })}
                          style={{ width: 160, padding: 6, border: '1px solid #c7d0dc', borderRadius: 6 }}
                        />
                      )}
                    </td>
                    <td>{item.sampleValues.slice(0, 4).join(' / ') || '(なし)'}</td>
                    <td>
                      {item.custom ? (
                        <span className="badge badge-medium">手動</span>
                      ) : (
                        <span className={`badge badge-${item.confidence}`}>{CONFIDENCE_LABEL[item.confidence]}</span>
                      )}
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={item.acknowledged}
                        onChange={(e) => updateItem(item.key, { acknowledged: e.target.checked })}
                      />
                    </td>
                    <td>
                      {item.custom && (
                        <button type="button" className="btn btn-danger" onClick={() => removeItem(item.key)}>
                          削除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      <div className="mapping-group">
        <div className="mapping-group-title">手動で項目を追加</div>
        <p className="helptext">
          自動判定にない項目（例: 教科によって複数ある単元系列の追加分）を、シート・項目名・セル範囲を指定して
          手元で登録できます。
        </p>
        <AddCustomRow wb={wb} onAdd={(d) => setItems((prev) => [...prev, d])} />
      </div>

      {pendingAck.length > 0 && (
        <div className="notice notice-warn">
          確度が「低」または「未検出」の項目、または選択が必要な項目が {pendingAck.length} 件あります。
          内容を確認・選択してから「確認」にチェックを入れてください。
        </div>
      )}
      <div className="step-actions">
        <button type="button" className="btn" disabled={items.length === 0 || pendingAck.length > 0} onClick={handleConfirm}>
          この内容で確定する
        </button>
      </div>
      {savedAt && <p className="helptext">確定しました（{new Date(savedAt).toLocaleString('ja-JP')}）</p>}
    </div>
  )
}

export function MappingStep() {
  const { workbooks } = useAppState()
  const importedKinds = ALL_FILE_KINDS.filter((k) => workbooks[k])

  return (
    <div>
      <div className="panel">
        <h2>3. 自動解析結果の確認・対応付け</h2>
        <p className="helptext">
          取り込んだファイルごとに、システムが自動判定したシート・見出し・セル範囲を確認します。
          サンプル値を見て、内容が正しいか確認してください。確度が「低」「未検出」の項目や、選択式（プルダウン）の
          項目は、内容を選んでから確認済みにしてください。ここで確定した内容は「学校別書式設定」として保存され、
          次回以降も再利用されます。
        </p>
        {importedKinds.length === 0 && (
          <p className="helptext">まだファイルが取り込まれていません。先に「ファイル取込み」を行ってください。</p>
        )}
      </div>
      {ALL_FILE_KINDS.map((kind) => (
        <FileMappingPanel kind={kind} key={kind} />
      ))}
    </div>
  )
}
