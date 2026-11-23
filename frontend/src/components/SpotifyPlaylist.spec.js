import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '../i18n/locales/en.json'
import SpotifyPlaylist from './SpotifyPlaylist.vue'

const mockFetch = vi.fn()
global.fetch = mockFetch

const scheduleCopySync = vi.fn()
vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer t' }), scheduleCopySync }),
}))

const LINK = 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC'
const songs = [
  { id: 3, title: 'Exagerado', artist: 'Cazuza', spotifyUrl: LINK },
  { id: 4, title: 'Malandragem', artist: null, spotifyUrl: null },
  { id: 5, title: 'Pais e Filhos', artist: 'Legião Urbana', spotifyUrl: LINK },
]

function reply(status, body) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })
}

let availability
let makeReply
let searchReply

const FOUND = [
  {
    id: 'live',
    name: 'Malandragem - Ao Vivo',
    artists: ['Cássia Eller'],
    album: 'Acústico (Ao Vivo)',
    year: '2001',
    durationMs: 240799,
    imageUrl: 'https://i.scdn.co/image/cover',
    url: 'https://open.spotify.com/track/2PIHTeccvbpmrSeYrlWkfx',
  },
  { id: 'studio', name: 'Malandragem', artists: ['Cássia Eller'], album: null, year: null, durationMs: 200000, imageUrl: null, url: 'https://open.spotify.com/track/studio' },
]

async function createWrapper(props = {}) {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
  const wrapper = mount(SpotifyPlaylist, {
    props: { songs, endpoint: '/api/spotify/playlists/events/7', ...props },
    global: {
      plugins: [i18n],
      stubs: { Modal: { template: '<div v-if="modelValue" class="modal-stub"><slot /></div>', props: ['modelValue', 'title'] } },
    },
  })
  await flushPromises()
  return wrapper
}

async function openDialog(wrapper) {
  await wrapper.find('.spotify-playlist-button').trigger('click')
}

