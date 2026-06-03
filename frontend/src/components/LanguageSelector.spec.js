import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import LanguageSelector from './LanguageSelector.vue'

const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: () => { store = {} },
  }
})()
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

function createWrapper(locale = 'pt') {
  const i18n = createI18n({
    legacy: false,
    locale,
    messages: {
      pt: { language: { select: 'Idioma' } },
      en: { language: { select: 'Language' } },
      es: { language: { select: 'Idioma' } },
    },
  })

  return mount(LanguageSelector, {
    global: { plugins: [i18n] },
  })
}

describe('LanguageSelector', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('should render with three language options', () => {
    const wrapper = createWrapper()
    const options = wrapper.findAll('option')
    expect(options).toHaveLength(3)
    expect(options[0].text()).toBe('Português')
    expect(options[1].text()).toBe('English')
    expect(options[2].text()).toBe('Español')
  })

  it('should display current locale as selected', () => {
    const wrapper = createWrapper('en')
    const select = wrapper.find('select')
    expect(select.element.value).toBe('en')
  })

  it('should save language to localStorage when changed', async () => {
    const wrapper = createWrapper('pt')
    const select = wrapper.find('select')

    await select.setValue('en')
    await select.trigger('change')

    expect(localStorageMock.setItem).toHaveBeenCalledWith('language', 'en')
  })

  it('should display the label text', () => {
    const wrapper = createWrapper('pt')
    expect(wrapper.find('label').text()).toBe('Idioma')
  })
})
