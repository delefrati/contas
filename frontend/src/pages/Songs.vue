<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import AppHeader from '../components/AppHeader.vue'
import Modal from '../components/Modal.vue'

const { t } = useI18n()
const router = useRouter()
const { logout, getAuthHeader, getCurrentUser } = useAuth()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const songs = ref([])

const loading = ref(false)
const error = ref('')
const successMessage = ref('')

// Song form
const isSongModalOpen = ref(false)
const editingSong = ref(null)
const songForm = ref({ title: '', artist: '', notes: '' })
const savingSong = ref(false)
const songFilter = ref('')

// Song import
const isImportModalOpen = ref(false)
const importText = ref('')
const importing = ref(false)
const importResult = ref(null)

const filteredSongs = computed(() => {
  const term = songFilter.value.trim().toLowerCase()
  if (!term) return songs.value
  return songs.value.filter((s) =>
    (s.title || '').toLowerCase().includes(term) ||
    (s.artist || '').toLowerCase().includes(term),
  )
})

function showSuccess(message) {
  successMessage.value = '✓ ' + message
  setTimeout(() => { successMessage.value = '' }, 3000)
}

function handleError(exception) {
  error.value = exception instanceof Error ? exception.message : t('errors.genericError')
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const authHeader = getAuthHeader()
    const songsResponse = await fetch(`${apiBaseUrl}/api/songs`, { headers: authHeader })

    if (songsResponse.status === 401) {
      await logout()
      await router.push({ path: '/login', query: { reason: 'expired' } })
      return
    }

    if (!songsResponse.ok) {
      throw new Error(t('songs.loadingError'))
    }

    songs.value = (await songsResponse.json()).data || []
  } catch (exception) {
    handleError(exception)
  } finally {
    loading.value = false
  }
}

// ---- Songs CRUD ----
function openCreateSong() {
  editingSong.value = null
  songForm.value = { title: '', artist: '', notes: '' }
  isSongModalOpen.value = true
}

function openEditSong(song) {
  editingSong.value = song
  songForm.value = { title: song.title, artist: song.artist || '', notes: song.notes || '' }
  isSongModalOpen.value = true
}

async function saveSong() {
  const title = songForm.value.title.trim()
  if (!title) {
    error.value = t('songs.titleRequired')
    return
  }

  savingSong.value = true
  error.value = ''
  try {
    const payload = {
      title,
      artist: songForm.value.artist.trim(),
      notes: songForm.value.notes.trim(),
    }
    const url = editingSong.value
      ? `${apiBaseUrl}/api/songs/${editingSong.value.id}`
      : `${apiBaseUrl}/api/songs`
    const method = editingSong.value ? 'PATCH' : 'POST'

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    isSongModalOpen.value = false
    showSuccess(editingSong.value ? t('songs.successUpdate') : t('songs.successCreate'))
    await loadData()
  } catch (exception) {
    handleError(exception)
  } finally {
    savingSong.value = false
  }
}

async function deleteSong(song) {
  if (!confirm(t('songs.confirmDelete', { title: song.title }))) return
  try {
    const response = await fetch(`${apiBaseUrl}/api/songs/${song.id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    })
    if (!response.ok) throw new Error(t('errors.genericError'))
    showSuccess(t('songs.successDelete'))
    await loadData()
  } catch (exception) {
    handleError(exception)
  }
}

function openImport() {
  importText.value = ''
  importResult.value = null
  isImportModalOpen.value = true
}

async function submitImport() {
  if (!importText.value.trim()) {
    error.value = t('songs.importEmpty')
    return
  }

  importing.value = true
  error.value = ''
  importResult.value = null
  try {
    const response = await fetch(`${apiBaseUrl}/api/songs/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ text: importText.value }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    const result = (await response.json()).data
    importResult.value = result
    showSuccess(t('songs.importSuccess', { created: result.created, skipped: result.skipped }))
    await loadData()
    if (result.skipped === 0) {
      isImportModalOpen.value = false
    }
  } catch (exception) {
    handleError(exception)
  } finally {
    importing.value = false
  }
}

onMounted(async () => {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    await router.push('/login')
    return
  }

  loadData()
})
</script>

