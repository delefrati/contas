import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import en from '../../i18n/locales/en.json'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('../../utils/googleSignIn', () => ({ renderGoogleButton: vi.fn() }))

function reply(status, body) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) })
}

const working = {
  configured: true,
  problem: null,
  connection: {
    spotifyUserId: 'minhabanda',
    displayName: 'minhabanda.com',
    broken: false,
    connectedAt: '2026-11-23T12:00:00Z',
    connectedBy: 'Paula',
  },
}

let status

async function createWrapper(path = '/admin/spotify') {
  const { default: AdminSpotify } = await import('./AdminSpotify.vue')
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/spotify', component: AdminSpotify },
      { path: '/:other(.*)', component: { template: '<div />' } },
    ],
  })
  await router.push(path)

  const wrapper = mount(AdminSpotify, {
    global: { plugins: [i18n, router], stubs: { LanguageSelector: true } },
  })
  await flushPromises()
  return { wrapper, router }
}

function button(wrapper, text) {
  return wrapper.findAll('button').find((b) => b.text().includes(text))
}

describe('AdminSpotify', () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    localStorage.setItem('admin_token', 'admin-token')
    localStorage.setItem('admin_user', JSON.stringify({ id: 3, name: 'Paula', email: 'paula@test.com' }))
    status = working
    mockFetch.mockReset()
    mockFetch.mockImplementation((url, options = {}) => {
      if (url.endsWith('/auth/me')) return reply(200, { data: { superAdminId: 3, name: 'Paula', email: 'paula@test.com' } })
      if (url.endsWith('/spotify/connect')) return reply(201, { data: { url: 'https://accounts.spotify.com/authorize?state=s' } })
      if (options.method === 'DELETE') return reply(200, { message: 'Disconnected' })
      return reply(200, { data: status })
    })
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.stubGlobal('location', { ...window.location, assign: vi.fn() })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('should show the connected account, who connected it and that it works', async () => {
    const { wrapper } = await createWrapper()

    expect(wrapper.find('.spotify-badge').text()).toBe('Working')
    expect(wrapper.find('.spotify-facts').text()).toContain('minhabanda.com')
    expect(wrapper.find('.spotify-facts').text()).toContain('Paula')
    expect(button(wrapper, 'Connect another account')).toBeTruthy()
    expect(button(wrapper, 'Disconnect')).toBeTruthy()
  })

  it('should say when Spotify dropped the connection, and offer to connect again', async () => {
    status = { ...working, connection: { ...working.connection, broken: true } }
    const { wrapper } = await createWrapper()

    expect(wrapper.find('.spotify-badge').text()).toBe('Disconnected by Spotify')
    expect(wrapper.find('.broken-hint').exists()).toBe(true)
    expect(button(wrapper, 'Connect again').classes()).toContain('btn-primary')
  })

  it('should say Spotify is not set up, with the server problem when there is one', async () => {
    status = { configured: false, problem: 'SPOTIFY_TOKEN_KEY must be 32 bytes in base64.', connection: null }
    const { wrapper } = await createWrapper()

    expect(wrapper.find('.not-set-up').text()).toContain("Spotify isn't set up")
    expect(wrapper.find('.problem').text()).toContain('SPOTIFY_TOKEN_KEY')
    expect(wrapper.findAll('button').some((b) => b.text().includes('Connect'))).toBe(false)
  })

  it('should send the super admin to Spotify to connect', async () => {
    status = { configured: true, problem: null, connection: null }
    const { wrapper } = await createWrapper()

    expect(wrapper.find('.not-connected').exists()).toBe(true)
    await button(wrapper, 'Connect Spotify account').trigger('click')
    await flushPromises()

    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/admin/spotify/connect'), expect.objectContaining({ method: 'POST' }))
    expect(window.location.assign).toHaveBeenCalledWith('https://accounts.spotify.com/authorize?state=s')
  })

  it('should disconnect after confirming', async () => {
    const { wrapper } = await createWrapper()
    status = { configured: true, problem: null, connection: null }

    await button(wrapper, 'Disconnect').trigger('click')
    await flushPromises()

    expect(confirm).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/api/admin/spotify'), expect.objectContaining({ method: 'DELETE' }))
    expect(wrapper.find('.alert-success').text()).toContain('Spotify account disconnected.')
    expect(wrapper.find('.not-connected').exists()).toBe(true)
  })

  it.each([
    ['connected', '.alert-success', 'Spotify account connected!'],
    ['cancelled', '.alert-success', 'Nothing changed.'],
    ['expired', '.alert-error', 'The connection request expired.'],
    ['failed', '.alert-error', "Couldn't connect to Spotify."],
  ])('should tell how the connection ended (%s) and clean the address', async (outcome, alert, text) => {
    const { wrapper, router } = await createWrapper(`/admin/spotify?spotify=${outcome}`)

    expect(wrapper.find(alert).text()).toContain(text)
    expect(router.currentRoute.value.query).toEqual({})
  })
})
