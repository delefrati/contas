import { ref } from 'vue'
import { ConnectionError, fetchJson } from './connection'
import { deleteRecord, readRecord, writeRecord } from './db'

const DAY_MS = 24 * 60 * 60 * 1000
// Offline phones can't be told someone lost access, so a copy can't outlive this
export const MAX_COPY_AGE_MS = 14 * DAY_MS
export const STALE_COPY_AGE_MS = DAY_MS
const SYNC_INTERVAL_MS = 15 * 60 * 1000
const SYNC_TIMEOUT_MS = 45_000

// What the UI shows about the download, without loading the data itself
export const copyInfo = ref(null)
// The server said this person no longer has access; App leaves as soon as the stage view closes
export const accessRevoked = ref(false)

// Bumped by every wipe, so a download already on its way can't bring deleted data back
let wipes = 0
let syncInFlight = null

function publishInfo(record) {
  copyInfo.value = record ? { savedAt: record.savedAt, window: record.data.window } : null
}

export async function wipeCopy() {
  wipes += 1
  copyInfo.value = null
  await deleteRecord()
}

export async function readSnapshot(now = Date.now()) {
  const record = await readRecord()
  if (record && now - record.savedAt > MAX_COPY_AGE_MS) {
    await wipeCopy()
    return null
  }
  publishInfo(record)
  return record?.data ?? null
}

// A copy belongs to whoever downloaded it: the next person on this phone starts clean
export async function keepCopyOnlyFor(owner) {
  const record = await readRecord()
  if (record && record.owner !== owner) await wipeCopy()
}

async function download({ url, owner, authHeader }) {
  const wipesBefore = wipes
  let response
  try {
    response = await fetchJson(url, { headers: authHeader }, SYNC_TIMEOUT_MS)
  } catch (exception) {
    if (exception instanceof ConnectionError) return 'failed'
    throw exception
  }
  if (response.status === 401) return 'unauthorized'
  if (!response.ok || !response.body?.data) return 'failed'
  if (wipes !== wipesBefore) return 'failed'

  const isFirstDownload = !copyInfo.value
  const record = { owner, savedAt: Date.now(), data: response.body.data }
  await writeRecord(record)
  // The wipe may have happened during the write above
  if (wipes !== wipesBefore) {
    await deleteRecord()
    return 'failed'
  }
  publishInfo(record)
  // Asks the browser not to evict the copy; it's free to say no
  if (isFirstDownload) navigator.storage?.persist?.().catch(() => {})
  return 'saved'
}

// A failed download never touches the copy already on the phone
export function syncSnapshot({ force = false, ...request }) {
  if (syncInFlight) return syncInFlight
  const savedAt = copyInfo.value?.savedAt ?? 0
  if (!force && Date.now() - savedAt < SYNC_INTERVAL_MS) return Promise.resolve('fresh')

  syncInFlight = download(request).finally(() => {
    syncInFlight = null
  })
  return syncInFlight
}
