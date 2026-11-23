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
    makeReply = () => reply(201, { data: { url: 'https://open.spotify.com/playlist/abc', tracks: 2, missing: 1 } })
    mockFetch.mockImplementation((url, options = {}) => {
      if (url.endsWith('/api/spotify/status')) return reply(200, { data: { availability } })
      if (url.endsWith('/api/spotify/playlists/events/7')) return makeReply()
      if (options.method === 'PATCH') return reply(200, { data: { id: 4, spotifyUrl: LINK } })
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
})
