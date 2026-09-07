import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { ClassProfile, FileKind, FileMapping, ParsedWorkbook, StepId } from '../types'
import { ALL_FILE_KINDS, STEP_IDS } from '../types'
import {
  getAppMeta,
  getClassProfile,
  getFileMapping,
  getImportedWorkbook,
  META_KEYS,
  listClassProfiles,
  saveClassProfile as repoSaveClassProfile,
  saveFileMapping as repoSaveFileMapping,
  saveImportedWorkbook as repoSaveImportedWorkbook,
  setAppMeta,
} from '../storage/repository'

interface AppState {
  loading: boolean
  storageOk: boolean
  profiles: ClassProfile[]
  activeProfile: ClassProfile | null
  workbooks: Partial<Record<FileKind, ParsedWorkbook>>
  mappings: Partial<Record<FileKind, FileMapping>>
  currentStep: StepId
  setCurrentStep: (s: StepId) => void
  saveProfile: (p: ClassProfile) => Promise<void>
  selectProfile: (id: string) => Promise<void>
  saveWorkbook: (wb: ParsedWorkbook) => Promise<void>
  saveMapping: (m: FileMapping) => Promise<void>
  reloadProfiles: () => Promise<void>
}

const Ctx = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [storageOk, setStorageOk] = useState(true)
  const [profiles, setProfiles] = useState<ClassProfile[]>([])
  const [activeProfile, setActiveProfile] = useState<ClassProfile | null>(null)
  const [workbooks, setWorkbooks] = useState<Partial<Record<FileKind, ParsedWorkbook>>>({})
  const [mappings, setMappings] = useState<Partial<Record<FileKind, FileMapping>>>({})
  const [currentStep, setCurrentStep] = useState<StepId>(STEP_IDS[0])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await listClassProfiles()
        const lastId = await getAppMeta<string>(META_KEYS.lastActiveProfileId)
        const active = lastId ? (list.find((p) => p.id === lastId) ?? list[0] ?? null) : (list[0] ?? null)
        const wbEntries = await Promise.all(ALL_FILE_KINDS.map((k) => getImportedWorkbook(k)))
        const mapEntries = await Promise.all(ALL_FILE_KINDS.map((k) => getFileMapping(k)))
        if (cancelled) return
        setProfiles(list)
        setActiveProfile(active)
        const wbMap: Partial<Record<FileKind, ParsedWorkbook>> = {}
        ALL_FILE_KINDS.forEach((k, i) => {
          if (wbEntries[i]) wbMap[k] = wbEntries[i]
        })
        setWorkbooks(wbMap)
        const mapMap: Partial<Record<FileKind, FileMapping>> = {}
        ALL_FILE_KINDS.forEach((k, i) => {
          if (mapEntries[i]) mapMap[k] = mapEntries[i]
        })
        setMappings(mapMap)
      } catch {
        if (!cancelled) setStorageOk(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const reloadProfiles = useCallback(async () => {
    setProfiles(await listClassProfiles())
  }, [])

  const saveProfile = useCallback(async (p: ClassProfile) => {
    await repoSaveClassProfile(p)
    await setAppMeta(META_KEYS.lastActiveProfileId, p.id)
    setActiveProfile(p)
    setProfiles(await listClassProfiles())
  }, [])

  const selectProfile = useCallback(
    async (id: string) => {
      const p = await getClassProfile(id)
      if (p) {
        setActiveProfile(p)
        await setAppMeta(META_KEYS.lastActiveProfileId, id)
      }
    },
    [],
  )

  const saveWorkbook = useCallback(async (wb: ParsedWorkbook) => {
    await repoSaveImportedWorkbook(wb)
    setWorkbooks((prev) => ({ ...prev, [wb.fileKind]: wb }))
  }, [])

  const saveMapping = useCallback(async (m: FileMapping) => {
    await repoSaveFileMapping(m)
    setMappings((prev) => ({ ...prev, [m.fileKind]: m }))
  }, [])

  const value = useMemo<AppState>(
    () => ({
      loading,
      storageOk,
      profiles,
      activeProfile,
      workbooks,
      mappings,
      currentStep,
      setCurrentStep,
      saveProfile,
      selectProfile,
      saveWorkbook,
      saveMapping,
      reloadProfiles,
    }),
    [
      loading,
      storageOk,
      profiles,
      activeProfile,
      workbooks,
      mappings,
      currentStep,
      saveProfile,
      selectProfile,
      saveWorkbook,
      saveMapping,
      reloadProfiles,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAppState(): AppState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider')
  return ctx
}
