import { Stepper } from './components/Stepper'
import type { StepStatus } from './components/Stepper'
import { useAppState } from './state/AppStateContext'
import { ALL_FILE_KINDS, STEP_IDS, STEP_PHASE } from './types'
import type { StepId } from './types'
import { DETECTOR_VERSION } from './excel/detect'
import { ProfileStep } from './features/profile/ProfileStep'
import { ImportStep } from './features/import/ImportStep'
import { MappingStep } from './features/mapping/MappingStep'
import { PlaceholderStep } from './features/placeholder/PlaceholderStep'
import { APP_VERSION } from './storage/backup'
import { downloadDiagnosticReport } from './diagnostics/diagnosticLog'

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

function StepContent({
  stepId,
  canStartGeneration,
  importedCount,
  mappingConfirmedCount,
  totalKinds,
}: {
  stepId: StepId
  canStartGeneration: boolean
  importedCount: number
  mappingConfirmedCount: number
  totalKinds: number
}) {
  switch (stepId) {
    case 'profile':
      return <ProfileStep />
    case 'import':
      return <ImportStep />
    case 'mapping':
      return <MappingStep />
    case 'generate':
      return (
        <PlaceholderStep
          stepId={stepId}
          canStartGeneration={canStartGeneration}
          importedCount={importedCount}
          mappingConfirmedCount={mappingConfirmedCount}
          totalKinds={totalKinds}
        />
      )
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
    return wb && m && m.fingerprint === wb.fingerprint && m.detectorVersion === DETECTOR_VERSION
  }).length

  const statuses = computeStatuses(
    currentStep,
    !!activeProfile,
    importedCount,
    ALL_FILE_KINDS.length,
    mappingConfirmedCount,
  )

  // 別紙4.3「低確度・未検出の項目がある状態では、自動作成を開始できない」への対応。
  // ③の各ファイルの「確定する」操作自体は既に低確度項目のチェックを強制しているが、
  // それはファイル単位の保存操作を止めるだけで、画面遷移そのものは③を経由せず
  // ④以降へ自由に移動できてしまう。フェーズ2（生成ロジック）実装時にこの判定を
  // 使い回せるよう、ここで一箇所にまとめて算出しておく。
  const canStartGeneration = importedCount === ALL_FILE_KINDS.length && mappingConfirmedCount === ALL_FILE_KINDS.length

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
        <div className="app-sidebar-footer">
          <button type="button" className="btn btn-secondary" onClick={() => downloadDiagnosticReport(APP_VERSION)}>
            診断情報を書き出す
          </button>
          <p className="helptext">
            不具合が起きたときの原因調査用です。児童名・学級名・元Excelの内容は含まれません。押した場合のみファイルが作成されます（別紙4.7）。
          </p>
        </div>
      </aside>
      <main className={`app-main${currentStep === 'mapping' ? ' app-main-wide' : ''}`}>
        <StepContent
          stepId={currentStep}
          canStartGeneration={canStartGeneration}
          importedCount={importedCount}
          mappingConfirmedCount={mappingConfirmedCount}
          totalKinds={ALL_FILE_KINDS.length}
        />
      </main>
    </div>
  )
}
