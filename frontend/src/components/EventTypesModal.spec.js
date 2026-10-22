import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import EventTypesModal from './EventTypesModal.vue'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer fake-token' }) }),
}))

const messages = {
  en: {
    agenda: { typeNameRequired: 'Type name is required', typeExists: 'A type with this name already exists' },
    errors: { genericError: 'An error occurred' },
  },
}

const types = [
  { id: 1, name: 'Show', color: '#667eea' },
  { id: 2, name: 'Rehearsal', color: '#48bb78' },
]

function createWrapper() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages, missingWarn: false, fallbackWarn: false })
  return mount(EventTypesModal, {
    props: { modelValue: true, types },
    global: {
      plugins: [i18n],
      stubs: { Modal: { template: '<div class="modal-stub"><slot /></div>', props: ['modelValue', 'title'] } },
    },
  })
}

function lastRequest() {
  const [url, options] = mockFetch.mock.calls.at(-1)
  return { url, method: options.method, body: options.body && JSON.parse(options.body) }
}

describe('EventTypesModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('confirm', vi.fn(() => true))
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve({ data: {} }) })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should list the types', () => {
    const wrapper = createWrapper()
    expect(wrapper.findAll('.type-name').map((n) => n.text())).toEqual(['Show', 'Rehearsal'])
  })

  it('should add a type with the first color not in use', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.new-type input').setValue('  Get-together ')
    await wrapper.find('.new-type').trigger('submit')
    await flushPromises()

    expect(lastRequest()).toMatchObject({
      method: 'POST',
      body: { name: 'Get-together', color: '#ed8936' },
    })
    expect(lastRequest().url).toMatch(/\/api\/event-types$/)
    expect(wrapper.emitted('changed')).toHaveLength(1)
    expect(wrapper.find('.new-type input').element.value).toBe('')
  })

  it('should not add a type without a name', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.new-type').trigger('submit')
    expect(mockFetch).not.toHaveBeenCalled()
    expect(wrapper.find('.alert-error').text()).toBe('Type name is required')
  })

  it('should explain when the name is taken', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 409, json: () => Promise.resolve({}) })
    const wrapper = createWrapper()
    await wrapper.find('.new-type input').setValue('Show')
    await wrapper.find('.new-type').trigger('submit')
    await flushPromises()
    expect(wrapper.find('.alert-error').text()).toBe('A type with this name already exists')
    expect(wrapper.emitted('changed')).toBeUndefined()
  })

  it('should rename and recolor a type', async () => {
    const wrapper = createWrapper()
    await wrapper.findAll('.type-row')[1].find('.btn-edit').trigger('click')
    const form = wrapper.find('.type-row .type-form')
    await form.find('input').setValue('Ensaio')
    await form.findAll('.swatch')[3].trigger('click')
    await form.trigger('submit')
    await flushPromises()

    expect(lastRequest()).toMatchObject({
      method: 'PATCH',
      body: { name: 'Ensaio', color: '#e53e3e' },
    })
    expect(lastRequest().url).toMatch(/\/api\/event-types\/2$/)
  })

  it('should delete a type after confirming', async () => {
    const wrapper = createWrapper()
    await wrapper.findAll('.type-row')[0].find('.btn-delete').trigger('click')
    await flushPromises()

    expect(confirm).toHaveBeenCalled()
    expect(lastRequest()).toMatchObject({ method: 'DELETE' })
    expect(lastRequest().url).toMatch(/\/api\/event-types\/1$/)
  })
})
