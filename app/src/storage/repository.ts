// Typed repository built on top of storage/db.ts.
//
// This is the only module the rest of the app should import for
// persistence. It knows the *shape* of what's stored; db.ts only knows
// how to shove records with an `id` in and out of IndexedDB.

import { STORES, dbDelete, dbGet, dbGetAll, dbPut, type Identified } from './db'
import type { ClassProfile, FileKind, FileMapping, ParsedWorkbook } from '../types'

// ---- Class profiles (担当者・学級, per instructions section 5) ----

export async function saveClassProfile(profile: ClassProfile): Promise<void> {
  await dbPut(STORES.classProfiles, profile as ClassProfile & Identified)
}

export async function getClassProfile(id: string): Promise<ClassProfile | undefined> {
  return dbGet<ClassProfile & Identified>(STORES.classProfiles, id)
}

export async function listClassProfiles(): Promise<ClassProfile[]> {
  const rows = await dbGetAll<ClassProfile & Identified>(STORES.classProfiles)
  return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function deleteClassProfile(id: string): Promise<void> {
  await dbDelete(STORES.classProfiles, id)
}

// ---- App-wide small settings (singleton-ish key/value rows) ----

interface AppMetaRow extends Identified {
  value: unknown
}

export async function setAppMeta(key: string, value: unknown): Promise<void> {
  await dbPut(STORES.appMeta, { id: key, value })
}

export async function getAppMeta<T>(key: string): Promise<T | undefined> {
  const row = await dbGet<AppMetaRow>(STORES.appMeta, key)
  return row?.value as T | undefined
}

export async function clearAppMeta(key: string): Promise<void> {
  await dbDelete(STORES.appMeta, key)
}

export const META_KEYS = {
  lastActiveProfileId: 'lastActiveProfileId',
} as const

// ---- School-wide format mappings (学校別書式設定, section 6) ----

interface FileMappingRow extends FileMapping, Identified {}

export async function saveFileMapping(mapping: FileMapping): Promise<void> {
  const row: FileMappingRow = { ...mapping, id: mapping.fileKind }
  await dbPut(STORES.fileMappings, row)
}

export async function getFileMapping(fileKind: FileKind): Promise<FileMapping | undefined> {
  return dbGet<FileMappingRow>(STORES.fileMappings, fileKind)
}

export async function listFileMappings(): Promise<FileMapping[]> {
  return dbGetAll<FileMappingRow>(STORES.fileMappings)
}

// ---- Most recently imported workbook per file kind ----

interface ImportedWorkbookRow extends ParsedWorkbook, Identified {}

export async function saveImportedWorkbook(wb: ParsedWorkbook): Promise<void> {
  const row: ImportedWorkbookRow = { ...wb, id: wb.fileKind }
  await dbPut(STORES.importedWorkbooks, row)
}

export async function getImportedWorkbook(fileKind: FileKind): Promise<ParsedWorkbook | undefined> {
  return dbGet<ImportedWorkbookRow>(STORES.importedWorkbooks, fileKind)
}

export async function listImportedWorkbooks(): Promise<ParsedWorkbook[]> {
  return dbGetAll<ImportedWorkbookRow>(STORES.importedWorkbooks)
}
