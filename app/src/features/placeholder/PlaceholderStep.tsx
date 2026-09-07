import { STEP_LABELS, STEP_PHASE } from '../../types'
import type { StepId } from '../../types'
import { BackupPanel } from '../backup/BackupPanel'

const PHASE_DESCRIPTIONS: Record<string, string> = {
  B: 'フェーズB（生成ロジック）で実装予定です。授業日・授業時数・行事の抽出、固定時間割の反映、前月パターンの抽出、予定時数との照合を行い、初期案を自動作成します。',
  C: 'フェーズC（単元・分科）で実装予定です。年間指導計画からの単元・進度の割当、分科資料（Excel/CSV/PDF）の取込みと確認を行います。',
  D: 'フェーズD（編集・出力）で実装予定です。月案のドラッグ&ドロップ編集、固定・再調整、警告表示、E4:Q65相当とAL4:AL65相当の値コピー、TSV代替出力を行います。',
}

/** 別紙4.4「確定前の一括検証」の予定内容。実際の検証には自動配置後の月案データ
 *  （フェーズB）が必要なため、現時点ではまだ計算できない。ここでは、実装済み
 *  になったときの動作を先に画面上で説明し、利用者が受入条件を確認できるように
 *  しておく（docs/assumptions.md「別紙4.4対応」参照）。 */
const CRITICAL_VALIDATIONS = [
  '日ごとの授業可能時数を超えていないか',
  '行事・分科・特別教室の固定条件が重複していないか',
  'T列相当の予定時数と、実際に配置した時数が一致しているか',
  '単元進度に欠番・重複・分母を超えた値がないか',
  '出力対象の行数・列数が想定どおりか',
]
const ADVISORY_VALIDATIONS = [
  '担任の配置希望を満たせていない箇所がないか',
  '前月の傾向と異なる配置になっていないか',
  '推定で補った配置（確定情報がない枠）が含まれていないか',
  '実施校時が指定されていない行事が含まれていないか',
]

/** 別紙4.5「安全な値コピーのプレビュー」の予定内容。コピー対象は自動配置・編集後の
 *  月案データ（フェーズB・D）そのものであり、現時点ではまだ存在しない。ここでは、
 *  実装済みになったときの動作を先に画面上で説明しておく
 *  （docs/assumptions.md「別紙4.5対応」参照）。 */
const COPY_REQUIREMENTS = [
  'E4:Q65相当（教科名・進度・単元名・備考等）とAL4:AL65相当（下校予定時刻）を別々のボタンでコピーする',
  'コピー前に、行数・列数・貼付開始セル・空白セルの位置を画面上で確認できる',
  '数式・書式・マクロは対象に含めず、値だけをコピーする',
  '分数は文字列として保持し、日付へ変換しない',
  'Clipboard APIが使えない環境では、TSVダウンロードまたは選択可能な表で代替する',
  'コピー操作によって元のExcelファイルをアプリ側から変更することはない',
]

/** 別紙4.6「利用範囲と保証範囲の表示」。自動作成画面・確定画面の両方に表示する
 *  固定の注記（ローカル単独版であることの限界を利用者に誤解させないため）。
 *  受入条件が「自動作成画面と確定画面の両方で確認できる」ことなので、
 *  'generate'と'finalize'の双方に同じ内容を出す。 */
function ScopeNotice() {
  return (
    <div className="notice notice-info">
      <p style={{ margin: '0 0 4px' }}>このアプリの利用範囲・保証範囲（別紙4.6）</p>
      <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
        <li>この版は、担任が翌月の月案・学習予定表を作成する作業を支援するためのものです。</li>
        <li>他学級・他教員・特別教室の最新の使用状況を自動で取得することはありません。</li>
        <li>競合の検査は、取り込んだ固定時間割・分科資料などの範囲内で行います。</li>
        <li>最終的な確定前には、必ず担当者ご自身の目で内容をご確認ください。</li>
      </ul>
    </div>
  )
}

interface Props {
  stepId: StepId
  /** 別紙4.3「低確度・未検出の項目がある状態では、自動作成を開始できない」に対応した判定。
   *  'generate'（自動作成の実行状況）ステップでのみ意味を持つ。 */
  canStartGeneration?: boolean
  importedCount?: number
  mappingConfirmedCount?: number
  totalKinds?: number
}

export function PlaceholderStep({ stepId, canStartGeneration, importedCount, mappingConfirmedCount, totalKinds }: Props) {
  const phase = STEP_PHASE[stepId]
  return (
    <div>
      {stepId === 'generate' && (
        <div className={`notice ${canStartGeneration ? 'notice-info' : 'notice-warn'}`}>
          {canStartGeneration ? (
            <>自動作成を開始するための前提条件（ファイル取込み・対応付けの確認）はすべて満たされています。生成ロジックはフェーズ2で実装予定です。</>
          ) : (
            <>
              自動作成を開始するには、②ですべてのファイル（{totalKinds}点）を取り込み、③ですべての自動解析結果を
              確認・確定してください（別紙4.3「低確度・未検出の項目がある状態では自動作成を開始できない」への対応）。
              現在: ファイル取込み {importedCount}/{totalKinds}件、対応付け確定 {mappingConfirmedCount}/{totalKinds}件。
            </>
          )}
        </div>
      )}
      {(stepId === 'generate' || stepId === 'finalize') && <ScopeNotice />}
      <div className="panel future-panel">
        <h2>
          {STEP_LABELS[stepId]} <span className="helptext">（フェーズ{phase} - 未実装）</span>
        </h2>
        <p className="helptext">{PHASE_DESCRIPTIONS[phase]}</p>
        <p className="helptext">
          現在の試作版はフェーズA（基盤：担当学級設定・ファイル取込み・自動解析結果の確認）までを実装しています。
          このステップは画面構成の確認用に用意してあり、次のフェーズで機能を追加していきます。
        </p>
        {stepId === 'checks' && (
          <>
            <p className="helptext">
              自動作成された月案データ（フェーズB）が無いと実際の検証はできないため、この画面自体はまだ動作しません。
              実装されたときは、以下を確認し、重大エラーが1件でも残っている間は確定できないようにする予定です
              （別紙4.4「確定前の一括検証」）。
            </p>
            <p className="helptext" style={{ fontWeight: 600 }}>重大エラー（確定を無効化）</p>
            <ul className="helptext">
              {CRITICAL_VALIDATIONS.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
            <p className="helptext" style={{ fontWeight: 600 }}>注意事項（確認済みにできる。確定は妨げない）</p>
            <ul className="helptext">
              {ADVISORY_VALIDATIONS.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </>
        )}
        {stepId === 'finalize' && (
          <>
            <p className="helptext">
              元Excelへの値コピー機能（下記のバックアップ機能とは別の、月案完成後の出力機能）は、コピー対象となる
              月案データ自体がフェーズB（自動作成）・フェーズD（編集）を経てできあがるため、この画面自体はまだ
              動作しません。実装されたときは、以下を満たす予定です（別紙4.5「安全な値コピーのプレビュー」）。
            </p>
            <ul className="helptext">
              {COPY_REQUIREMENTS.map((v) => (
                <li key={v}>{v}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      {stepId === 'finalize' && <BackupPanel />}
    </div>
  )
}
