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
})
