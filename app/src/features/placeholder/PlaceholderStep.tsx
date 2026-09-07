import { STEP_LABELS, STEP_PHASE } from '../../types'
import type { StepId } from '../../types'
import { BackupPanel } from '../backup/BackupPanel'

const PHASE_DESCRIPTIONS: Record<string, string> = {
  B: 'フェーズB（生成ロジック）で実装予定です。授業日・授業時数・行事の抽出、固定時間割の反映、前月パターンの抽出、予定時数との照合を行い、初期案を自動作成します。',
  C: 'フェーズC（単元・分科）で実装予定です。年間指導計画からの単元・進度の割当、分科資料（Excel/CSV/PDF）の取込みと確認を行います。',
  D: 'フェーズD（編集・出力）で実装予定です。月案のドラッグ&ドロップ編集、固定・再調整、警告表示、E4:Q65相当とAL4:AL65相当の値コピー、TSV代替出力を行います。',
}

export function PlaceholderStep({ stepId }: { stepId: StepId }) {
  const phase = STEP_PHASE[stepId]
  return (
    <div>
      <div className="panel future-panel">
        <h2>
          {STEP_LABELS[stepId]} <span className="helptext">（フェーズ{phase} - 未実装）</span>
        </h2>
        <p className="helptext">{PHASE_DESCRIPTIONS[phase]}</p>
        <p className="helptext">
          現在の試作版はフェーズA（基盤：担当学級設定・ファイル取込み・自動解析結果の確認）までを実装しています。
          このステップは画面構成の確認用に用意してあり、次のフェーズで機能を追加していきます。
        </p>
      </div>
      {stepId === 'finalize' && <BackupPanel />}
    </div>
  )
}
