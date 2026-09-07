import { useEffect, useState } from 'react'
import { useAppState } from '../../state/AppStateContext'
import type { ClassProfile, SubjectTeacher } from '../../types'

function makeId(fiscalYear: number, grade: string, className: string): string {
  return `${fiscalYear}-${grade.trim()}-${className.trim()}`
}

export function ProfileStep() {
  const { activeProfile, profiles, saveProfile, selectProfile, setCurrentStep } = useAppState()

  const [fiscalYear, setFiscalYear] = useState<number>(new Date().getFullYear())
  const [grade, setGrade] = useState('')
  const [className, setClassName] = useState('')
  const [teacherName, setTeacherName] = useState('')
  const [subjectTeachers, setSubjectTeachers] = useState<SubjectTeacher[]>([])
  const [savedAt, setSavedAt] = useState<string | null>(null)

  useEffect(() => {
    if (activeProfile) {
      setFiscalYear(activeProfile.fiscalYear)
      setGrade(activeProfile.grade)
      setClassName(activeProfile.className)
      setTeacherName(activeProfile.teacherName)
      setSubjectTeachers(activeProfile.subjectTeachers)
    }
  }, [activeProfile])

  const addSubjectTeacher = () => setSubjectTeachers((prev) => [...prev, { subject: '', teacherName: '' }])
  const updateSubjectTeacher = (idx: number, patch: Partial<SubjectTeacher>) =>
    setSubjectTeachers((prev) => prev.map((st, i) => (i === idx ? { ...st, ...patch } : st)))
  const removeSubjectTeacher = (idx: number) =>
    setSubjectTeachers((prev) => prev.filter((_, i) => i !== idx))

  const canSave = grade.trim() !== '' && className.trim() !== '' && teacherName.trim() !== ''

  const handleSave = async () => {
    const id = makeId(fiscalYear, grade, className)
    const now = new Date().toISOString()
    const profile: ClassProfile = {
      id,
      fiscalYear,
      grade: grade.trim(),
      className: className.trim(),
      teacherName: teacherName.trim(),
      subjectTeachers: subjectTeachers.filter((st) => st.subject.trim() !== ''),
      createdAt: activeProfile?.id === id ? activeProfile.createdAt : now,
      updatedAt: now,
    }
    await saveProfile(profile)
    setSavedAt(now)
    // 入力が完了したら、選択を待たず次の段階（ファイル取込み）へ自動で進める。
    setCurrentStep('import')
  }

  const handleNewClass = () => {
    setGrade('')
    setClassName('')
    setTeacherName('')
    setSubjectTeachers([])
    setSavedAt(null)
  }

  return (
    <div className="panel">
      <h2>1. 利用者・担当学級設定</h2>
      <p className="helptext">
        年度・学年・組・担任名を登録します。学年・学級数は固定していないので、必要な数だけ登録できます。
        前回使った学級は次回起動時に自動で表示されます。
      </p>

      {profiles.length > 0 && (
        <div className="field-row" style={{ maxWidth: 480 }}>
          <label htmlFor="profile-switch">登録済みの学級から切り替え</label>
          <select
            id="profile-switch"
            value={activeProfile?.id ?? ''}
            onChange={(e) => {
              if (e.target.value) void selectProfile(e.target.value)
            }}
          >
            <option value="">（新しい学級を登録）</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.fiscalYear}年度 {p.grade}学年{p.className}組 - {p.teacherName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="inline-fields">
        <div className="field-row">
          <label htmlFor="year">年度</label>
          <input
            id="year"
            type="number"
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
          />
        </div>
        <div className="field-row">
          <label htmlFor="grade">学年</label>
          <input id="grade" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="例: 5" />
        </div>
        <div className="field-row">
          <label htmlFor="class">組</label>
          <input id="class" value={className} onChange={(e) => setClassName(e.target.value)} placeholder="例: 2" />
        </div>
      </div>

      <div className="field-row">
        <label htmlFor="teacher">担任名</label>
        <input id="teacher" value={teacherName} onChange={(e) => setTeacherName(e.target.value)} placeholder="例: 山田 太郎" />
      </div>

      <h3>分科教科と担当者（必要な場合のみ）</h3>
      <p className="helptext">
        理科・音楽・書写・外国語など、担任以外が受け持つ教科があれば登録してください。あとで分科資料を取り込むときに使います。
      </p>
      {subjectTeachers.map((st, idx) => (
        <div className="subject-teacher-row" key={idx}>
          <input
            placeholder="教科名（例: 理科）"
            value={st.subject}
            onChange={(e) => updateSubjectTeacher(idx, { subject: e.target.value })}
            style={{ padding: 8, border: '1px solid #c7d0dc', borderRadius: 6 }}
          />
          <input
            placeholder="担当者名"
            value={st.teacherName}
            onChange={(e) => updateSubjectTeacher(idx, { teacherName: e.target.value })}
            style={{ padding: 8, border: '1px solid #c7d0dc', borderRadius: 6 }}
          />
          <button type="button" className="btn btn-danger" onClick={() => removeSubjectTeacher(idx)}>
            削除
          </button>
        </div>
      ))}
      <button type="button" className="btn btn-secondary" onClick={addSubjectTeacher}>
        + 分科教科を追加
      </button>

      <div className="step-actions">
        <button type="button" className="btn" disabled={!canSave} onClick={handleSave}>
          この学級を保存する
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleNewClass}>
          新しい学級を登録する
        </button>
      </div>
      {savedAt && <p className="helptext">保存しました（{new Date(savedAt).toLocaleString('ja-JP')}）</p>}
    </div>
  )
}
