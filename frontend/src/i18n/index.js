import { watch } from 'vue'
import { createI18n } from 'vue-i18n'
import { localeTag } from '../utils/date'
import pt from './locales/pt.json'
import en from './locales/en.json'
import es from './locales/es.json'

// Get language from localStorage or browser, default to Portuguese
const getInitialLocale = () => {
  const stored = localStorage.getItem('language')
  if (stored) return stored

  const browserLang = navigator.language.split('-')[0]
  if (['pt', 'en', 'es'].includes(browserLang)) {
    return browserLang
  }

  return 'pt'
}

const i18n = createI18n({
  legacy: false,
  locale: getInitialLocale(),
  fallbackLocale: 'pt',
  messages: {
    pt,
    en,
    es,
  },
})

// The page says which language it's in, so the browser doesn't take Portuguese for another
// language and offer to translate it
watch(i18n.global.locale, (locale) => {
  document.documentElement.lang = localeTag(locale)
}, { immediate: true, flush: 'sync' })

export default i18n
