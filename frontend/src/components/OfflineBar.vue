<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { connectionLost } from '../offline/connection'
import { copyInfo, STALE_COPY_AGE_MS } from '../offline/snapshot'
import { localeTag } from '../utils/date'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { sessionExpired, syncCopy } = useAuth()

// Tapping the strip downloads again. Once it worked the strip shows it for a moment, then stays
// out of the way for a while, on every screen. Warnings (no connection, expired) always show.
const HIDDEN_UNTIL_KEY = 'offline_bar_hidden_until'
const HIDE_AFTER_UPDATE_MS = 60 * 60 * 1000
const CONFIRM_MS = 2000

function readHiddenUntil() {
  try {
    return Number(localStorage.getItem(HIDDEN_UNTIL_KEY)) || 0
  } catch {
    return 0
  }
}

const hiddenUntil = ref(readHiddenUntil())
const downloading = ref(false)
const downloadFailed = ref(false)

const state = computed(() => {
  if (sessionExpired.value && copyInfo.value) return 'expired'
  if (connectionLost.value) return copyInfo.value ? 'offline' : 'noCopy'
  return copyInfo.value ? 'saved' : null
})

const canDownload = computed(() => state.value === 'saved')
const visible = computed(() => state.value && !(canDownload.value && Date.now() < hiddenUntil.value))

const isStale = computed(() =>
  state.value !== 'saved' && copyInfo.value && Date.now() - copyInfo.value.savedAt > STALE_COPY_AGE_MS,
)

const savedWhen = computed(() => {
  if (!copyInfo.value) return ''
  const minutes = Math.round((copyInfo.value.savedAt - Date.now()) / 60_000)
  const format = new Intl.RelativeTimeFormat(localeTag(locale.value), { numeric: 'auto' })
  if (minutes > -60) return format.format(minutes, 'minute')
  if (minutes > -24 * 60) return format.format(Math.round(minutes / 60), 'hour')
  return format.format(Math.round(minutes / (24 * 60)), 'day')
})

const message = computed(() => {
  if (downloading.value) return t('actions.loading')
  if (downloadFailed.value) return t('offline.downloadFailed')
  return state.value ? t(`offline.${state.value}`, { when: savedWhen.value }) : ''
})

function hideForAWhile() {
  hiddenUntil.value = Date.now() + HIDE_AFTER_UPDATE_MS
  try {
    localStorage.setItem(HIDDEN_UNTIL_KEY, String(hiddenUntil.value))
  } catch {
    // It just shows again on the next screen
  }
}

async function downloadAgain() {
  if (downloading.value) return
  downloading.value = true
  downloadFailed.value = false
  const result = await syncCopy({ force: true })
  downloading.value = false
  if (result === 'saved') {
    setTimeout(hideForAWhile, CONFIRM_MS)
  } else {
    downloadFailed.value = true
  }
}

// Installed apps on iPhones keep their data much better than a Safari tab does
const shouldSuggestInstall = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone

function signIn() {
  router.push({ path: '/login', query: { redirect: route.fullPath } })
}
</script>

<template>
  <component
    :is="canDownload ? 'button' : 'div'"
    v-if="visible"
    :type="canDownload ? 'button' : undefined"
    class="offline-bar"
    :class="{ 'is-warning': state !== 'saved' || downloadFailed, 'is-tappable': canDownload }"
    :title="canDownload ? $t('offline.tapToUpdate') : undefined"
    :disabled="canDownload && downloading"
    :role="canDownload ? undefined : 'status'"
    aria-live="polite"
    @click="canDownload && downloadAgain()"
  >
    <i
      class="fa-solid"
      :class="downloading ? 'fa-spinner fa-spin' : state === 'saved' && !downloadFailed ? 'fa-circle-check' : 'fa-triangle-exclamation'"
    ></i>
    <span class="offline-bar-text">
      {{ message }}
      <strong v-if="isStale">{{ $t('offline.stale') }}</strong>
      <small v-if="state === 'saved' && shouldSuggestInstall">{{ $t('offline.installHint') }}</small>
    </span>
    <span v-if="canDownload && !downloading" class="offline-bar-action">
      <i class="fa-solid fa-rotate"></i> {{ $t('offline.tapToUpdate') }}
    </span>
    <button v-if="state === 'expired'" type="button" class="btn-secondary" @click="signIn">
      {{ $t('offline.signIn') }}
    </button>
  </component>
</template>

<style scoped>
.offline-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-light);
  font-size: 0.85rem;
}
.offline-bar.is-tappable {
  width: 100%;
  background: transparent;
  font: inherit;
  font-size: 0.85rem;
  text-align: left;
  cursor: pointer;
}
.offline-bar.is-tappable:hover:not(:disabled) {
  background: var(--accent-light);
}
.offline-bar.is-tappable:disabled {
  cursor: progress;
}
.offline-bar-action {
  color: var(--accent);
  white-space: nowrap;
}
.offline-bar.is-warning {
  border-color: #d69e2e;
  color: inherit;
}
.offline-bar-text {
  flex: 1;
  min-width: 180px;
}
.offline-bar-text small {
  display: block;
}
</style>
