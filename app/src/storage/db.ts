// Minimal IndexedDB wrapper.
//
// Kept deliberately dumb (get/put/getAll/delete over a handful of object
// stores) so that later this whole file can be swapped for a call to a
// school-network or cloud API without touching any generation/UI code
// (instructions section 18: "時間割作成ロジックから保存処理を分離する",
// section 23: 保存を分離). Everything else in the app talks to storage
// only through storage/repository.ts, never to IndexedDB directly.

const DB_NAME = 'gakushu-yotei-db'
const DB_VERSION = 1

export const STORES = {
  classProfiles: 'classProfiles',
  appMeta: 'appMeta',
  fileMappings: 'fileMappings',
  importedWorkbooks: 'importedWorkbooks',
} as const

export type StoreName = (typeof STORES)[keyof typeof STORES]

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('このブラウザ環境では端末内保存(IndexedDB)が利用できません。'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of Object.values(STORES)) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name, { keyPath: 'id' })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDBを開けませんでした。'))
  })
  return dbPromise
}

function withStore<T>(
  storeName: StoreName,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode)
        const store = tx.objectStore(storeName)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error ?? new Error('保存処理でエラーが発生しました。'))
      }),
  )
}

/** Every record stored via this module must carry a string `id`. */
export interface Identified {
  id: string
}

export async function dbPut<T extends Identified>(storeName: StoreName, value: T): Promise<void> {
  await withStore(storeName, 'readwrite', (s) => s.put(value))
}

export async function dbGet<T extends Identified>(
  storeName: StoreName,
  id: string,
): Promise<T | undefined> {
  return withStore<T | undefined>(storeName, 'readonly', (s) => s.get(id))
}

export async function dbGetAll<T extends Identified>(storeName: StoreName): Promise<T[]> {
  return withStore<T[]>(storeName, 'readonly', (s) => s.getAll())
}

export async function dbDelete(storeName: StoreName, id: string): Promise<void> {
  await withStore(storeName, 'readwrite', (s) => s.delete(id))
}

/** Whether IndexedDB is usable in the current context (e.g. file:// origins can vary). */
export async function isStorageAvailable(): Promise<boolean> {
  try {
    await openDb()
    return true
  } catch {
    return false
  }
}

/** Dump every store into one plain object, for backup export (section 18). */
export async function exportAllData(): Promise<Record<StoreName, unknown[]>> {
  const result = {} as Record<StoreName, unknown[]>
  for (const name of Object.values(STORES)) {
    result[name] = await dbGetAll(name)
  }
  return result
}

/** Restore a dump produced by exportAllData(). Overwrites existing records with the same id. */
export async function importAllData(data: Partial<Record<StoreName, Identified[]>>): Promise<void> {
  for (const name of Object.values(STORES)) {
    const rows = data[name]
    if (!rows) continue
    for (const row of rows) {
      await dbPut(name, row)
    }
  }
}
