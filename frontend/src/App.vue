<script setup>
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useBand } from './composables/useBand'

const { t, locale } = useI18n()
const route = useRoute()
const { band } = useBand()

watch([locale, () => route.meta.titleKey, band], () => {
  const titleKey = route.meta.titleKey
  const siteName = band.value?.name || t('app.name')
  document.title = titleKey ? `${t(titleKey)} · ${siteName}` : siteName
}, { immediate: true })
</script>

<template>
  <router-view />
</template>

<style>
</style>