<template>
  <div class="container">
    <AppHeader icon="fa-music" :title="$t('songs.title')" />

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <div class="content">
      <section class="expenses-section">
        <div class="section-header">
          <div class="section-actions">
            <input type="text" v-model="songFilter" :placeholder="$t('songs.filterPlaceholder')" class="search-input" />
            <button @click="openImport" class="btn-secondary">
              <i class="fa-solid fa-file-import"></i> {{ $t('songs.import') }}
            </button>
            <button @click="openCreateSong" class="btn-primary">+ {{ $t('songs.addSong') }}</button>
            <button @click="loadData" :disabled="loading" class="btn-secondary">
              <i v-if="!loading" class="fa-solid fa-arrows-rotate"></i> {{ loading ? $t('actions.loading') : $t('actions.refresh') }}
            </button>
          </div>
        </div>

        <div v-if="loading && songs.length === 0" class="loading">
          <i class="fa-solid fa-spinner fa-spin"></i> {{ $t('actions.loading') }}
        </div>
        <div v-else-if="filteredSongs.length === 0" class="empty-state">
          <p>{{ $t('songs.noSongs') }}</p>
        </div>

        <table v-else class="expenses-table">
          <thead>
            <tr>
              <th>{{ $t('songs.songTitle') }}</th>
              <th>{{ $t('songs.artist') }}</th>
              <th>{{ $t('songs.notes') }}</th>
              <th class="actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="song in filteredSongs" :key="song.id">
              <td>{{ song.title }}</td>
              <td>{{ song.artist || '—' }}</td>
              <td>{{ song.notes || '—' }}</td>
              <td class="actions">
                <div class="actions-desktop">
                  <button @click="openEditSong(song)" class="btn-edit" :title="$t('actions.edit')">
                    <i class="fa-solid fa-pencil"></i>
                  </button>
                  <button @click="deleteSong(song)" class="btn-delete" :title="$t('actions.delete')">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <!-- Song modal -->
    <Modal v-model="isSongModalOpen" :title="editingSong ? $t('songs.editSong') : $t('songs.addSong')">
      <form @submit.prevent="saveSong" class="form">
        <div class="form-group">
          <label>{{ $t('songs.songTitle') }} *</label>
          <input type="text" v-model="songForm.title" required autofocus />
        </div>
        <div class="form-group">
          <label>{{ $t('songs.artist') }}</label>
          <input type="text" v-model="songForm.artist" />
        </div>
        <div class="form-group">
          <label>{{ $t('songs.notes') }}</label>
          <textarea v-model="songForm.notes" rows="3"></textarea>
        </div>
        <div class="form-actions">
          <button type="button" @click="isSongModalOpen = false" class="btn-secondary">{{ $t('actions.cancel') }}</button>
          <button type="submit" :disabled="savingSong" class="btn-primary">
            {{ savingSong ? $t('actions.loading') : $t('actions.save') }}
          </button>
        </div>
      </form>
    </Modal>

    <!-- Import songs modal -->
    <Modal v-model="isImportModalOpen" :title="$t('songs.import')">
      <form @submit.prevent="submitImport" class="form">
        <p class="import-hint">{{ $t('songs.importHint') }}</p>
        <div class="form-group">
          <textarea
            v-model="importText"
            rows="12"
            class="import-textarea"
            :placeholder="$t('songs.importPlaceholder')"
            autofocus
          ></textarea>
        </div>
        <p v-if="importResult" class="import-result">
          {{ $t('songs.importResult', { created: importResult.created, skipped: importResult.skipped }) }}
        </p>
        <div class="form-actions">
          <button type="button" @click="isImportModalOpen = false" class="btn-secondary">{{ $t('actions.cancel') }}</button>
          <button type="submit" :disabled="importing" class="btn-primary">
            {{ importing ? $t('actions.loading') : $t('songs.import') }}
          </button>
        </div>
      </form>
    </Modal>

  </div>
</template>

<style scoped>
.search-input {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  font-size: 0.95rem;
}
.form-group {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group input,
.form-group textarea {
  padding: 8px 12px;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: inherit;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
.import-hint {
  font-size: 0.85rem;
  opacity: 0.7;
  margin: 0 0 12px;
}
.import-textarea {
  width: 100%;
  font-family: inherit;
  resize: vertical;
}
.import-result {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 4px 0 8px;
}
</style>
