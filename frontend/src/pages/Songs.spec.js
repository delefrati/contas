import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import Songs from './Songs.vue'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    isLoggedIn: { value: true },
    sessionExpired: { value: false },
    handleUnauthorized: vi.fn().mockResolvedValue('expired'),
    syncCopy: vi.fn(),
    readCopy: async () => (await import('../offline/snapshot')).readSnapshot(),
    scheduleCopySync: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn().mockResolvedValue({ memberId: 1, name: 'Test User' }),
    getAuthHeader: () => ({ Authorization: 'Bearer fake-token' }),
    member: ref({ id: 1, name: 'Test User' }),
  }),
}))

const songs = [
  { id: 3, title: 'Exagerado', artist: 'Cazuza', notes: null, hasLyrics: true },
  { id: 4, title: 'Malandragem', artist: null, notes: null, hasLyrics: false },
]

let lyricsResponse

function respond(data, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve({ data }) })
}

async function createWrapper() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en: {} }, missingWarn: false, fallbackWarn: false })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  router.push('/musicas')
  await router.isReady()

  const wrapper = mount(Songs, {
    global: {
      plugins: [i18n, router],
      stubs: {
        AppHeader: true,
        Modal: { template: '<div v-if="modelValue" class="modal-stub"><slot /></div>', props: ['modelValue', 'title'] },
      },
    },
  })
  await flushPromises()
  return wrapper
}

function editButton(wrapper, row) {
  return wrapper.findAll('tbody tr')[row].find('.btn-edit')
}

function lyricsTextarea(wrapper) {
  return wrapper.find('.modal-stub .lyrics-textarea')
}

function savedPayload() {
  const [, options] = mockFetch.mock.calls.find(([, o]) => o?.method === 'PATCH' || o?.method === 'POST')
  return JSON.parse(options.body)
}

describe('Songs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lyricsResponse = () => respond({ ...songs[0], lyrics: 'Amor da minha vida' })
    mockFetch.mockImplementation((url, options = {}) => {
      if (options.method) return respond({ ...songs[0] })
      if (url.endsWith('/api/songs/3')) return lyricsResponse()
      return respond(songs)
    })
  })

  it('should mark the songs that have lyrics', async () => {
    const wrapper = await createWrapper()
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0].find('.lyrics-mark').exists()).toBe(true)
    expect(rows[1].find('.lyrics-mark').exists()).toBe(false)
  })

  it('should load the lyrics when editing a song and save the changes', async () => {
    const wrapper = await createWrapper()
    await editButton(wrapper, 0).trigger('click')
    await flushPromises()

    expect(lyricsTextarea(wrapper).element.value).toBe('Amor da minha vida')
    await lyricsTextarea(wrapper).setValue('Amor da minha vida\n\nDaqui até a eternidade')
    await wrapper.find('.modal-stub form').trigger('submit')
    await flushPromises()

    expect(savedPayload()).toEqual({
      title: 'Exagerado',
      artist: 'Cazuza',
      notes: '',
      lyrics: 'Amor da minha vida\n\nDaqui até a eternidade',
    })
  })

  it('should not fetch lyrics for a song without them', async () => {
    const wrapper = await createWrapper()
    await editButton(wrapper, 1).trigger('click')
    await flushPromises()

    expect(mockFetch.mock.calls.some(([url]) => url.endsWith('/api/songs/4'))).toBe(false)
    expect(lyricsTextarea(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('should keep the lyrics when they fail to load', async () => {
    lyricsResponse = () => respond(null, false, 500)
    const wrapper = await createWrapper()
    await editButton(wrapper, 0).trigger('click')
    await flushPromises()

    expect(lyricsTextarea(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.find('.modal-stub form').trigger('submit')
    await flushPromises()

    expect(savedPayload()).not.toHaveProperty('lyrics')
  })

  describe('on a phone', () => {
    function phoneMenu(wrapper, row) {
      return wrapper.findAll('tbody tr')[row].find('.actions-mobile')
    }

    it('should offer edit and delete in a three-dot menu for each song', async () => {
      const wrapper = await createWrapper()
      expect(phoneMenu(wrapper, 0).find('.action-dropdown').exists()).toBe(false)

      await phoneMenu(wrapper, 0).find('.btn-dots').trigger('click')
      const items = phoneMenu(wrapper, 0).findAll('.action-dropdown button')
      expect(items).toHaveLength(2)
      expect(phoneMenu(wrapper, 1).find('.action-dropdown').exists()).toBe(false)

      await items[0].trigger('click')
      await flushPromises()
      expect(lyricsTextarea(wrapper).element.value).toBe('Amor da minha vida')
      expect(phoneMenu(wrapper, 0).find('.action-dropdown').exists()).toBe(false)
    })

    it('should delete a song from the menu after confirming', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const wrapper = await createWrapper()
      await phoneMenu(wrapper, 1).find('.btn-dots').trigger('click')
      await phoneMenu(wrapper, 1).findAll('.action-dropdown button')[1].trigger('click')
      await flushPromises()

      expect(confirmSpy).toHaveBeenCalled()
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/songs/4'), expect.objectContaining({ method: 'DELETE' }))
      confirmSpy.mockRestore()
    })

    it('should close the menu when tapping elsewhere', async () => {
      const wrapper = await createWrapper()
      await phoneMenu(wrapper, 0).find('.btn-dots').trigger('click')
      document.body.click()
      await flushPromises()
      expect(phoneMenu(wrapper, 0).find('.action-dropdown').exists()).toBe(false)
    })
  })
})
