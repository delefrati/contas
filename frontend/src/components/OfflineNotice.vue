<script setup>
import { ref } from 'vue'
import { checkConnection } from '../offline/pwa'

const checking = ref(false)

async function retry() {
  checking.value = true
  await checkConnection()
  checking.value = false
}
</script>

<template>
  <div class="container">
    <div class="content">
      <section class="expenses-section offline-notice">
        <i class="fa-solid fa-triangle-exclamation offline-notice-icon"></i>
        <h2>{{ $t('offline.noticeTitle') }}</h2>
        <p>{{ $t('offline.noticeText') }}</p>
        <div class="offline-notice-actions">
          <router-link to="/agenda" class="btn-primary">{{ $t('offline.goToAgenda') }}</router-link>
          <button type="button" class="btn-secondary" :disabled="checking" @click="retry">
            {{ checking ? $t('actions.loading') : $t('offline.retry') }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.offline-notice {
  text-align: center;
}
.offline-notice-icon {
  font-size: 2rem;
  color: var(--text-light);
}
.offline-notice-actions {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
}
.offline-notice-actions a {
  text-decoration: none;
}
</style>
