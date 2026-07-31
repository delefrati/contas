<script setup>
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

const { t, locale } = useI18n()
const route = useRoute()

watch([locale, () => route.meta.titleKey], () => {
  const titleKey = route.meta.titleKey || 'app.title'
  document.title = titleKey === 'app.title' ? t('app.title') : `${t(titleKey)} · ${t('app.title')}`
}, { immediate: true })
</script>

<template>
  <router-view />
</template>

<style>
</style>
