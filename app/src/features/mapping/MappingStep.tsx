import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '../../state/AppStateContext'
import { ALL_FILE_KINDS, CONFIDENCE_LABEL, FILE_KIND_LABELS } from '../../types'
import type { FieldDetection, FileKind, ParsedWorkbook, SheetSnapshot } from '../../types'
import { detectFields } from '../../excel/detect'
import type { DetectionContext } from '../../excel/detect'
import { colLetter } from '../../excel/detectors/shared'
import { parseRangeRef } from '../../excel/rangeUtil'
import type { CellRange } from '../../excel/rangeUtil'

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

/** A live, scrollable view of one sheet's cells, with the currently-selected
 *  detection's range highlighted - so "is this really the 単元名 column?" can
 *  be answered by looking at the sheet instead of trusting 4 sample values. */
function SheetPreview({ sheet, range }: { sheet: SheetSnapshot; range: CellRange | null }) {
  const anchorRef = useRef<HTMLTableCellElement | null>(null)

  useEffect(() => {
    anchorRef.current?.scrollIntoView({ block: 'center', inline: 'center' })
  }, [sheet.name, range?.r0, range?.c0, range?.r1, range?.c1])

  const colCount = Math.max(sheet.colCount, ...sheet.rows.map((r) => r.length))

  return (
    <div className="sheet-preview-scroll">
      <table className="sheet-preview-table">
        <thead>
          <tr>
            <th className="sheet-preview-corner" />
            {Array.from({ length: colCount }).map((_, c) => (
              <th key={c} className="sheet-preview-colhead">
                {colLetter(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.rows.map((row, r) => (
            <tr key={r}>
              <th className="sheet-preview-rowhead">{r + 1}</th>
              {Array.from({ length: colCount }).map((_, c) => {
                const v = row[c]
                const inRange = !!range && r >= range.r0 && r <= range.r1 && c >= range.c0 && c <= range.c1
                const isAnchor = !!range && r === range.r0 && c === range.c0
                return (
                  <td
                    key={c}
                    ref={isAnchor ? anchorRef : undefined}
                    className={inRange ? 'sheet-preview-cell sheet-preview-hit' : 'sheet-preview-cell'}
                  >
                    {v == null ? '' : String(v)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
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

const MIXED_CONTENT_KINDS: FileKind[] = ['outputTemplate']

function FileMappingPanel({ kind, context }: { kind: FileKind; context: DetectionContext }) {
  const { workbooks, mappings, saveMapping } = useAppState()
  const wb = workbooks[kind]
  const existingMapping = mappings[kind]

  const computed = useMemo(() => (wb ? detectFields(wb, context) : []), [wb, context])
  const [items, setItems] = useState<EditableDetection[]>([])
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [expandedSheets, setExpandedSheets] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<{ sheetName: string; rangeRef: string } | null>(null)

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
    setExpandedSheets(new Set())
    setPreview(null)
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

  const toggleExpanded = (sheetName: string) =>
    setExpandedSheets((prev) => {
      const next = new Set(prev)
      if (next.has(sheetName)) next.delete(sheetName)
      else next.add(sheetName)
      return next
    })

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

  const previewSheet = preview ? wb.sheets.find((s) => s.name === preview.sheetName) : undefined
  const previewRange = preview ? parseRangeRef(preview.rangeRef) : null

  return (
    <div className="panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h3>{FILE_KIND_LABELS[kind]}</h3>
        <span className="helptext">元ファイル: {wb.fileName}</span>
      </div>

      {MIXED_CONTENT_KINDS.includes(kind) && (
        <p className="helptext">
          「教科名 / 単元名」の欄には、教科名だけでなく行事名（例:「行事」「学活」）や、分科担当者の予定
          （例:「渡部先生の案による」）が混在します。これは仕様通りの想定内容です。
        </p>
      )}

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

      {previewSheet && (
        <div className="mapping-group">
          <div className="mapping-group-title">
            シートプレビュー: {preview!.sheetName}
            <button type="button" className="btn btn-secondary" style={{ marginLeft: 10 }} onClick={() => setPreview(null)}>
              閉じる
            </button>
          </div>
          <SheetPreview sheet={previewSheet} range={previewRange} />
        </div>
      )}

      {groupBySheet(items).map(([sheetName, group]) => {
        const needsAttention = group.some((i) => !i.acknowledged)
        const isExpanded = needsAttention || expandedSheets.has(sheetName)
        return (
          <div className="mapping-group" key={sheetName}>
            <div className="mapping-group-title">
              シート: {sheetName}
              {!needsAttention && (
                <button type="button" className="btn btn-secondary" style={{ marginLeft: 10 }} onClick={() => toggleExpanded(sheetName)}>
                  {isExpanded ? '折りたたむ' : `すべて確認済み（${group.length}件）- 詳細を見る`}
                </button>
              )}
            </div>
            {isExpanded && (
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
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
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
                                style={{ width: 140, padding: 6, border: '1px solid #c7d0dc', borderRadius: 6 }}
                              />
                            )}
                            {parseRangeRef(item.rangeRef) && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                title="この範囲をシート上で見る"
                                onClick={() => setPreview({ sheetName: item.sheetName, rangeRef: item.rangeRef })}
                              >
                                表示
                              </button>
                            )}
                          </div>
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
            )}
          </div>
        )
      })}

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
  const { workbooks, activeProfile } = useAppState()
  const importedKinds = ALL_FILE_KINDS.filter((k) => workbooks[k])

  const context: DetectionContext = useMemo(
    () => ({
      grade: activeProfile?.grade,
      excludedSubjects: activeProfile?.subjectTeachers.map((st) => st.subject) ?? [],
    }),
    [activeProfile],
  )

  return (
    <div>
      <div className="panel">
        <h2>3. 自動解析結果の確認・対応付け</h2>
        <p className="helptext">
          取り込んだファイルごとに、システムが自動判定したシート・見出し・セル範囲を確認します。
          範囲の横の「表示」ボタンで、実際のシート上のどこを指しているか確認できます。すべて高い確度で
          判定できたシートは折りたたんで表示しているので、確認が必要な項目に集中できます。ここで確定した
          内容は「学校別書式設定」として保存され、次回以降も再利用されます。
        </p>
        {importedKinds.length === 0 && (
          <p className="helptext">まだファイルが取り込まれていません。先に「ファイル取込み」を行ってください。</p>
        )}
      </div>
      {ALL_FILE_KINDS.map((kind) => (
        <FileMappingPanel kind={kind} context={context} key={kind} />
      ))}
    </div>
  )
}
