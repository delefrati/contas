import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import BandLogoModal from './BandLogoModal.vue'

const mockFetch = vi.fn()
global.fetch = mockFetch

const logoUrl = ref(null)
const setBand = vi.fn()

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer fake-token' }) }),
}))
vi.mock('../composables/useBand', () => ({
  useBand: () => ({ logoUrl, setBand }),
}))

const messages = {
  en: {
    band: {
      logo: 'Band logo', noLogo: 'No logo', chooseFile: 'Choose image', removeLogo: 'Remove logo',
      confirmRemoveLogo: 'Remove?', invalidType: 'Use a PNG, JPG or WebP image.', tooLarge: 'Larger than 1 MB.',
    },
    actions: { save: 'Save', loading: 'Loading' },
    errors: { genericError: 'An error occurred' },
  },
}

function createWrapper() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages, missingWarn: false, fallbackWarn: false })
  return mount(BandLogoModal, {
    props: { modelValue: true },
    global: {
      plugins: [i18n],
      stubs: { Modal: { template: '<div class="modal-stub"><slot /></div>', props: ['modelValue', 'title'] } },
    },
  })
}

async function choose(wrapper, file) {
  const input = wrapper.find('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file], configurable: true })
  await input.trigger('change')
}

function image(type, size = 10) {
  return new File([new Uint8Array(size)], 'logo', { type })
}

describe('BandLogoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    logoUrl.value = null
    vi.stubGlobal('confirm', vi.fn(() => true))
    URL.createObjectURL = vi.fn(() => 'blob:preview')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should say when the band has no logo yet', () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.logo-preview').text()).toBe('No logo')
    expect(wrapper.find('.logo-remove').exists()).toBe(false)
  })

  it('should preview the chosen image and upload it as multipart', async () => {
    const updated = { id: 1, name: 'Maverick', logoUrl: '/api/band/logo?v=1' }
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: updated }) })
    const wrapper = createWrapper()
    const file = image('image/png')

    await choose(wrapper, file)
    expect(wrapper.find('.logo-preview img').attributes('src')).toBe('blob:preview')

    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    const [url, options] = mockFetch.mock.calls[0]
    expect(url).toMatch(/\/api\/band\/logo$/)
    expect(options.method).toBe('PUT')
    expect(options.headers).toEqual({ Authorization: 'Bearer fake-token' })
    expect(options.body.get('logo')).toBe(file)
    expect(setBand).toHaveBeenCalledWith(updated)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('should refuse an SVG before uploading', async () => {
    const wrapper = createWrapper()
    await choose(wrapper, image('image/svg+xml'))

    expect(wrapper.find('.alert-error').text()).toBe('Use a PNG, JPG or WebP image.')
    expect(wrapper.find('.btn-primary').exists()).toBe(false)
  })

  it('should refuse an image over 1 MB before uploading', async () => {
    const wrapper = createWrapper()
    await choose(wrapper, image('image/jpeg', 1024 * 1024 + 1))

    expect(wrapper.find('.alert-error').text()).toBe('Larger than 1 MB.')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('should show the error the API returns', async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({ message: 'Logo must be a PNG, JPEG or WebP image' }) })
    const wrapper = createWrapper()

    await choose(wrapper, image('image/png'))
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(wrapper.find('.alert-error').text()).toBe('Logo must be a PNG, JPEG or WebP image')
    expect(setBand).not.toHaveBeenCalled()
  })

  it('should remove the current logo after confirming', async () => {
    logoUrl.value = 'http://api/api/band/logo?v=1'
    const updated = { id: 1, name: 'Maverick', logoUrl: null }
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: updated }) })
    const wrapper = createWrapper()

    await wrapper.find('.logo-remove').trigger('click')
    await flushPromises()

    expect(mockFetch.mock.calls[0][1].method).toBe('DELETE')
    expect(setBand).toHaveBeenCalledWith(updated)
  })
})
