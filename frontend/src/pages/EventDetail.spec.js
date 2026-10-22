import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import EventDetail from './EventDetail.vue'

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

const messages = {
  en: {
    agenda: {
      title: 'Calendar',
      songCount: 'no songs | {n} song | {n} songs', notFound: 'Event not found.',
    },
    repertoires: { copyNewEvent: 'New event on this date' },
    errors: { genericError: 'An error occurred' },
  },
}

const showType = { id: 1, name: 'Show', color: '#667eea' }
const rehearsalType = { id: 2, name: 'Rehearsal', color: '#48bb78' }

const show = {
  id: 7, typeId: 1, type: showType, title: 'Bar do Zé', date: '2026-10-24', time: '21:00',
  location: 'Centro', notes: null, songCount: 2,
  setlist: [
    { id: 1, type: 'song', songId: 3, title: 'Exagerado', artist: 'Cazuza', label: null, position: 0 },
    { id: 2, type: 'pause', songId: null, title: null, artist: null, label: 'BIS', position: 1 },
    { id: 3, type: 'song', songId: 4, title: 'Malandragem', artist: null, label: null, position: 2 },
  ],
}

let eventsOnDate = []

function respond(data, ok = true, status = 200) {
  return Promise.resolve({ ok, status, json: () => Promise.resolve({ data }) })
}

async function createWrapper() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages, missingWarn: false, fallbackWarn: false })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/agenda/:id', component: EventDetail },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  router.push('/agenda/7')
  await router.isReady()

  const wrapper = mount(EventDetail, {
    global: {
      plugins: [i18n, router],
      stubs: {
        LanguageSelector: true,
        EventFormModal: true,
        Modal: { template: '<div v-if="modelValue" class="modal-stub"><slot /></div>', props: ['modelValue', 'title'] },
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

function copyButton(wrapper) {
  return wrapper.findAll('button').find((b) => b.text().includes('repertoires.copy'))
}

describe('EventDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    eventsOnDate = []
    vi.stubGlobal('confirm', vi.fn(() => true))
    mockFetch.mockImplementation((url, options = {}) => {
      if (url.includes('/api/songs')) return respond([])
      if (url.includes('/api/event-types')) return respond([rehearsalType, showType])
      if (url.includes('/api/events?')) return respond(eventsOnDate)
      if (options.method === 'POST') return respond({ ...show, id: 20 })
      if (options.method === 'PATCH') return respond({ ...show, id: 21 })
      return respond(show)
    })
  })

  it('should show the event and its setlist', async () => {
    const { wrapper } = await createWrapper()
    expect(wrapper.find('.event-heading').text()).toContain('Bar do Zé')
    expect(wrapper.find('.event-heading .type-tag').text()).toBe('Show')
    expect(wrapper.find('.event-facts').text()).toContain('21:00')
    const items = wrapper.findAll('.song-order-item')
    expect(items).toHaveLength(3)
    expect(items[2].find('.song-position').text()).toBe('2')
  })

  it('should copy the setlist into a new event on another date', async () => {
    const { wrapper, router } = await createWrapper()
    await copyButton(wrapper).trigger('click')
    await wrapper.find('.modal-stub input[type="date"]').setValue('2026-11-07')
    await flushPromises()
    const typeSelect = wrapper.find('.modal-stub select')
    // Defaults to this event's type
    expect(typeSelect.element.value).toBe('1')
    await typeSelect.setValue('2')
    await wrapper.find('.modal-stub form').trigger('submit')
    await flushPromises()

    const [url, options] = mockFetch.mock.calls.find(([, o]) => o?.method === 'POST')
    expect(url).toMatch(/\/api\/events$/)
    expect(JSON.parse(options.body)).toEqual({
      typeId: 2,
      date: '2026-11-07',
      items: [
        { type: 'song', songId: 3 },
        { type: 'pause', label: 'BIS' },
        { type: 'song', songId: 4 },
      ],
    })
    expect(router.currentRoute.value.path).toBe('/agenda/20')
  })

  it('should copy into an existing event on that date after confirming the replacement', async () => {
    eventsOnDate = [{ id: 21, typeId: 2, type: rehearsalType, title: '', date: '2026-11-04', time: '19:00', songCount: 5 }]
    const { wrapper, router } = await createWrapper()
    await copyButton(wrapper).trigger('click')
    await wrapper.find('.modal-stub input[type="date"]').setValue('2026-11-04')
    await flushPromises()

    expect(mockFetch.mock.calls.some(([u]) => u.includes('/api/events?from=2026-11-04&to=2026-11-04'))).toBe(true)
    expect(wrapper.find('.copy-targets').text()).toContain('Rehearsal · 19:00 (5 songs)')

    await wrapper.find('.modal-stub form').trigger('submit')
    await flushPromises()

    expect(confirm).toHaveBeenCalled()
    const [url, options] = mockFetch.mock.calls.find(([, o]) => o?.method === 'PATCH')
    expect(url).toMatch(/\/api\/events\/21$/)
    expect(JSON.parse(options.body).items).toHaveLength(3)
    expect(router.currentRoute.value.path).toBe('/agenda/21')
  })

  it('should not copy when the replacement is not confirmed', async () => {
    eventsOnDate = [{ id: 21, typeId: 1, type: showType, title: 'Festa', date: '2026-11-04', time: '', songCount: 5 }]
    confirm.mockReturnValue(false)
    const { wrapper } = await createWrapper()
    await copyButton(wrapper).trigger('click')
    await wrapper.find('.modal-stub input[type="date"]').setValue('2026-11-04')
    await flushPromises()
    await wrapper.find('.modal-stub form').trigger('submit')
    await flushPromises()

    expect(mockFetch.mock.calls.some(([, o]) => o?.method === 'PATCH')).toBe(false)
  })

  it('should say when the event does not exist', async () => {
    mockFetch.mockImplementation((url) =>
      url.includes('/api/events/') ? respond(null, false, 404) : respond([]),
    )
    const { wrapper } = await createWrapper()
    expect(wrapper.find('.alert-error').text()).toBe('Event not found.')
  })
})
