const DB_NAME = 'minhabanda-offline'
const STORE = 'snapshot'
const KEY = 'current'

// Each band has its own subdomain, so the browser keeps these databases apart. Failures resolve
// to null: a phone with no usable storage just behaves as if nothing was downloaded.
function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

async function withStore(mode, run) {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    const transaction = db.transaction(STORE, mode)
    const request = run(transaction.objectStore(STORE))
    let result = null
    request.onsuccess = () => { result = request.result ?? null }
    transaction.oncomplete = () => { db.close(); resolve(result) }
    transaction.onabort = () => { db.close(); resolve(null) }
    transaction.onerror = () => { db.close(); resolve(null) }
  })
}

export function readRecord() {
  return withStore('readonly', (store) => store.get(KEY))
}

export function writeRecord(record) {
  return withStore('readwrite', (store) => store.put(record, KEY))
}

export function deleteRecord() {
  return withStore('readwrite', (store) => store.delete(KEY))
}
