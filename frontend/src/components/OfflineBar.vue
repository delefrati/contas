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

const downloading = ref(false)
const downloadFailed = ref(false)

const state = computed(() => {
  if (sessionExpired.value && copyInfo.value) return 'expired'
  if (connectionLost.value) return copyInfo.value ? 'offline' : 'noCopy'
  return copyInfo.value ? 'saved' : null
})

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
  if (downloadFailed.value) return t('offline.downloadFailed')
  return state.value ? t(`offline.${state.value}`, { when: savedWhen.value }) : ''
})

// Installed apps on iPhones keep their data much better than a Safari tab does
const shouldSuggestInstall = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone

async function downloadAgain() {
  downloading.value = true
  downloadFailed.value = false
  const result = await syncCopy({ force: true })
  downloadFailed.value = result !== 'saved'
  downloading.value = false
}

function signIn() {
  router.push({ path: '/login', query: { redirect: route.fullPath } })
}
</script>

<template>
  <div v-if="state" class="offline-bar" :class="{ 'is-warning': state !== 'saved' }" role="status">
    <i class="fa-solid" :class="state === 'saved' ? 'fa-circle-check' : 'fa-triangle-exclamation'"></i>
    <span class="offline-bar-text">
      {{ message }}
      <strong v-if="isStale">{{ $t('offline.stale') }}</strong>
      <small v-if="state === 'saved' && shouldSuggestInstall">{{ $t('offline.installHint') }}</small>
    </span>
    <button v-if="state === 'expired'" type="button" class="btn-secondary" @click="signIn">
      {{ $t('offline.signIn') }}
    </button>
    <button v-else-if="state === 'saved'" type="button" class="btn-secondary" :disabled="downloading" @click="downloadAgain">
      {{ downloading ? $t('actions.loading') : $t('offline.downloadAgain') }}
    </button>
  </div>
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
