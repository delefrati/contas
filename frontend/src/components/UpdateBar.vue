<script setup>
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { connectionLost } from '../offline/connection'
import { applyUpdate, updateReady } from '../offline/pwa'
import { copyInfo, STALE_COPY_AGE_MS } from '../offline/snapshot'

const { t } = useI18n()
const { isLoggedIn, syncCopy } = useAuth()

const updating = ref(false)
const downloadFailed = ref(false)

const online = computed(() => !connectionLost.value)

// The copy is refreshed on its own while the app is used, so an old one with a connection means
// those downloads are failing
const dataStale = computed(() =>
  isLoggedIn.value && online.value && Boolean(copyInfo.value) &&
  Date.now() - copyInfo.value.savedAt > STALE_COPY_AGE_MS,
)

const visible = computed(() =>
  updateReady.value || (online.value && (dataStale.value || downloadFailed.value)),
)

const message = computed(() => {
  if (downloadFailed.value) return t('offline.downloadFailed')
  if (updateReady.value) return t('update.available')
  return t('update.dataStale')
})

// One button for both: the data comes down again, then a waiting version takes over
async function update() {
  updating.value = true
  downloadFailed.value = false
  const result = isLoggedIn.value && online.value ? await syncCopy({ force: true }) : null
  if (updateReady.value) {
    applyUpdate()
    return
  }
  downloadFailed.value = result !== null && result !== 'saved'
  updating.value = false
}
</script>

<template>
  <div v-if="visible" class="update-bar" role="status">
    <i class="fa-solid" :class="downloadFailed ? 'fa-triangle-exclamation' : 'fa-rotate'"></i>
    <span class="update-bar-text">{{ message }}</span>
    <button type="button" class="btn-primary" :disabled="updating" @click="update">
      <i v-if="updating" class="fa-solid fa-spinner fa-spin"></i>
      {{ $t('update.apply') }}
    </button>
  </div>
</template>

<style scoped>
.update-bar {
  position: fixed;
  left: 50%;
  bottom: 16px;
  z-index: 1000;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  width: max-content;
  max-width: calc(100% - 32px);
  padding: 10px 12px 10px 16px;
  border: 1px solid var(--accent);
  border-radius: 10px;
  background: var(--bg-white);
  color: var(--text-h);
  font-size: 0.9rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}
.update-bar > i {
  color: var(--accent);
}
.update-bar-text {
  flex: 1;
}
.update-bar button {
  white-space: nowrap;
}
</style>
