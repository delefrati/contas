<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { connectionLost } from '../offline/connection'
import { copyInfo, STALE_COPY_AGE_MS } from '../offline/snapshot'
import { formatTimeAgo } from '../utils/date'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { sessionExpired } = useAuth()

// Only says something when there's a problem: no connection, an expired session or nothing
// downloaded yet. With a connection the data stays fresh on its own (UpdateBar warns when it
// doesn't), and Configurações has a button to download it again.
const state = computed(() => {
  if (sessionExpired.value && copyInfo.value) return 'expired'
  if (connectionLost.value) return copyInfo.value ? 'offline' : 'noCopy'
  return null
})

const isStale = computed(() =>
  Boolean(copyInfo.value) && Date.now() - copyInfo.value.savedAt > STALE_COPY_AGE_MS,
)

const savedWhen = computed(() => (copyInfo.value ? formatTimeAgo(copyInfo.value.savedAt, locale.value) : ''))

const message = computed(() => (state.value ? t(`offline.${state.value}`, { when: savedWhen.value }) : ''))

function signIn() {
  router.push({ path: '/login', query: { redirect: route.fullPath } })
}
</script>

<template>
  <div v-if="state" class="offline-bar" role="status" aria-live="polite">
    <i class="fa-solid fa-triangle-exclamation"></i>
    <span class="offline-bar-text">
      {{ message }}
      <strong v-if="isStale">{{ $t('offline.stale') }}</strong>
    </span>
    <button v-if="state === 'expired'" type="button" class="btn-secondary" @click="signIn">
      {{ $t('offline.signIn') }}
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
  border: 1px solid #d69e2e;
  border-radius: 8px;
  font-size: 0.85rem;
}
.offline-bar-text {
  flex: 1;
  min-width: 180px;
}
</style>
