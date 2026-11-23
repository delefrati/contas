<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { isSpotifyLink, looksLikeLink } from '../utils/spotify'
import Modal from './Modal.vue'

// The "Playlist no Spotify" button and its dialog (MB-17). The playlist is made in the
// platform's Spotify account; this page only learns whether that works, never the account.
const props = defineProps({
  // The songs that would go in, in order: { id, title, artist, spotifyUrl }
  songs: { type: Array, required: true },
  // POST path that makes the playlist, such as /api/spotify/playlists/songs
  endpoint: { type: String, required: true },
  // Without internet, or reading the downloaded copy
  disabled: { type: Boolean, default: false },
})

// A link pasted here, so the page can show it too: (songId, spotifyUrl)
const emit = defineEmits(['song-updated'])

const { t } = useI18n()
const { getAuthHeader, scheduleCopySync } = useAuth()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

// 'not-set-up' hides the button; 'unavailable' opens a dialog that says so
const availability = ref(null)
const isOpen = ref(false)
const making = ref(false)
const result = ref(null)
const error = ref('')
// Links being pasted for songs without one, by song id
const drafts = ref({})
const draftErrors = ref({})
const savingId = ref(null)
// Spotify tracks found for a song, by song id: an array (maybe empty) once searched (MB-15)
const results = ref({})
const searchingId = ref(null)

const withLink = computed(() => props.songs.filter((s) => s.spotifyUrl))
const missing = computed(() => props.songs.filter((s) => !s.spotifyUrl))

const ERRORS = {
  NO_SPOTIFY_SONGS: 'spotify.noSongs',
  SPOTIFY_UNAVAILABLE: 'spotify.unavailable',
  SPOTIFY_RATE_LIMITED: 'spotify.rateLimited',
}

async function loadAvailability() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/spotify/status`, { headers: getAuthHeader() })
    if (response.ok) availability.value = (await response.json()).data.availability
  } catch {
    // Offline or failing: no button, as if Spotify weren't set up
  }
}

// What the search field starts with: the song's own name, ready to search or to change
function songWords(song) {
  return song.artist ? `${song.title} - ${song.artist}` : song.title
}

function open() {
  for (const song of missing.value) {
    if (drafts.value[song.id] === undefined) drafts.value[song.id] = songWords(song)
  }
  result.value = null
  error.value = ''
  draftErrors.value = {}
  isOpen.value = true
}

async function make() {
  making.value = true
  error.value = ''
  result.value = null
  try {
    const response = await fetch(`${apiBaseUrl}${props.endpoint}`, { method: 'POST', headers: getAuthHeader() })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      if (body?.code === 'SPOTIFY_UNAVAILABLE') availability.value = 'unavailable'
      throw new Error(t(ERRORS[body?.code] || 'spotify.error'))
    }
    result.value = body.data
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('spotify.error')
  } finally {
    making.value = false
  }
}

// Track lengths as m:ss
function duration(ms) {
  const seconds = Math.round(ms / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

// The one field takes a link or words: a link is saved, words are searched on Spotify
function isLinkDraft(song) {
  return looksLikeLink(drafts.value[song.id])
}

function submit(song) {
  if (isLinkDraft(song)) return saveLink(song)
  const words = (drafts.value[song.id] ?? '').trim()
  // The name as it came (or nothing) searches by the song itself, with Spotify's exact filters
  search(song, words === songWords(song) ? '' : words)
}

async function search(song, words = '') {
  searchingId.value = song.id
  draftErrors.value = { ...draftErrors.value, [song.id]: '' }
  try {
    const query = words ? `?${new URLSearchParams({ q: words })}` : ''
    const response = await fetch(`${apiBaseUrl}/api/spotify/songs/${song.id}/tracks${query}`, { headers: getAuthHeader() })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      if (body?.code === 'SPOTIFY_UNAVAILABLE') availability.value = 'unavailable'
      throw new Error(t(ERRORS[body?.code] || 'spotify.error'))
    }
    results.value = { ...results.value, [song.id]: body.data }
  } catch (exception) {
    draftErrors.value = { ...draftErrors.value, [song.id]: exception.message }
  } finally {
    searchingId.value = null
  }
}

// A pasted link, or the link of a track picked from the search
async function saveLink(song, picked) {
  const link = (picked ?? drafts.value[song.id] ?? '').trim()
  draftErrors.value = { ...draftErrors.value, [song.id]: '' }
  if (!link || !isSpotifyLink(link)) {
    draftErrors.value = { ...draftErrors.value, [song.id]: t('songs.invalidSpotifyLink') }
    return
  }

  savingId.value = song.id
  try {
    const response = await fetch(`${apiBaseUrl}/api/songs/${song.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ spotifyUrl: link }),
    })
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(body?.code === 'INVALID_SPOTIFY_LINK' ? t('songs.invalidSpotifyLink') : t('errors.genericError'))
    }
    scheduleCopySync()
    emit('song-updated', song.id, body.data.spotifyUrl)
  } catch (exception) {
    draftErrors.value = { ...draftErrors.value, [song.id]: exception.message }
  } finally {
    savingId.value = null
  }
}

onMounted(loadAvailability)
</script>

