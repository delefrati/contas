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

const TRACK_URL = 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'

const songs = [
  { id: 3, title: 'Exagerado', artist: 'Cazuza', notes: null, hasLyrics: true, spotifyUrl: TRACK_URL },
  { id: 4, title: 'Malandragem', artist: null, notes: null, hasLyrics: false, spotifyUrl: null },
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

  it('should number the songs in the order of the list', async () => {
    const wrapper = await createWrapper()
    const numbers = wrapper.findAll('tbody tr .song-number').map((n) => n.text())
    expect(numbers).toEqual(['1.', '2.'])
  })

  it('should keep a song\'s number when the filter hides the others', async () => {
    const wrapper = await createWrapper()
    await wrapper.find('.search-input').setValue('malandragem')
    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(1)
    expect(rows[0].find('.song-number').text()).toBe('2.')
    expect(rows[0].text()).toContain('Malandragem')
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
      spotifyUrl: TRACK_URL,
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

  describe('Spotify link', () => {
    function spotifyInput(wrapper) {
      return wrapper.find('.modal-stub .spotify-input')
    }

    async function submit(wrapper) {
      await wrapper.find('.modal-stub form').trigger('submit')
      await flushPromises()
    }

    it('should show the Spotify icon only on songs with a link, opening it in a new tab', async () => {
      const wrapper = await createWrapper()
      const rows = wrapper.findAll('tbody tr')
      const link = rows[0].find('a.spotify-link')
      expect(link.attributes('href')).toBe(TRACK_URL)
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toContain('noopener')
      expect(rows[1].find('a.spotify-link').exists()).toBe(false)
    })

    it('should save a pasted link with the song', async () => {
      const wrapper = await createWrapper()
      await editButton(wrapper, 1).trigger('click')
      await spotifyInput(wrapper).setValue(' spotify:track:4uLU6hMCjMI75M1A2tKUQC ')
      await submit(wrapper)

      expect(savedPayload().spotifyUrl).toBe('spotify:track:4uLU6hMCjMI75M1A2tKUQC')
    })

    it('should send an empty link to remove it', async () => {
      const wrapper = await createWrapper()
      await editButton(wrapper, 0).trigger('click')
      await flushPromises()
      expect(spotifyInput(wrapper).element.value).toBe(TRACK_URL)
      await spotifyInput(wrapper).setValue('')
      await submit(wrapper)

      expect(savedPayload().spotifyUrl).toBe('')
    })

    it('should refuse a link that is not a Spotify track without saving', async () => {
      const wrapper = await createWrapper()
      await editButton(wrapper, 1).trigger('click')
      await spotifyInput(wrapper).setValue('https://open.spotify.com/album/4uLU6hMCjMI75M1A2tKUQC')
      await submit(wrapper)

      expect(mockFetch.mock.calls.some(([, o]) => o?.method === 'PATCH')).toBe(false)
      expect(wrapper.find('.alert-error').text()).toBe('songs.invalidSpotifyLink')
      expect(wrapper.find('.modal-stub').exists()).toBe(true)
    })

    it('should translate the server refusing the link', async () => {
      mockFetch.mockImplementation((url, options = {}) => {
        if (options.method) {
          return Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ message: 'Not a Spotify track link.', code: 'INVALID_SPOTIFY_LINK' }) })
        }
        return respond(songs)
      })
      const wrapper = await createWrapper()
      await editButton(wrapper, 1).trigger('click')
      await submit(wrapper)

      expect(wrapper.find('.alert-error').text()).toBe('songs.invalidSpotifyLink')
    })
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
      expect(phoneMenu(wrapper, 0).find('.action-dropdown a').attributes('href')).toBe(TRACK_URL)
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
