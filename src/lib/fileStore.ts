/**
 * Kleiner IndexedDB-Speicher für Dokumenten-Scans und Fahrzeugfotos.
 * Bilder gehören nicht in localStorage – dort ist bei ~5 MB Schluss.
 */

const DB_NAME = 'meraq-files'
const STORE = 'files'

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE)
        const req = fn(store)
        req.onsuccess = () => resolve(req.result)
        req.onerror = () => reject(req.error)
      }),
  )
}

export const putFile = (key: string, dataUrl: string) => tx('readwrite', (s) => s.put(dataUrl, key))
export const getFile = (key: string) => tx<string | undefined>('readonly', (s) => s.get(key))
export const deleteFile = (key: string) => tx('readwrite', (s) => s.delete(key))
export const clearFiles = () => tx('readwrite', (s) => s.clear())

/** Datei einlesen und dabei Bilder verkleinern, damit der Speicher nicht vollläuft */
export async function fileToDataUrl(file: File, maxEdge = 1600): Promise<string> {
  const raw = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  if (!file.type.startsWith('image/')) return raw

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = raw
  })

  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
  if (scale === 1 && raw.length < 900_000) return raw

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) return raw
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.85)
}

/** "data:image/jpeg;base64,..." → { mediaType, data } für die Anthropic-API */
export function splitDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) return null
  return { mediaType: match[1], data: match[2] }
}