<template>
  <button
    v-if="availability && availability !== 'not-set-up'"
    @click="open"
    :disabled="disabled || songs.length === 0"
    class="btn-secondary spotify-playlist-button"
    :title="$t('spotify.playlist')"
  >
    <i class="fa-brands fa-spotify"></i> {{ $t('spotify.playlist') }}
  </button>

  <Modal v-model="isOpen" :title="$t('spotify.playlist')">
    <div class="spotify-playlist">
      <p v-if="availability === 'unavailable'" class="alert alert-error unavailable">{{ $t('spotify.unavailable') }}</p>

      <template v-else>
        <p class="will-include">{{ $t('spotify.willInclude', withLink.length) }}</p>
        <p class="hint public-note"><i class="fa-solid fa-globe"></i> {{ $t('spotify.publicNote') }}</p>

        <div v-if="missing.length > 0" class="missing">
          <h4>{{ $t('spotify.missingTitle', missing.length) }}</h4>
          <p class="hint">{{ $t('spotify.missingHint') }}</p>
          <ul>
            <li v-for="song in missing" :key="song.id" class="missing-song">
              <span class="missing-name">
                {{ song.title }}
                <small v-if="song.artist">— {{ song.artist }}</small>
              </span>
              <form class="missing-link" @submit.prevent="submit(song)">
                <input
                  v-model="drafts[song.id]"
                  type="text"
                  autocomplete="off"
                  :placeholder="$t('spotify.linkOrSearch')"
                  :aria-label="$t('spotify.linkOrSearch')"
                />
                <button
                  v-if="isLinkDraft(song)"
                  type="submit"
                  :disabled="savingId === song.id"
                  class="btn-secondary btn-small save-link"
                >
                  {{ $t('actions.save') }}
                </button>
                <button
                  v-else
                  type="submit"
                  :disabled="searchingId === song.id || disabled"
                  class="btn-secondary btn-small search-song"
                >
                  <i class="fa-solid fa-magnifying-glass"></i>
                  {{ searchingId === song.id ? $t('spotify.searching') : $t('spotify.search') }}
                </button>
              </form>
              <small v-if="draftErrors[song.id]" class="draft-error">{{ draftErrors[song.id] }}</small>
              <p v-if="results[song.id] && results[song.id].length === 0" class="hint nothing-found">
                {{ $t('spotify.nothingFound') }}
              </p>
              <ul v-else-if="results[song.id]" class="track-results">
                <li v-for="track in results[song.id]" :key="track.id" class="track-result">
                  <img v-if="track.imageUrl" :src="track.imageUrl" alt="" class="track-cover" loading="lazy" />
                  <span class="track-info">
                    <strong>{{ track.name }}</strong>
                    <small>
                      {{ track.artists.join(', ') }}
                      <template v-if="track.album"> · {{ track.album }}</template>
                      <template v-if="track.year"> ({{ track.year }})</template>
                      · {{ duration(track.durationMs) }}
                    </small>
                  </span>
                  <a :href="track.url" target="_blank" rel="noopener noreferrer" class="listen" :title="$t('spotify.listen')">
                    <i class="fa-brands fa-spotify"></i> {{ $t('spotify.listen') }}
                  </a>
                  <button
                    type="button"
                    @click="saveLink(song, track.url)"
                    :disabled="savingId === song.id"
                    class="btn-primary btn-small use-track"
                  >
                    {{ $t('spotify.useThis') }}
                  </button>
                </li>
              </ul>
            </li>
          </ul>
        </div>

        <div v-if="result" class="alert alert-success made">
          {{ $t('spotify.made', result.tracks) }}
          <a :href="result.url" target="_blank" rel="noopener noreferrer" class="open-playlist">
            <i class="fa-brands fa-spotify"></i> {{ $t('spotify.open') }}
          </a>
        </div>
        <div v-if="error" class="alert alert-error">{{ error }}</div>
      </template>

      <div class="form-actions">
        <button type="button" @click="isOpen = false" class="btn-secondary">{{ $t('actions.close') }}</button>
        <button
          v-if="availability !== 'unavailable'"
          type="button"
          @click="make"
          :disabled="making || disabled || withLink.length === 0"
          class="btn-primary make-playlist"
        >
          <i class="fa-brands fa-spotify"></i>
          {{ making ? $t('actions.loading') : result ? $t('spotify.makeAgain') : $t('spotify.make') }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.spotify-playlist p {
  margin: 0 0 10px;
}
.hint {
  font-size: 0.85rem;
  opacity: 0.75;
}
.missing h4 {
  margin: 14px 0 4px;
}
.missing ul {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 40vh;
  overflow-y: auto;
}
.missing-song {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border, #e2e8f0);
}
.missing-name small {
  color: var(--text-light, #718096);
}
.missing-link {
  display: flex;
  gap: 6px;
}
.missing-link input {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid var(--border-color, #ccc);
  border-radius: 6px;
  font-size: 0.9rem;
}
.track-results {
  list-style: none;
  margin: 4px 0 0;
  padding: 0;
}
.track-result {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
}
.track-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  flex-shrink: 0;
  object-fit: cover;
}
.track-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-wrap: anywhere;
}
.track-info small {
  color: var(--text-light, #718096);
}
.listen {
  flex-shrink: 0;
  font-size: 0.85rem;
  text-decoration: none;
  color: var(--text-light, #718096);
}
.use-track {
  flex-shrink: 0;
}
.nothing-found {
  margin: 4px 0 0;
}
.draft-error {
  color: var(--error, #e53e3e);
}
.made {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.open-playlist {
  font-weight: 600;
  color: #1db954;
  text-decoration: none;
}
.fa-spotify {
  color: #1db954;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 14px;
}
.make-playlist .fa-spotify {
  color: inherit;
}
</style>
