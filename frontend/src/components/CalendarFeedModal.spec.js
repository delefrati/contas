import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { ref } from 'vue'
import CalendarFeedModal from './CalendarFeedModal.vue'

const mockFetch = vi.fn()
global.fetch = mockFetch

const TOKEN = 'A'.repeat(32)
const member = ref({ id: 1, name: 'Test User' })
const band = ref(null)
const setBand = vi.fn()

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ getAuthHeader: () => ({ Authorization: 'Bearer fake-token' }), member }),
}))
vi.mock('../composables/useBand', () => ({
  useBand: () => ({ band, setBand }),
}))

const messages = {
  en: {
    calendarFeed: {
      create: 'Create my link', copy: 'Copy', copied: 'Copied', regenerate: 'New link', remove: 'Disconnect',
      membersOnly: 'Members only', google: 'Google', appleOutlook: 'Apple / Outlook',
    },
    actions: { save: 'Save', loading: 'Loading' },
    errors: { genericError: 'An error occurred' },
  },
}

function respond(data, status = 200) {
  return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(data === undefined ? null : { data }) })
}

function fail(message, status = 400) {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve({ message }) })
}

async function createWrapper() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages, missingWarn: false, fallbackWarn: false })
  const wrapper = mount(CalendarFeedModal, {
    props: { modelValue: true },
    global: {
      plugins: [i18n],
      stubs: { Modal: { template: '<div class="modal-stub"><slot /></div>', props: ['modelValue', 'title'] } },
    },
  })
  await flushPromises()
  return wrapper
}

function findButton(wrapper, text) {
  return wrapper.findAll('button').find((button) => button.text().includes(text))
}

describe('CalendarFeedModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    member.value = { id: 1, name: 'Test User' }
    band.value = { id: 1, name: 'Maverick', timeZone: 'America/Sao_Paulo', defaultEventMinutes: 120 }
    vi.stubGlobal('confirm', vi.fn(() => true))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should offer to create a link when the member has none', async () => {
    mockFetch.mockReturnValueOnce(respond({ token: null }))

    const wrapper = await createWrapper()

    expect(mockFetch).toHaveBeenCalledWith('http://localhost:8001/api/calendar/feed', expect.objectContaining({ method: 'GET' }))
    expect(findButton(wrapper, 'Create my link')).toBeTruthy()
    expect(wrapper.find('.feed-link').exists()).toBe(false)
  })

  it('should show the link with ways to subscribe once there is one', async () => {
    mockFetch.mockReturnValueOnce(respond({ token: TOKEN }))

    const wrapper = await createWrapper()

    const url = `http://localhost:8001/api/calendar/${TOKEN}.ics`
    expect(wrapper.find('.feed-link input').element.value).toBe(url)
    const links = wrapper.findAll('.feed-apps a').map((a) => a.attributes('href'))
    expect(links).toEqual([
      `https://calendar.google.com/calendar/render?cid=${encodeURIComponent(`webcal://localhost:8001/api/calendar/${TOKEN}.ics`)}`,
      `webcal://localhost:8001/api/calendar/${TOKEN}.ics`,
    ])
  })

  it('should create a link on request', async () => {
    mockFetch.mockReturnValueOnce(respond({ token: null })).mockReturnValueOnce(respond({ token: TOKEN }))
    const wrapper = await createWrapper()

    await findButton(wrapper, 'Create my link').trigger('click')
    await flushPromises()

    expect(mockFetch).toHaveBeenLastCalledWith('http://localhost:8001/api/calendar/feed', expect.objectContaining({ method: 'POST' }))
    expect(wrapper.find('.feed-link input').element.value).toContain(TOKEN)
  })

  it('should disconnect after confirming', async () => {
    mockFetch.mockReturnValueOnce(respond({ token: TOKEN })).mockReturnValueOnce(respond(undefined, 200))
    const wrapper = await createWrapper()

    await findButton(wrapper, 'Disconnect').trigger('click')
    await flushPromises()

    expect(confirm).toHaveBeenCalled()
    expect(mockFetch).toHaveBeenLastCalledWith('http://localhost:8001/api/calendar/feed', expect.objectContaining({ method: 'DELETE' }))
    expect(findButton(wrapper, 'Create my link')).toBeTruthy()
  })

  it('should keep the link when the new-link confirmation is declined', async () => {
    confirm.mockReturnValue(false)
    mockFetch.mockReturnValueOnce(respond({ token: TOKEN }))
    const wrapper = await createWrapper()

    await findButton(wrapper, 'New link').trigger('click')

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('should not offer a link to super admins, who are not band members', async () => {
    member.value = { name: 'Admin', superAdmin: true }

    const wrapper = await createWrapper()

    expect(mockFetch).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Members only')
  })

  it("should save the band's time zone and default length", async () => {
    mockFetch.mockReturnValueOnce(respond({ token: null }))
    const wrapper = await createWrapper()
    const saved = { ...band.value, timeZone: 'Europe/Lisbon', defaultEventMinutes: 90 }
    mockFetch.mockReturnValueOnce(respond(saved))

    const save = wrapper.find('.band-settings button[type="submit"]')
    expect(save.attributes('disabled')).toBeDefined()

    await wrapper.find('#calendar-time-zone').setValue('Europe/Lisbon')
    await wrapper.find('#calendar-duration').setValue('90')
    await wrapper.find('.band-settings').trigger('submit')
    await flushPromises()

    const [url, options] = mockFetch.mock.calls.at(-1)
    expect(url).toBe('http://localhost:8001/api/band/calendar')
    expect(options.method).toBe('PATCH')
    expect(JSON.parse(options.body)).toEqual({ timeZone: 'Europe/Lisbon', defaultEventMinutes: 90 })
    expect(setBand).toHaveBeenCalledWith(saved)
  })

  it('should show what the API says went wrong', async () => {
    mockFetch.mockReturnValueOnce(respond({ token: null })).mockReturnValueOnce(fail('Unknown time zone'))
    const wrapper = await createWrapper()

    await wrapper.find('#calendar-duration').setValue('60')
    await wrapper.find('.band-settings').trigger('submit')
    await flushPromises()

    expect(wrapper.find('.alert-error').text()).toBe('Unknown time zone')
    expect(setBand).not.toHaveBeenCalled()
  })
})
