import { ref, watch } from 'vue'

// Light, dark, or whatever the system says. Kept per device, like the language, and applied as
// data-theme on <html> (style.scss reads it). index.html applies it once before the first paint.
export const THEME_KEY = 'theme'
export const THEMES = ['system', 'light', 'dark']

function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (THEMES.includes(saved)) return saved
  } catch {
    // Follow the system
  }
  return 'system'
}

export const theme = ref(readTheme())

watch(theme, (value) => {
  if (value === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = value
  try {
    if (value === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, value)
  } catch {
    // It applies until the app is closed
  }
}, { immediate: true, flush: 'sync' })
