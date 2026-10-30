import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import StageView from './StageView.vue'

const setlist = [
  { id: 1, type: 'song', title: 'Exagerado', artist: 'Cazuza', lyrics: 'Amor da minha vida\nDaqui até a eternidade' },
  { id: 2, type: 'song', title: 'Pro Dia Nascer Feliz', artist: null },
  { id: 3, type: 'pause', label: 'BIS' },
  { id: 4, type: 'song', title: 'Malandragem', artist: null, lyrics: 'Quem sabe eu ainda sou uma garotinha' },
  { id: 5, type: 'pause', label: '' },
  { id: 6, type: 'song', title: 'Codinome Beija-Flor', artist: null },
]

let lock
let mounted = []

function createWrapper(props = {}) {
  const wrapper = mount(StageView, {
    props: { setlist, ...props },
    global: { mocks: { $t: (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key) } },
  })
  mounted.push(wrapper)
  return wrapper
}

function titles(section) {
  return section.findAll('.stage-title').map((t) => t.text())
}

// Taps land on the left or the right half of the screen (jsdom is 1024px wide)
const tapLeft = (wrapper) => wrapper.find('.stage-content').trigger('click', { clientX: 100 })
const tapRight = (wrapper) => wrapper.find('.stage-content').trigger('click', { clientX: 900 })

async function swipe(wrapper, from, to) {
  const content = wrapper.find('.stage-content')
  await content.trigger('touchstart', { touches: [{ clientX: from[0], clientY: from[1] }] })
  await content.trigger('touchend', { changedTouches: [{ clientX: to[0], clientY: to[1] }] })
}