describe('SpotifyPlaylist', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    scheduleCopySync.mockReset()
    availability = 'working'
    searchReply = () => reply(200, { data: FOUND })
    makeReply = () => reply(201, { data: { url: 'https://open.spotify.com/playlist/abc', tracks: 2, missing: 1 } })
    mockFetch.mockImplementation((url, options = {}) => {
      if (url.endsWith('/api/spotify/status')) return reply(200, { data: { availability } })
      if (url.endsWith('/api/spotify/playlists/events/7')) return makeReply()
      if (options.method === 'PATCH') return reply(200, { data: { id: 4, spotifyUrl: JSON.parse(options.body).spotifyUrl } })
      if (url.includes('/api/spotify/songs/4/tracks')) return searchReply()
      return reply(404, {})
    })
  })

  it('should not show the button when Spotify is not set up', async () => {
    availability = 'not-set-up'
    const wrapper = await createWrapper()

    expect(wrapper.find('.spotify-playlist-button').exists()).toBe(false)
  })

  it('should be off without internet', async () => {
    const wrapper = await createWrapper({ disabled: true })

    expect(wrapper.find('.spotify-playlist-button').attributes('disabled')).toBeDefined()
  })

  it('should warn about the songs without a link before making the playlist, and that it is public', async () => {
    const wrapper = await createWrapper()
    await openDialog(wrapper)

    expect(wrapper.find('.will-include').text()).toBe('2 songs with a link will go in, in order.')
    expect(wrapper.find('.public-note').text()).toContain('public')
    const missing = wrapper.findAll('.missing-song')
    expect(missing).toHaveLength(1)
    expect(missing[0].text()).toContain('Malandragem')
  })

  it('should make the playlist and give its link', async () => {
    const wrapper = await createWrapper()
    await openDialog(wrapper)
    await wrapper.find('.make-playlist').trigger('click')
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/spotify/playlists/events/7'), expect.objectContaining({ method: 'POST' }))
    expect(wrapper.find('.made').text()).toContain('Playlist ready, with 2 songs.')
    const link = wrapper.find('a.open-playlist')
    expect(link.attributes('href')).toBe('https://open.spotify.com/playlist/abc')
    expect(link.attributes('target')).toBe('_blank')
    expect(wrapper.find('.make-playlist').text()).toContain('Update again')
  })

  it('should save a link pasted for a song without one', async () => {
    const wrapper = await createWrapper()
    await openDialog(wrapper)
    await wrapper.find('.missing-link input').setValue(` ${LINK} `)
    await wrapper.find('.missing-link').trigger('submit')
    await flushPromises()

    const [url, options] = mockFetch.mock.calls.find(([, o]) => o?.method === 'PATCH')
    expect(url).toContain('/api/songs/4')
    expect(JSON.parse(options.body)).toEqual({ spotifyUrl: LINK })
    expect(wrapper.emitted('song-updated')).toEqual([[4, LINK]])
    expect(scheduleCopySync).toHaveBeenCalled()
  })

  it('should refuse a pasted link that is not a Spotify track, without saving', async () => {
    const wrapper = await createWrapper()
    await openDialog(wrapper)
    await wrapper.find('.missing-link input').setValue('https://open.spotify.com/album/4uLU6hMCjMI75M1A2tKUQC')
    await wrapper.find('.missing-link').trigger('submit')
    await flushPromises()

    expect(mockFetch.mock.calls.some(([, o]) => o?.method === 'PATCH')).toBe(false)
    expect(wrapper.find('.draft-error').text()).toBe(en.songs.invalidSpotifyLink)
  })

  it('should not offer to make a playlist when no song has a link', async () => {
    const wrapper = await createWrapper({ songs: [songs[1]] })
    await openDialog(wrapper)

    expect(wrapper.find('.will-include').text()).toBe('No song with a link will go in.')
    expect(wrapper.find('.make-playlist').attributes('disabled')).toBeDefined()
  })

  it('should say Spotify is unavailable when the connection is broken, without offering to make one', async () => {
    availability = 'unavailable'
    const wrapper = await createWrapper()
    await openDialog(wrapper)

    expect(wrapper.find('.unavailable').text()).toBe(en.spotify.unavailable)
    expect(wrapper.find('.make-playlist').exists()).toBe(false)
  })

  it.each([
    ['SPOTIFY_RATE_LIMITED', 429, en.spotify.rateLimited],
    ['SPOTIFY_ERROR', 502, en.spotify.error],
    ['SPOTIFY_UNAVAILABLE', 503, en.spotify.unavailable],
  ])('should translate %s', async (code, status, message) => {
    makeReply = () => reply(status, { message: 'English', code })
    const wrapper = await createWrapper()
    await openDialog(wrapper)
    await wrapper.find('.make-playlist').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain(message)
    expect(wrapper.text()).not.toContain('English')
  })

  describe("searching a song's version", () => {
    async function searchFirstMissing(wrapper) {
      await openDialog(wrapper)
      await wrapper.find('.missing-link').trigger('submit')
      await flushPromises()
    }

    it('should show the tracks found, each to listen to on Spotify', async () => {
      const wrapper = await createWrapper()
      await searchFirstMissing(wrapper)

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/spotify/songs/4/tracks'), expect.anything())
      const found = wrapper.findAll('.track-result')
      expect(found).toHaveLength(2)
      expect(found[0].text()).toContain('Malandragem - Ao Vivo')
      expect(found[0].find('.track-info small').text().replace(/\s+/g, ' ')).toBe('Cássia Eller · Acústico (Ao Vivo) (2001) · 4:01')
      expect(found[0].find('img.track-cover').attributes('src')).toBe('https://i.scdn.co/image/cover')
      expect(found[0].find('a.listen').attributes('target')).toBe('_blank')
      expect(found[1].find('img').exists()).toBe(false)
      expect(mockFetch.mock.calls.some(([, o]) => o?.method === 'PATCH')).toBe(false)
    })

    it('should search the words typed in the link field when Enter is pressed, without saving', async () => {
      const wrapper = await createWrapper()
      await openDialog(wrapper)
      await wrapper.find('.missing-link input').setValue(' malandragem ao vivo ')
      expect(wrapper.find('.save-link').exists()).toBe(false)
      await wrapper.find('.missing-link').trigger('submit')
      await flushPromises()

      const [url] = mockFetch.mock.calls.find(([u]) => u.includes('/tracks'))
      expect(new URL(url).searchParams.get('q')).toBe('malandragem ao vivo')
      expect(wrapper.findAll('.track-result')).toHaveLength(2)
      expect(wrapper.find('.draft-error').exists()).toBe(false)
      expect(mockFetch.mock.calls.some(([, o]) => o?.method === 'PATCH')).toBe(false)
    })

    it('should offer Save instead of Search once a link is in the field', async () => {
      const wrapper = await createWrapper()
      await openDialog(wrapper)
      await wrapper.find('.missing-link input').setValue(LINK)

      expect(wrapper.find('.save-link').exists()).toBe(true)
      expect(wrapper.find('.search-song').exists()).toBe(false)
    })

    it('should save the picked track as the song link', async () => {
      const wrapper = await createWrapper()
      await searchFirstMissing(wrapper)
      await wrapper.findAll('.use-track')[0].trigger('click')
      await flushPromises()

      const [url, options] = mockFetch.mock.calls.find(([, o]) => o?.method === 'PATCH')
      expect(url).toContain('/api/songs/4')
      expect(JSON.parse(options.body)).toEqual({ spotifyUrl: 'https://open.spotify.com/track/2PIHTeccvbpmrSeYrlWkfx' })
      expect(wrapper.emitted('song-updated')).toEqual([[4, 'https://open.spotify.com/track/2PIHTeccvbpmrSeYrlWkfx']])
    })

    it('should say nothing was found, keeping the paste field', async () => {
      searchReply = () => reply(200, { data: [] })
      const wrapper = await createWrapper()
      await searchFirstMissing(wrapper)

      expect(wrapper.find('.nothing-found').text()).toBe(en.spotify.nothingFound)
      expect(wrapper.find('.missing-link input').exists()).toBe(true)
    })

    it('should say under the song when Spotify asks to wait', async () => {
      searchReply = () => reply(429, { message: 'English', code: 'SPOTIFY_RATE_LIMITED' })
      const wrapper = await createWrapper()
      await searchFirstMissing(wrapper)

      expect(wrapper.find('.draft-error').text()).toBe(en.spotify.rateLimited)
    })

    it('should be off without internet', async () => {
      const wrapper = await createWrapper({ disabled: true })
      wrapper.vm.isOpen = true
      await flushPromises()

      expect(wrapper.find('.search-song').attributes('disabled')).toBeDefined()
    })
  })
})
