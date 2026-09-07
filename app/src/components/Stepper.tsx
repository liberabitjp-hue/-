import { STEP_IDS, STEP_LABELS, STEP_PHASE } from '../types'
import type { StepId } from '../types'
import './Stepper.css'

export type StepStatus = 'done' | 'current' | 'todo' | 'future'

interface Props {
  current: StepId
  statuses: Record<StepId, StepStatus>
  onSelect: (s: StepId) => void
}

export function Stepper({ current, statuses, onSelect }: Props) {
  return (
    <nav className="stepper" aria-label="作成手順">
      <ol>
        {STEP_IDS.map((id, idx) => {
          const status = statuses[id]
          const phase = STEP_PHASE[id]
          return (
            <li key={id} className={`stepper-item stepper-${status}`}>
              <button
                type="button"
                className="stepper-button"
                onClick={() => onSelect(id)}
                aria-current={id === current ? 'step' : undefined}
              >
                <span className="stepper-index">{idx + 1}</span>
                <span className="stepper-label">{STEP_LABELS[id]}</span>
                <span className={`stepper-phase phase-${phase}`}>フェーズ{phase}</span>
                {status === 'done' && <span className="stepper-check" aria-hidden>✓</span>}
                {status === 'future' && <span className="stepper-future-tag">今後実装</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