describe('StageView', () => {
  beforeEach(() => {
    localStorage.clear()
    lock = { release: vi.fn(), addEventListener: vi.fn() }
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: { request: vi.fn().mockResolvedValue(lock) },
    })
  })

  afterEach(() => {
    mounted.forEach((w) => w.unmount())
    mounted = []
  })

  it('should show the first block and a peek at the next one', () => {
    const wrapper = createWrapper()
    const sections = wrapper.findAll('.stage-block')
    expect(sections).toHaveLength(2)
    expect(sections[0].classes()).toContain('is-current')
    expect(titles(sections[0])).toEqual(['Exagerado', 'Pro Dia Nascer Feliz'])
    expect(sections[1].classes()).toContain('is-upcoming')
    expect(sections[1].find('.stage-pause').text()).toBe('BIS')
    expect(titles(sections[1])).toEqual(['Malandragem'])
    expect(wrapper.find('.stage-position').text()).toContain('{"current":1,"total":3}')
  })

  it('should go forward with a tap on the right and back with one on the left', async () => {
    const wrapper = createWrapper()
    await tapRight(wrapper)
    await tapRight(wrapper)
    let current = wrapper.find('.stage-block.is-current')
    expect(titles(current)).toEqual(['Codinome Beija-Flor'])
    expect(current.find('.stage-number').text()).toBe('4')
    // Last block: nothing to peek at, the end is marked
    expect(wrapper.findAll('.stage-block')).toHaveLength(1)
    expect(wrapper.find('.stage-end').exists()).toBe(true)

    await tapRight(wrapper)
    expect(titles(wrapper.find('.stage-block.is-current'))).toEqual(['Codinome Beija-Flor'])

    await tapLeft(wrapper)
    current = wrapper.find('.stage-block.is-current')
    expect(titles(current)).toEqual(['Malandragem'])
  })

  it('should not go before the first block', async () => {
    const wrapper = createWrapper()
    await tapLeft(wrapper)
    expect(titles(wrapper.find('.stage-block.is-current'))).toEqual(['Exagerado', 'Pro Dia Nascer Feliz'])
  })

  it('should go forward with a right-to-left swipe and back with a left-to-right one', async () => {
    const wrapper = createWrapper()
    await swipe(wrapper, [800, 300], [300, 320])
    expect(titles(wrapper.find('.stage-block.is-current'))).toEqual(['Malandragem'])
    await swipe(wrapper, [200, 300], [700, 280])
    expect(titles(wrapper.find('.stage-block.is-current'))).toEqual(['Exagerado', 'Pro Dia Nascer Feliz'])
  })

  it('should take a thumb swipe that arcs as a swipe', async () => {
    const wrapper = createWrapper()
    await swipe(wrapper, [800, 500], [500, 300])
    expect(titles(wrapper.find('.stage-block.is-current'))).toEqual(['Malandragem'])
  })

  it('should ignore the tap some browsers send where a swipe ends', async () => {
    const wrapper = createWrapper()
    await swipe(wrapper, [800, 300], [300, 300])
    // Lands on the left half, which would turn back
    await tapLeft(wrapper)
    expect(titles(wrapper.find('.stage-block.is-current'))).toEqual(['Malandragem'])
  })

  it('should not turn the block on short or mostly vertical moves', async () => {
    const wrapper = createWrapper()
    await swipe(wrapper, [500, 300], [470, 300])
    await swipe(wrapper, [500, 600], [400, 200])
    await swipe(wrapper, [500, 600], [400, 450])
    expect(titles(wrapper.find('.stage-block.is-current'))).toEqual(['Exagerado', 'Pro Dia Nascer Feliz'])
  })

  it('should not turn the block when swiping over the whole setlist', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.stage-footer').trigger('click')
    await swipe(wrapper, [800, 300], [300, 300])
    expect(wrapper.find('.stage-content').classes()).toContain('is-overview')
    expect(wrapper.find('.stage-position').text()).toContain('"current":1')
  })

  it('should open the lyrics when the name of a song that has them is tapped', async () => {
    const wrapper = createWrapper()
    const [exagerado, proDia] = wrapper.findAll('.stage-block.is-current .stage-title')
    expect(exagerado.find('.stage-lyrics-mark').exists()).toBe(true)
    expect(proDia.find('.stage-lyrics-mark').exists()).toBe(false)

    // A song without lyrics is just a tap on that side
    await proDia.trigger('click', { clientX: 100 })
    expect(wrapper.find('.stage-lyrics').exists()).toBe(false)

    await exagerado.trigger('click', { clientX: 900 })
    expect(wrapper.find('.stage-lyrics .stage-title').text()).toBe('Exagerado')
    expect(wrapper.findAll('.stage-lyrics-line').map((l) => l.text())).toEqual(['Amor da minha vida', 'Daqui até a eternidade'])
    expect(wrapper.find('.stage-position').text()).toContain('{"current":1,"total":4}')
    expect(wrapper.find('.stage-block').exists()).toBe(false)
  })

  it('should go song by song while the lyrics are open and close back on that song\'s block', async () => {
    const wrapper = createWrapper()
    await wrapper.find('[data-lyrics="1"]').trigger('click', { clientX: 900 })

    await tapRight(wrapper)
    expect(wrapper.find('.stage-lyrics .stage-title').text()).toBe('Pro Dia Nascer Feliz')
    expect(wrapper.find('.stage-lyrics .stage-empty').text()).toBe('repertoires.stageNoLyrics')

    await swipe(wrapper, [800, 300], [300, 300])
    expect(wrapper.find('.stage-lyrics-text').text()).toBe('Quem sabe eu ainda sou uma garotinha')

    await wrapper.find('.stage-close-lyrics').trigger('click')
    expect(wrapper.find('.stage-lyrics').exists()).toBe(false)
    expect(titles(wrapper.find('.stage-block.is-current'))).toEqual(['Malandragem'])
  })

  it('should close the lyrics with Escape before leaving the view', async () => {
    const wrapper = createWrapper()
    await wrapper.find('[data-lyrics="1"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('.stage-lyrics').exists()).toBe(false)
    expect(wrapper.emitted('close')).toBeUndefined()
  })

  it('should jump to a block from the whole setlist even when tapping a song with lyrics', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.stage-footer').trigger('click')
    await wrapper.findAll('.stage-block')[1].find('[data-lyrics]').trigger('click')
    expect(wrapper.find('.stage-lyrics').exists()).toBe(false)
    expect(titles(wrapper.find('.stage-block.is-current'))).toEqual(['Malandragem'])
  })

  it('should show the whole setlist from the bottom and jump to the block picked there', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.stage-footer').trigger('click')
    const sections = wrapper.findAll('.stage-block')
    expect(sections).toHaveLength(3)
    expect(wrapper.find('.stage-content').classes()).toContain('is-overview')

    await sections[2].find('.stage-title').trigger('click')
    expect(wrapper.find('.stage-content').classes()).not.toContain('is-overview')
    expect(titles(wrapper.find('.stage-block.is-current'))).toEqual(['Codinome Beija-Flor'])
  })

  it('should follow page-turner keys', async () => {
    const wrapper = createWrapper()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown' }))
    await flushPromises()
    expect(titles(wrapper.find('.stage-block.is-current'))).toEqual(['Malandragem'])
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    await flushPromises()
    expect(titles(wrapper.find('.stage-block.is-current'))).toEqual(['Exagerado', 'Pro Dia Nascer Feliz'])
  })

  it('should show artists only when asked to', () => {
    expect(createWrapper().find('.stage-artist').exists()).toBe(false)
    expect(createWrapper({ showArtists: true }).find('.stage-artist').text()).toBe('Cazuza')
  })

  it('should keep the screen on while open', async () => {
    const wrapper = createWrapper()
    await flushPromises()
    expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen')
    wrapper.unmount()
    mounted = []
    expect(lock.release).toHaveBeenCalled()
  })

  it('should ask for the screen to stay on again when the page comes back', async () => {
    createWrapper()
    await flushPromises()
    // The browser drops the lock when the page is hidden
    lock.addEventListener.mock.calls.find(([name]) => name === 'release')[1]()
    document.dispatchEvent(new Event('visibilitychange'))
    await flushPromises()
    expect(navigator.wakeLock.request).toHaveBeenCalledTimes(2)
  })

  it('should make the text bigger and smaller and remember the size', async () => {
    const wrapper = createWrapper()
    const scale = () => wrapper.find('.stage').element.style.getPropertyValue('--stage-font-scale')
    expect(scale()).toBe('1')

    await wrapper.find('.stage-font-up').trigger('click')
    await wrapper.find('.stage-font-up').trigger('click')
    expect(scale()).toBe('1.3')
    expect(localStorage.getItem('stage_view_font_scale')).toBe('1.3')

    await wrapper.find('.stage-font-down').trigger('click')
    expect(scale()).toBe('1.15')
    expect(createWrapper().find('.stage').element.style.getPropertyValue('--stage-font-scale')).toBe('1.15')
  })

  it('should stop at the smallest and biggest sizes', async () => {
    localStorage.setItem('stage_view_font_scale', '2')
    const wrapper = createWrapper()
    expect(wrapper.find('.stage-font-up').attributes('disabled')).toBeDefined()
    expect(wrapper.find('.stage-font-down').attributes('disabled')).toBeUndefined()

    localStorage.setItem('stage_view_font_scale', '0.6')
    expect(createWrapper().find('.stage-font-down').attributes('disabled')).toBeDefined()
  })

  it('should ignore a size saved that it does not offer', () => {
    localStorage.setItem('stage_view_font_scale', '37')
    expect(createWrapper().find('.stage').element.style.getPropertyValue('--stage-font-scale')).toBe('1')
  })

  it('should switch between dark and light and remember the choice', async () => {
    const wrapper = createWrapper()
    expect(wrapper.find('.stage').classes()).toContain('is-dark')
    await wrapper.find('.stage-theme').trigger('click')
    expect(wrapper.find('.stage').classes()).toContain('is-light')
    expect(localStorage.getItem('stage_view_theme')).toBe('light')
    expect(createWrapper().find('.stage').classes()).toContain('is-light')
  })

  it('should ask to close from the exit button', async () => {
    const wrapper = createWrapper()
    await wrapper.find('.stage-exit').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
