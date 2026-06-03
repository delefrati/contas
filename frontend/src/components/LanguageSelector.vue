<template>
  <div class="language-selector">
    <label for="language-select">{{ $t('language.select') }}</label>
    <select 
      id="language-select" 
      v-model="currentLocale"
      @change="changeLanguage"
      class="language-select"
    >
      <option value="pt">Português</option>
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()

const currentLocale = computed({
  get: () => locale.value,
  set: (value) => {
    locale.value = value
    localStorage.setItem('language', value)
  }
})

const changeLanguage = () => {
  // The computed setter handles the change
}
</script>

<style scoped>
.language-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.language-selector label {
  font-weight: 500;
  font-size: 14px;
}

.language-select {
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid #ccc;
  background-color: white;
  color: #333;
  cursor: pointer;
  font-size: 14px;
}

.language-select:hover {
  border-color: #999;
}

.language-select:focus {
  outline: none;
  border-color: #4CAF50;
  box-shadow: 0 0 5px rgba(76, 175, 80, 0.3);
}
</style>
