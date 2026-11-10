import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

async function loadI18n() {
  vi.resetModules()
  return (await import('./index.js')).default
}

describe('i18n and the browser', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.lang = ''
  })

  it('tells the browser the page is in the saved language from the start', async () => {
    localStorage.setItem('language', 'es')
    await loadI18n()
    expect(document.documentElement.lang).toBe('es')
  })

  it('says pt-BR for Portuguese, like the manifest', async () => {
    localStorage.setItem('language', 'pt')
    await loadI18n()
    expect(document.documentElement.lang).toBe('pt-BR')
  })

  it('follows the language when it is changed', async () => {
    localStorage.setItem('language', 'pt')
    const i18n = await loadI18n()

    i18n.global.locale.value = 'en'
    expect(document.documentElement.lang).toBe('en')

    i18n.global.locale.value = 'pt'
    expect(document.documentElement.lang).toBe('pt-BR')
  })

  it('opts the page out of browser translation', () => {
    const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8')
    expect(html).toMatch(/<html lang="pt-BR" translate="no">/)
    expect(html).toMatch(/<meta name="google" content="notranslate" \/>/)
  })
})
