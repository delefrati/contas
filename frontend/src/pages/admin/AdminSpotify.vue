<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAdmin } from '../../composables/useAdmin'
import { formatDate } from '../../utils/date'
import AdminLayout from '../../components/AdminLayout.vue'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { get, post, del } = useAdmin()

const status = ref(null)
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const successMessage = ref('')

const connection = computed(() => status.value?.connection ?? null)

// How Spotify's redirect ended, from ?spotify=<outcome> (see SpotifyService.finishConnect)
const OUTCOMES = {
  connected: { success: true },
  cancelled: { success: true },
  expired: { success: false },
  failed: { success: false },
}

function showOutcome() {
  const outcome = OUTCOMES[route.query.spotify]
  if (!outcome) return
  const message = t(`admin.spotify.${route.query.spotify}`)
  if (outcome.success) successMessage.value = '✓ ' + message
  else error.value = message
  router.replace({ query: {} })
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    status.value = await get('/spotify')
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
  showOutcome()
}

async function connect() {
  busy.value = true
  error.value = ''
  try {
    const { url } = await post('/spotify/connect')
    window.location.assign(url)
  } catch (err) {
    error.value = err.message
    busy.value = false
  }
}

async function disconnect() {
  if (!confirm(t('admin.spotify.confirmDisconnect'))) return
  busy.value = true
  error.value = ''
  try {
    await del('/spotify')
    successMessage.value = '✓ ' + t('admin.spotify.disconnected')
    status.value = await get('/spotify')
  } catch (err) {
    error.value = err.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AdminLayout icon="fa-music" :title="$t('admin.spotify.title')" @ready="load">
    <section class="expenses-section spotify-admin">
      <p class="hint">{{ $t('admin.spotify.hint') }}</p>

      <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <div v-if="loading && !status" class="loading">
        <i class="fa-solid fa-spinner fa-spin"></i> {{ $t('actions.loading') }}
      </div>

      <template v-else-if="status">
        <div v-if="!status.configured" class="spotify-state not-set-up">
          <p>{{ $t('admin.spotify.notSetUp') }}</p>
          <p v-if="status.problem" class="problem"><code>{{ status.problem }}</code></p>
        </div>

        <div v-else-if="!connection" class="spotify-state not-connected">
          <p>{{ $t('admin.spotify.notConnected') }}</p>
          <button @click="connect" :disabled="busy" class="btn-primary">
            <i class="fa-brands fa-spotify"></i> {{ $t('admin.spotify.connect') }}
          </button>
        </div>

        <div v-else class="spotify-state" :class="connection.broken ? 'is-broken' : 'is-working'">
          <span class="spotify-badge" :class="connection.broken ? 'is-inactive' : 'is-active'">
            {{ connection.broken ? $t('admin.spotify.broken') : $t('admin.spotify.working') }}
          </span>
          <p v-if="connection.broken" class="broken-hint">{{ $t('admin.spotify.brokenHint') }}</p>
          <dl class="spotify-facts">
            <dt>{{ $t('admin.spotify.account') }}</dt>
            <dd>
              <i class="fa-brands fa-spotify"></i>
              {{ connection.displayName || connection.spotifyUserId }}
              <small v-if="connection.displayName">({{ connection.spotifyUserId }})</small>
            </dd>
            <template v-if="connection.connectedBy">
              <dt>{{ $t('admin.spotify.connectedBy') }}</dt>
              <dd>{{ connection.connectedBy }}</dd>
            </template>
            <dt>{{ $t('admin.spotify.connectedAt') }}</dt>
            <dd>{{ formatDate(connection.connectedAt, locale) }}</dd>
          </dl>
          <div class="section-actions">
            <button @click="connect" :disabled="busy" :class="connection.broken ? 'btn-primary' : 'btn-secondary'">
              <i class="fa-brands fa-spotify"></i>
              {{ connection.broken ? $t('admin.spotify.reconnect') : $t('admin.spotify.connectOther') }}
            </button>
            <button @click="disconnect" :disabled="busy" class="btn-secondary">
              {{ $t('admin.spotify.disconnect') }}
            </button>
          </div>
        </div>
      </template>
    </section>
  </AdminLayout>
</template>

<style scoped>
.spotify-admin {
  text-align: left;
}
.hint {
  margin: 0 0 16px;
  opacity: 0.8;
}
.spotify-state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}
.spotify-state p {
  margin: 0;
}
.spotify-state .section-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.problem code {
  font-size: 0.85rem;
}
.spotify-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
}
.spotify-badge.is-active {
  color: var(--success);
  background: rgba(72, 187, 120, 0.12);
}
.spotify-badge.is-inactive {
  color: var(--error);
  background: rgba(245, 101, 101, 0.12);
}
.spotify-facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 16px;
  margin: 0;
}
.spotify-facts dt {
  color: var(--text-light, #718096);
}
.spotify-facts dd {
  margin: 0;
}
.spotify-facts .fa-spotify {
  color: #1db954;
}
</style>
