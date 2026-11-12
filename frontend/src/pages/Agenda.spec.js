import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import Agenda from './Agenda.vue'
import { isoDate, todayISO } from '../utils/date'

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
      shareUpcoming: 'Upcoming', upcoming: 'Upcoming dates', noUpcoming: 'Nothing upcoming',
      viewCalendar: 'Calendar', viewList: 'List', periodUpcoming: 'Next', periodPast: 'Past',
      periodAll: 'All', search: 'Search', listEmpty: 'No events found.',
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

  it('should copy every event from today on, a blank line between months', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const upcoming = [
      { id: 10, typeId: 1, type: show, title: 'Vila Domitila', date: '2026-10-31', time: '', location: null },
      { id: 11, typeId: 2, type: rehearsal, title: '', date: '2026-11-04', time: '', location: null },
      { id: 12, typeId: 1, type: show, title: 'Mercadão', date: '2026-11-20', time: '20:00', location: null },
      { id: 13, typeId: 1, type: show, title: 'Inebria', date: '2026-12-05', time: '', location: 'Centro' },
    ]
    const { wrapper } = await createWrapper()
    mockFetch.mockImplementation((url) => respond(url.includes('/api/event-types') ? types : upcoming))
    await filterChip(wrapper, 'Rehearsal').trigger('click')
    await filterChip(wrapper, 'Party').trigger('click')
    await wrapper.findAll('button').find((b) => b.text() === 'Upcoming').trigger('click')
    await flushPromises()

    expect(eventsUrls().at(-1)).toMatch(new RegExp(`/api/events\\?from=${todayISO()}$`))
    expect(writeText).toHaveBeenCalledWith([
      '*Calendar · Maverick — Upcoming dates*',
      'Show',
      '',
      '*Sat 10/31* — Vila Domitila',
      '',
      '*Fri 11/20 20:00* — Mercadão',
      '',
      '*Sat 12/05* — Inebria (Centro)',
    ].join('\n'))
  })

  it('should say so when there is nothing upcoming to share', async () => {
    const writeText = vi.fn().mockResolvedValue()
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const { wrapper } = await createWrapper()
    mockFetch.mockImplementation((url) => respond(url.includes('/api/event-types') ? types : []))
    await wrapper.findAll('button').find((b) => b.text() === 'Upcoming').trigger('click')
    await flushPromises()

    expect(writeText).not.toHaveBeenCalled()
    expect(wrapper.find('.alert-error').text()).toBe('Nothing upcoming')
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
  describe('list', () => {
    // Relative to today, since the list splits around it
    function daysFromToday(days) {
      const date = new Date()
      date.setDate(date.getDate() + days)
      return isoDate(date)
    }
    const listed = [
      { id: 21, typeId: 1, type: show, title: 'Festa Junina', date: daysFromToday(-60), time: '', location: 'Praça', songCount: 20 },
      { id: 22, typeId: 2, type: rehearsal, title: '', date: daysFromToday(-3), time: '', location: null, songCount: 4 },
      { id: 23, typeId: 1, type: show, title: 'Bar do Zé', date: daysFromToday(0), time: '21:00', location: 'Centro', songCount: 12 },
      { id: 24, typeId: 1, type: show, title: 'Réveillon', date: daysFromToday(45), time: '', location: 'Centro', songCount: 0 },
    ]
    const names = (wrapper) => wrapper.findAll('.event-row .event-name').map((name) => name.text())
    const tab = (wrapper, label) => wrapper.findAll('.tab-button').find((button) => button.text() === label)
    const chip = (wrapper, label) => wrapper.findAll('.period-chip').find((button) => button.text() === label)

    beforeEach(() => {
      mockFetch.mockImplementation((url) => respond(url.includes('/api/event-types') ? types : listed))
    })

    it('should load every event and list the next ones, soonest first, without the calendar', async () => {
      const { wrapper } = await createWrapper('/agenda?ver=lista')
      expect(eventsUrls()).toEqual([expect.stringMatching(/\/api\/events$/)])
      expect(wrapper.find('.calendar').exists()).toBe(false)
      expect(names(wrapper)).toEqual(['Show Bar do Zé', 'Show Réveillon'])
      expect(wrapper.find('.list-title').text()).toBe('Next (2)')
      expect(wrapper.findAll('.list-month-title').length).toBeGreaterThan(0)
      expect(wrapper.findAll('button').some((b) => b.text() === 'Share')).toBe(false)
    })

    it('should list the past events latest first, and both for all', async () => {
      const { wrapper, router } = await createWrapper('/agenda?ver=lista')
      await chip(wrapper, 'Past').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.periodo).toBe('passados')
      expect(names(wrapper)).toEqual(['Rehearsal Rehearsal', 'Show Festa Junina'])

      await chip(wrapper, 'All').trigger('click')
      await flushPromises()
      expect(names(wrapper)).toEqual(['Show Bar do Zé', 'Show Réveillon', 'Rehearsal Rehearsal', 'Show Festa Junina'])
      expect(wrapper.findAll('.list-title').map((title) => title.text())).toEqual(['Next (2)', 'Past (2)'])
    })

    it('should find events by name, type or place, and keep the search in the URL', async () => {
      const { wrapper, router } = await createWrapper('/agenda?ver=lista&periodo=todos')
      await wrapper.find('input[type="search"]').setValue('centro')
      await flushPromises()
      expect(names(wrapper)).toEqual(['Show Bar do Zé', 'Show Réveillon'])
      expect(router.currentRoute.value.query.busca).toBe('centro')

      await wrapper.find('input[type="search"]').setValue('nothing like it')
      await flushPromises()
      expect(wrapper.find('.empty-state').text()).toBe('No events found.')
    })

    it('should hide the types unchecked in the filter', async () => {
      const { wrapper } = await createWrapper('/agenda?ver=lista&periodo=passados')
      await filterChip(wrapper, 'Rehearsal').trigger('click')
      expect(names(wrapper)).toEqual(['Show Festa Junina'])
    })

    it('should remember the list and open on it next time', async () => {
      const { wrapper, router } = await createWrapper('/agenda')
      expect(wrapper.find('.calendar').exists()).toBe(true)
      await tab(wrapper, 'List').trigger('click')
      await flushPromises()
      expect(router.currentRoute.value.query.ver).toBe('lista')
      expect(eventsUrls().at(-1)).toMatch(/\/api\/events$/)
      expect(wrapper.find('.calendar').exists()).toBe(false)

      const { wrapper: reopened } = await createWrapper('/agenda')
      expect(reopened.find('.calendar').exists()).toBe(false)
      expect(names(reopened)).toEqual(['Show Bar do Zé', 'Show Réveillon'])
    })

    it('should go back to the calendar of the month', async () => {
      localStorage.setItem('agenda_view', 'list')
      const { wrapper } = await createWrapper('/agenda?mes=2026-10')
      mockFetch.mockImplementation((url) => respond(url.includes('/api/event-types') ? types : events))
      await tab(wrapper, 'Calendar').trigger('click')
      await flushPromises()
      expect(eventsUrls().at(-1)).toContain('/api/events?from=2026-09-27&to=2026-10-31')
      expect(wrapper.findAll('.event-chip')).toHaveLength(3)
      expect(localStorage.getItem('agenda_view')).toBe('calendar')
    })
  })
})
