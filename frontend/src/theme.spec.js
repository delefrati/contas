import { describe, it, expect, beforeEach, vi } from 'vitest'

// theme.js reads the saved choice once, when it's first imported
async function loadTheme() {
  vi.resetModules()
  return import('./theme')
}

describe('theme', () => {
  beforeEach(() => {
    localStorage.clear()
    delete document.documentElement.dataset.theme
  })

  it('follows the system until something else is chosen', async () => {
    const { theme } = await loadTheme()
    expect(theme.value).toBe('system')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })

  it('applies a chosen theme to the page and keeps it on this device', async () => {
    const { theme } = await loadTheme()
    theme.value = 'dark'
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')

    theme.value = 'light'
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
  })

  it('goes back to the system setting', async () => {
    const { theme } = await loadTheme()
    theme.value = 'dark'
    theme.value = 'system'
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('theme')).toBeNull()
  })

  it('starts with the theme chosen last time', async () => {
    localStorage.setItem('theme', 'dark')
    const { theme } = await loadTheme()
    expect(theme.value).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('ignores a saved value it does not know', async () => {
    localStorage.setItem('theme', 'purple')
    const { theme } = await loadTheme()
    expect(theme.value).toBe('system')
  })
})
