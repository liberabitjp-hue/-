import { Stepper } from './components/Stepper'
import type { StepStatus } from './components/Stepper'
import { useAppState } from './state/AppStateContext'
import { ALL_FILE_KINDS, STEP_IDS, STEP_PHASE } from './types'
import type { StepId } from './types'
import { ProfileStep } from './features/profile/ProfileStep'
import { ImportStep } from './features/import/ImportStep'
import { MappingStep } from './features/mapping/MappingStep'
import { PlaceholderStep } from './features/placeholder/PlaceholderStep'

function computeStatuses(
  currentStep: StepId,
  hasProfile: boolean,
  importedCount: number,
  totalKinds: number,
  mappingConfirmedCount: number,
): Record<StepId, StepStatus> {
  const statuses = {} as Record<StepId, StepStatus>
  for (const id of STEP_IDS) {
    if (id === currentStep) {
      statuses[id] = 'current'
      continue
    }
    if (STEP_PHASE[id] !== 'A') {
      statuses[id] = 'future'
      continue
    }
    if (id === 'profile') statuses[id] = hasProfile ? 'done' : 'todo'
    else if (id === 'import') statuses[id] = importedCount >= totalKinds ? 'done' : 'todo'
    else if (id === 'mapping') statuses[id] = mappingConfirmedCount >= importedCount && importedCount > 0 ? 'done' : 'todo'
    else statuses[id] = 'todo'
  }
  return statuses
}

function StepContent({ stepId }: { stepId: StepId }) {
  switch (stepId) {
    case 'profile':
      return <ProfileStep />
    case 'import':
      return <ImportStep />
    case 'mapping':
      return <MappingStep />
    default:
      return <PlaceholderStep stepId={stepId} />
  }
}

export default function App() {
  const { loading, storageOk, activeProfile, workbooks, mappings, currentStep, setCurrentStep } = useAppState()

  if (loading) {
    return (
      <div className="app-main">
        <p>読み込み中...</p>
      </div>
    )
  }

  const importedCount = ALL_FILE_KINDS.filter((k) => workbooks[k]).length
  const mappingConfirmedCount = ALL_FILE_KINDS.filter((k) => {
    const wb = workbooks[k]
    const m = mappings[k]
    return wb && m && m.fingerprint === wb.fingerprint
  }).length

  const statuses = computeStatuses(
    currentStep,
    !!activeProfile,
    importedCount,
    ALL_FILE_KINDS.length,
    mappingConfirmedCount,
  )

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-title">
          月案・時間割作成支援アプリ
          <small>試作版（フェーズA）</small>
        </div>
        {!storageOk && (
          <div className="notice notice-error">
            この端末保存機能(IndexedDB)が使えないため、設定を保存できません。別のブラウザ、または通常のウィンドウでお試しください。
          </div>
        )}
        {activeProfile && (
          <div className="notice notice-info">
            現在の学級: {activeProfile.fiscalYear}年度 {activeProfile.grade}学年{activeProfile.className}組（
            {activeProfile.teacherName}）
          </div>
        )}
        <Stepper current={currentStep} statuses={statuses} onSelect={setCurrentStep} />
      </aside>
      <main className="app-main">
        <StepContent stepId={currentStep} />
      </main>
    </div>
  )
}
