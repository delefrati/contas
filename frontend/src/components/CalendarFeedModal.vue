<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { useBand } from '../composables/useBand'
import Modal from './Modal.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

// Offered lengths for events without an end time, in minutes
const DURATIONS = [30, 60, 90, 120, 150, 180, 240, 300, 360, 480]

const { t } = useI18n()
const { getAuthHeader, member } = useAuth()
const { band, setBand } = useBand()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const token = ref(null)
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const copied = ref(false)
const settings = ref({ timeZone: '', defaultEventMinutes: 120 })

// Super admins aren't members of the band, so they have no link of their own
const canSubscribe = computed(() => Boolean(member.value) && !member.value.superAdmin)

// Absolute, since it's pasted into another app
const feedUrl = computed(() =>
  token.value ? new URL(`${apiBaseUrl}/api/calendar/${token.value}.ics`, window.location.origin).href : '',
)
// Apple Calendar and Outlook subscribe when opening webcal:// links
const webcalUrl = computed(() => feedUrl.value.replace(/^https?:/, 'webcal:'))
const googleUrl = computed(() =>
  `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(webcalUrl.value)}`,
)

const timeZones = computed(() => {
  const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []
  const current = settings.value.timeZone
  return current && !zones.includes(current) ? [current, ...zones] : zones
})

const durations = computed(() => {
  const current = settings.value.defaultEventMinutes
  return DURATIONS.includes(current) ? DURATIONS : [...DURATIONS, current].sort((a, b) => a - b)
})

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours}h${String(rest).padStart(2, '0')}` : `${hours}h`
}

async function request(method, path, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...getAuthHeader() },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) throw new Error(payload?.message || t('errors.genericError'))
  return payload?.data
}

async function run(action) {
  saving.value = true
  error.value = ''
  try {
    await action()
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
  } finally {
    saving.value = false
  }
}

async function loadFeed() {
  if (!canSubscribe.value) return
  loading.value = true
  error.value = ''
  try {
    token.value = (await request('GET', '/api/calendar/feed'))?.token ?? null
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
  } finally {
    loading.value = false
  }
}

watch(() => props.modelValue, (open) => {
  if (!open) return
  copied.value = false
  error.value = ''
  settings.value = {
    timeZone: band.value?.timeZone || 'America/Sao_Paulo',
    defaultEventMinutes: band.value?.defaultEventMinutes || 120,
  }
  loadFeed()
}, { immediate: true })

function createLink() {
  return run(async () => {
    token.value = (await request('POST', '/api/calendar/feed')).token
    copied.value = false
  })
}

function regenerateLink() {
  if (confirm(t('calendarFeed.confirmRegenerate'))) return createLink()
}

function removeLink() {
  if (!confirm(t('calendarFeed.confirmRemove'))) return
  return run(async () => {
    await request('DELETE', '/api/calendar/feed')
    token.value = null
  })
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(feedUrl.value)
    copied.value = true
  } catch {
    window.prompt(t('calendarFeed.copyFallback'), feedUrl.value)
  }
}

function saveSettings() {
  return run(async () => {
    setBand(await request('PATCH', '/api/band/calendar', settings.value))
  })
}

const settingsChanged = computed(() =>
  settings.value.timeZone !== band.value?.timeZone ||
  settings.value.defaultEventMinutes !== band.value?.defaultEventMinutes,
)
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="$t('calendarFeed.title')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="calendar-feed">
      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <section v-if="canSubscribe">
        <p class="hint">{{ $t('calendarFeed.intro') }}</p>

        <p v-if="loading" class="hint"><i class="fa-solid fa-spinner fa-spin"></i></p>
        <button v-else-if="!token" type="button" class="btn-primary" :disabled="saving" @click="createLink">
          <i class="fa-solid fa-link"></i> {{ $t('calendarFeed.create') }}
        </button>
        <template v-else>
          <div class="feed-link">
            <input type="text" readonly :value="feedUrl" :aria-label="$t('calendarFeed.link')" @focus="$event.target.select()" />
            <button type="button" class="btn-secondary" @click="copyLink">
              <i class="fa-solid" :class="copied ? 'fa-check' : 'fa-copy'"></i>
              {{ copied ? $t('calendarFeed.copied') : $t('calendarFeed.copy') }}
            </button>
          </div>
          <div class="feed-apps">
            <a :href="googleUrl" target="_blank" rel="noopener" class="btn-secondary">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> {{ $t('calendarFeed.google') }}
            </a>
            <a :href="webcalUrl" class="btn-secondary">
              <i class="fa-solid fa-calendar-plus"></i> {{ $t('calendarFeed.appleOutlook') }}
            </a>
          </div>
          <p class="hint">{{ $t('calendarFeed.privateHint') }}</p>
          <p class="hint">{{ $t('calendarFeed.refreshHint') }}</p>
          <div class="feed-manage">
            <button type="button" class="btn-secondary" :disabled="saving" @click="regenerateLink">
              <i class="fa-solid fa-rotate"></i> {{ $t('calendarFeed.regenerate') }}
            </button>
            <button type="button" class="btn-secondary" :disabled="saving" @click="removeLink">
              <i class="fa-solid fa-link-slash"></i> {{ $t('calendarFeed.remove') }}
            </button>
          </div>
        </template>
      </section>
      <p v-else class="hint">{{ $t('calendarFeed.membersOnly') }}</p>

      <form class="band-settings" @submit.prevent="saveSettings">
        <h3>{{ $t('calendarFeed.bandSettings') }}</h3>
        <p class="hint">{{ $t('calendarFeed.bandSettingsHint') }}</p>
        <div class="form-group">
          <label for="calendar-time-zone">{{ $t('calendarFeed.timeZone') }}</label>
          <select id="calendar-time-zone" v-model="settings.timeZone">
            <option v-for="zone in timeZones" :key="zone" :value="zone">{{ zone.replace(/_/g, ' ') }}</option>
          </select>
        </div>
        <div class="form-group">
          <label for="calendar-duration">{{ $t('calendarFeed.defaultDuration') }}</label>
          <select id="calendar-duration" v-model.number="settings.defaultEventMinutes">
            <option v-for="minutes in durations" :key="minutes" :value="minutes">{{ formatDuration(minutes) }}</option>
          </select>
          <span class="hint">{{ $t('calendarFeed.defaultDurationHint') }}</span>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary" :disabled="saving || !settingsChanged">
            {{ saving ? $t('actions.loading') : $t('actions.save') }}
          </button>
        </div>
      </form>
    </div>
  </Modal>
</template>

<style scoped>
.calendar-feed {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: left;
}
.calendar-feed section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-light);
}
.feed-link {
  display: flex;
  gap: 8px;
}
.feed-link input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-family: monospace;
  font-size: 0.85rem;
}
.feed-apps,
.feed-manage {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.feed-apps a {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  text-decoration: none;
}
.band-settings {
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.band-settings h3 {
  margin: 0 0 6px;
  font-size: 1rem;
}
.form-group {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group select {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: inherit;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}
</style>
