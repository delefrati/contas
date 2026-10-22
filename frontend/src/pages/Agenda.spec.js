import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import Agenda from './Agenda.vue'

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

vi.mock('../composables/useBand', () => ({
  useBand: () => ({ band: ref({ name: 'Maverick' }) }),
}))

const messages = {
  en: {
    app: { logout: 'Logout', confirmLogout: 'Are you sure?' },
    agenda: {
      title: 'Calendar', newEvent: 'New event', monthEvents: 'Events this month',
      noEvents: 'No events this month', manageTypes: 'Types',
      songCount: 'no songs | {n} song | {n} songs', addOnDay: 'Add event on {date}',
      share: 'Share', shareSuccess: 'Calendar copied!',
    },
    errors: { genericError: 'An error occurred' },
  },
}

const show = { id: 1, name: 'Show', color: '#667eea' }
const rehearsal = { id: 2, name: 'Rehearsal', color: '#48bb78' }
const party = { id: 3, name: 'Party', color: '#ed8936' }
const types = [party, rehearsal, show]

const events = [
  { id: 7, typeId: 1, type: show, title: 'Bar do Zé', date: '2026-10-24', time: '21:00', location: 'Centro', songCount: 12 },
  { id: 8, typeId: 2, type: rehearsal, title: '', date: '2026-10-28', time: '', location: null, songCount: 0 },
  { id: 10, typeId: 3, type: party, title: 'Barbecue', date: '2026-10-31', time: '', location: null, songCount: 0 },
  { id: 9, typeId: 2, type: rehearsal, title: '', date: '2026-11-04', time: '', location: null, songCount: 3 },
]

function respond(data) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ data }) })
}

async function createWrapper(path = '/agenda?mes=2026-10') {
  const i18n = createI18n({ legacy: false, locale: 'en', messages, missingWarn: false, fallbackWarn: false })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/agenda', component: Agenda },
      { path: '/agenda/:id', component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  router.push(path)
  await router.isReady()

  const wrapper = mount(Agenda, {
    global: {
      plugins: [i18n, router],
      stubs: {
        LanguageSelector: true,
        EventTypesModal: true,
        EventFormModal: {
          props: ['modelValue', 'defaultDate', 'types'],
          template: '<div class="event-modal-stub" :data-open="modelValue" :data-date="defaultDate" :data-types="types.length" />',
        },
      },
    },
  })
  await flushPromises()
  return { wrapper, router }
}

function filterChip(wrapper, name) {
  return wrapper.findAll('.type-filter-chip').find((chip) => chip.text() === name)
}

function eventsUrls() {
  return mockFetch.mock.calls.map(([url]) => url).filter((url) => url.includes('/api/events'))
}

describe('Agenda', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    mockFetch.mockImplementation((url) => respond(url.includes('/api/event-types') ? types : events))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should load the events of the weeks shown', async () => {
    await createWrapper()
    expect(eventsUrls()[0]).toContain('/api/events?from=2026-09-27&to=2026-10-31')
  })

  it('should place events on their days in their type color', async () => {
    const { wrapper } = await createWrapper()
    const chips = wrapper.findAll('.event-chip')
    // The November rehearsal falls outside the October grid
    expect(chips.map((c) => c.find('.event-chip-name').text())).toEqual(['Bar do Zé', 'Rehearsal', 'Barbecue'])
    expect(chips[0].find('.event-chip-time').text()).toBe('21:00')
    expect(chips[0].attributes('style')).toContain('--type-color: #667eea')
    expect(chips[0].attributes('href')).toBe('/agenda/7')
  })

  it('should list only the events of the month shown', async () => {
    const { wrapper } = await createWrapper()
    const rows = wrapper.findAll('.event-row')
    expect(rows).toHaveLength(3)
    expect(rows[0].text()).toContain('Bar do Zé')
    expect(rows[0].text()).toContain('12 songs')
    expect(rows[1].text()).toContain('no songs')
  })

  it('should hide the types unchecked in the filter and remember them', async () => {
    const { wrapper } = await createWrapper()
    await filterChip(wrapper, 'Rehearsal').trigger('click')

    expect(filterChip(wrapper, 'Rehearsal').attributes('aria-pressed')).toBe('false')
    expect(wrapper.findAll('.event-row').map((r) => r.find('.event-name').text())).toEqual([
      'Show Bar do Zé',
      'Party Barbecue',
    ])
    expect(JSON.parse(localStorage.getItem('agenda_hidden_types'))).toEqual([2])

    const { wrapper: reopened } = await createWrapper()
    expect(reopened.findAll('.event-row')).toHaveLength(2)
  })

  it('should copy the month events as WhatsApp text', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { wrapper } = await createWrapper()
    await wrapper.findAll('button').find((b) => b.text() === 'Share').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith([
      '*Calendar · Maverick — October 2026*',
      '',
      '*Sat 10/24 21:00* — Bar do Zé (Centro)',
      '*Wed 10/28* — Rehearsal',
      '*Sat 10/31* — Barbecue',
    ].join('\n'))
    expect(wrapper.find('.alert-success').text()).toContain('Calendar copied!')
  })

  it('should share only the filtered types, naming them', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { wrapper } = await createWrapper()
    await filterChip(wrapper, 'Rehearsal').trigger('click')
    await wrapper.findAll('button').find((b) => b.text() === 'Share').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith([
      '*Calendar · Maverick — October 2026*',
      'Party, Show',
      '',
      '*Sat 10/24 21:00* — Bar do Zé (Centro)',
      '*Sat 10/31* — Barbecue',
    ].join('\n'))
  })

  it('should not share an empty month', async () => {
    mockFetch.mockImplementation((url) => respond(url.includes('/api/event-types') ? types : []))
    const { wrapper } = await createWrapper()
    const button = wrapper.findAll('button').find((b) => b.text() === 'Share')
    expect(button.attributes('disabled')).toBeDefined()
  })

  it('should move to the next month', async () => {
    const { wrapper, router } = await createWrapper()
    await wrapper.find('button[aria-label="agenda.nextMonth"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.mes).toBe('2026-11')
    expect(eventsUrls().at(-1)).toContain('from=2026-11-01&to=2026-12-05')
  })

  it('should open the event form for the day clicked with the band types', async () => {
    const { wrapper } = await createWrapper()
    const day = wrapper.findAll('.day').find((d) => d.find('.day-number').text() === '15')
    await day.trigger('click')
    const modal = wrapper.find('.event-modal-stub')
    expect(modal.attributes('data-open')).toBe('true')
    expect(modal.attributes('data-date')).toBe('2026-10-15')
    expect(modal.attributes('data-types')).toBe('3')
  })
})
