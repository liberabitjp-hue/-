// Backup payload shape, versioning, and validation - kept separate from
// db.ts (which only knows how to shove records in and out of IndexedDB).
//
// This exists to satisfy 別紙4.1「変更前スナップショットと復元」:
//   - 保存データにschemaVersion・アプリ版・保存日時を持たせる
//   - 復元前に、渡されたバックアップの構造を検証する
//   - 読み込めない/壊れたバックアップで現在データを上書きしない
//
// Validation happens BEFORE any IndexedDB write, so a rejected backup never
// touches the current data - partial corruption (some stores overwritten,
// others not) is the failure mode this specifically closes off.

import { STORES } from './db'
import type { Identified, StoreName } from './db'

/** Bump this when a stored record's *shape* changes in a way that would break
 *  an older reader (renaming/removing a field a validator or repository
 *  relies on). Purely additive changes (a new optional field) don't need a bump. */
export const CURRENT_SCHEMA_VERSION = 1

/** A short, human-meaningful build label - not a strict semver, just enough
 *  to tell "this backup came from a noticeably different version of the app"
 *  when diagnosing a problem. Bump when the phase/feature set changes. */
export const APP_VERSION = 'phase1-2026.09'

export interface BackupPayload {
  schemaVersion: number
  appVersion: string
  exportedAt: string
  data: Partial<Record<StoreName, Identified[]>>
}

export type BackupValidation =
  | { ok: true; payload: BackupPayload; isLegacyFormat: boolean }
  | { ok: false; reason: string }

const KNOWN_STORES = new Set<string>(Object.values(STORES))

/** Checks the *shape* of a parsed backup JSON before anything is written to
 *  IndexedDB. Unknown top-level keys inside `data` (e.g. from a future store
 *  this version doesn't know about) are ignored rather than rejected, so an
 *  older app version can still restore a newer backup's compatible parts. */
export function validateBackupPayload(raw: unknown): BackupValidation {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: 'ファイルの中身がバックアップの形式（JSONオブジェクト）ではありません。' }
  }
  const obj = raw as Record<string, unknown>

  const rawData = obj.data
  if (typeof rawData !== 'object' || rawData === null || Array.isArray(rawData)) {
    return { ok: false, reason: '「data」の項目が見つからないか、形式が正しくありません。バックアップファイルではない可能性があります。' }
  }

  const cleanedData: Partial<Record<StoreName, Identified[]>> = {}
  for (const [key, value] of Object.entries(rawData as Record<string, unknown>)) {
    if (!KNOWN_STORES.has(key)) continue // 将来の項目・不明な項目は無視する（拒否しない）
    if (!Array.isArray(value)) {
      return { ok: false, reason: `「${key}」の中身が一覧（配列）になっていません。ファイルが壊れている可能性があります。` }
    }
    for (const row of value) {
      if (typeof row !== 'object' || row === null || typeof (row as Record<string, unknown>).id !== 'string') {
        return { ok: false, reason: `「${key}」の中に、idを持たないデータが含まれています。ファイルが壊れている可能性があります。` }
      }
    }
    cleanedData[key as StoreName] = value as Identified[]
  }

  // 旧形式(このアプリの初期バックアップ)は schemaVersion がなく、代わりに
  // backupVersion という項目名だった。両方に対応し、互換読み込みとする。
  const hasSchemaVersion = typeof obj.schemaVersion === 'number'
  const legacyVersion = typeof obj.backupVersion === 'number' ? obj.backupVersion : undefined
  const schemaVersion = hasSchemaVersion ? (obj.schemaVersion as number) : (legacyVersion ?? 0)
  const isLegacyFormat = !hasSchemaVersion

  const appVersion = typeof obj.appVersion === 'string' ? obj.appVersion : '不明（旧バージョンのバックアップ）'
  const exportedAt = typeof obj.exportedAt === 'string' ? obj.exportedAt : ''

  return {
    ok: true,
    isLegacyFormat,
    payload: { schemaVersion, appVersion, exportedAt, data: cleanedData },
  }
}

export function buildBackupPayload(data: Record<StoreName, unknown[]>): BackupPayload {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: new Date().toISOString(),
    data: data as Partial<Record<StoreName, Identified[]>>,
  }
}
