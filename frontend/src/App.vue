<script setup>
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t, locale } = useI18n()

watch(locale, () => {
  document.title = t('app.title')
}, { immediate: true })
</script>

<template>
  <router-view />
</template>

<style>
</style>
