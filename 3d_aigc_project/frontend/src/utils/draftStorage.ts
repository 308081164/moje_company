/** 草稿元数据（localStorage）与二进制资源（IndexedDB） */

export const DRAFT_META_KEY = 'generation-drafts-meta'
export const DRAFT_DB_NAME = 'generation-drafts'
export const DRAFT_BLOB_STORE = 'blobs'
export const MAX_DRAFTS = 10

export interface StoredFileMeta {
  name: string
  type: string
  lastModified?: number
}

export interface DraftMeta {
  id: string
  title: string
  updatedAt: number
  stageSummary: string
  uploadMode: 'single' | 'sheet' | 'multi'
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DRAFT_DB_NAME, 1)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 打开失败'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(DRAFT_BLOB_STORE)) {
        db.createObjectStore(DRAFT_BLOB_STORE)
      }
    }
  })
}

export function readDraftMetaList(): DraftMeta[] {
  try {
    const raw = localStorage.getItem(DRAFT_META_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as DraftMeta[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeDraftMetaList(list: DraftMeta[]): void {
  localStorage.setItem(DRAFT_META_KEY, JSON.stringify(list))
}

export async function putDraftBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_BLOB_STORE, 'readwrite')
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error ?? new Error('IndexedDB 写入失败'))
    }
    tx.objectStore(DRAFT_BLOB_STORE).put(blob, key)
  })
}

export async function getDraftBlob(key: string): Promise<Blob | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_BLOB_STORE, 'readonly')
    tx.onerror = () => {
      db.close()
      reject(tx.error ?? new Error('IndexedDB 读取失败'))
    }
    const req = tx.objectStore(DRAFT_BLOB_STORE).get(key)
    req.onsuccess = () => {
      db.close()
      resolve((req.result as Blob | undefined) ?? null)
    }
    req.onerror = () => {
      db.close()
      reject(req.error ?? new Error('IndexedDB 读取失败'))
    }
  })
}

export async function deleteDraftBlobs(keys: string[]): Promise<void> {
  if (!keys.length) return
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_BLOB_STORE, 'readwrite')
    const store = tx.objectStore(DRAFT_BLOB_STORE)
    for (const key of keys) store.delete(key)
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error ?? new Error('IndexedDB 删除失败'))
    }
  })
}

export async function deleteAllDraftBlobsForDraft(draftId: string): Promise<void> {
  const db = await openDb()
  const prefix = `${draftId}::`
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DRAFT_BLOB_STORE, 'readwrite')
    const store = tx.objectStore(DRAFT_BLOB_STORE)
    const req = store.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (cursor) {
        const key = String(cursor.key)
        if (key.startsWith(prefix)) cursor.delete()
        cursor.continue()
      }
    }
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error ?? new Error('IndexedDB 批量删除失败'))
    }
  })
}

export function blobToFile(blob: Blob, meta: StoredFileMeta): File {
  return new File([blob], meta.name, {
    type: meta.type || blob.type || 'application/octet-stream',
    lastModified: meta.lastModified ?? Date.now(),
  })
}

export function draftAssetKey(draftId: string, asset: string): string {
  return `${draftId}::${asset}`
}
