<script setup>
import { computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useBand } from './composables/useBand'
import OfflineNotice from './components/OfflineNotice.vue'
import { connectionLost } from './offline/connection'
import { accessRevoked } from './offline/snapshot'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { band, logoUrl } = useBand()

watch([locale, () => route.meta.titleKey, band], () => {
  const titleKey = route.meta.titleKey
  const siteName = band.value?.name || t('app.name')
  document.title = titleKey ? `${t(titleKey)} · ${siteName}` : siteName
}, { immediate: true })

// The band's logo doubles as the tab icon
watch(logoUrl, (url) => {
  const icon = document.querySelector('link[rel="icon"]')
  if (!icon) return
  icon.href = url || '/favicon.svg'
  icon.type = url ? '' : 'image/svg+xml'
}, { immediate: true })

// Screens that need the server say so, instead of a pile of failed requests
const needsConnection = computed(() =>
  connectionLost.value && (route.name === 'Login' || (route.meta.requiresAuth && !route.meta.offline)),
)

// Once the server says access is gone there's nothing left to show, but a show isn't interrupted
watch([accessRevoked, () => route.query.visualizar], ([revoked, stage]) => {
  if (revoked && stage !== '1') router.replace({ path: '/login', query: { reason: 'expired' } })
})
</script>

<template>
  <OfflineNotice v-if="needsConnection" />
  <router-view v-else />
</template>

<style>
</style>
