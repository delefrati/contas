import { afterEach, describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import AppHeader from './AppHeader.vue'
import pt from '../i18n/locales/pt.json'

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({
    logout: vi.fn(),
    member: ref({ id: 1, name: 'Ana' }),
    sessionExpired: ref(false),
  }),
}))

const Page = { template: '<div />' }

async function headerOn(path, { slots, props } = {}) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/dashboard', name: 'Dashboard', component: Page },
      { path: '/agenda', name: 'Agenda', component: Page },
      { path: '/agenda/:id', name: 'Event', component: Page },
      { path: '/musicas', name: 'Songs', component: Page },
      { path: '/financeiro', name: 'Finance', component: Page },
      { path: '/integrantes', name: 'Members', component: Page },
      { path: '/registros', name: 'Logs', component: Page },
      { path: '/outra', name: 'Other', component: Page },
      { path: '/ajuda/:part?', name: 'Manual', component: Page },
      { path: '/configuracoes', name: 'Settings', component: Page },
    ],
  })
  await router.push(path)
  const i18n = createI18n({ legacy: false, locale: 'pt', messages: { pt } })
  const wrapper = mount(AppHeader, {
    props: { icon: 'fa-house', title: 'Teste', ...props },
    slots,
    global: { plugins: [i18n, router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

async function helpLinkOn(path) {
  return (await headerOn(path)).find(`a[aria-label="${pt.manual.open}"]`)
}

describe('AppHeader help link', () => {
  it.each([
    ['/dashboard', '/ajuda/inicio'],
    ['/agenda', '/ajuda/agenda'],
    ['/agenda/12', '/ajuda/evento'],
    ['/musicas', '/ajuda/musicas'],
    ['/financeiro', '/ajuda/financeiro'],
    ['/integrantes', '/ajuda/integrantes'],
    ['/registros', '/ajuda/registros'],
  ])('on %s opens %s', async (path, help) => {
    const link = await helpLinkOn(path)
    expect(link.attributes('href')).toBe(help)
  })

  it('opens the index on a screen without a part of its own', async () => {
    const link = await helpLinkOn('/outra')
    expect(link.attributes('href')).toBe('/ajuda')
  })
})

describe('AppHeader settings', () => {
  it('opens the settings from the gear and from the name', async () => {
    const wrapper = await headerOn('/dashboard')
    expect(wrapper.find(`a[aria-label="${pt.settings.open}"]`).attributes('href')).toBe('/configuracoes')
    const name = wrapper.find('a.user-info')
    expect(name.text()).toContain('Ana')
    expect(name.attributes('href')).toBe('/configuracoes')
  })

  it('leaves the gear out on the settings page itself', async () => {
    const wrapper = await headerOn('/configuracoes')
    expect(wrapper.find(`a[aria-label="${pt.settings.open}"]`).exists()).toBe(false)
  })
})

describe('AppHeader logo and title', () => {
  it('go back to the Início', async () => {
    const wrapper = await headerOn('/agenda')
    const home = wrapper.find('a.header-home')
    expect(home.attributes('href')).toBe('/dashboard')
    expect(home.find('.header-title').text()).toBe('Teste')
    expect(home.find('.header-logo').exists()).toBe(true)
  })

  it('stay as they are on the Início, where the logo changes it', async () => {
    const wrapper = await headerOn('/dashboard', { props: { logoEditable: true } })
    expect(wrapper.find('a.header-home').exists()).toBe(false)
    await wrapper.find('button.header-logo').trigger('click')
    expect(wrapper.emitted('edit-logo')).toHaveLength(1)
  })
})

describe('AppHeader on a phone', () => {
  function asPhone() {
    window.matchMedia = vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  }

  afterEach(() => {
    delete window.matchMedia
    document.body.innerHTML = ''
  })

  it('keeps only the logo, the name and a menu button in the header', async () => {
    asPhone()
    const wrapper = await headerOn('/agenda')
    expect(wrapper.find('.header-title').text()).toBe('Teste')
    expect(wrapper.find('.header-controls').exists()).toBe(false)
    expect(wrapper.find('.header-menu').exists()).toBe(false)
    expect(wrapper.find('.menu-toggle').attributes('aria-expanded')).toBe('false')
  })

  it('lists every section, the help, the settings and logout in the menu', async () => {
    asPhone()
    const wrapper = await headerOn('/agenda')
    await wrapper.find('.menu-toggle').trigger('click')
    const menu = wrapper.find('.header-menu')
    const links = menu.findAll('a').map((a) => a.attributes('href'))
    expect(links).toEqual(expect.arrayContaining([
      '/dashboard', '/agenda', '/musicas', '/financeiro', '/integrantes', '/registros', '/ajuda/agenda', '/configuracoes',
    ]))
    expect(menu.find('.is-current').text()).toContain(pt.agenda.title)
    expect(menu.find('.menu-logout').text()).toContain(pt.app.logout)
    expect(menu.text()).toContain('Ana')
  })

  it('closes when going somewhere, or tapping outside', async () => {
    asPhone()
    const wrapper = await headerOn('/agenda')
    await wrapper.find('.menu-toggle').trigger('click')
    await wrapper.find('.header-menu a[href="/musicas"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('.header-menu').exists()).toBe(false)

    await wrapper.find('.menu-toggle').trigger('click')
    await wrapper.find('.menu-backdrop').trigger('click')
    expect(wrapper.find('.header-menu').exists()).toBe(false)
  })

  it("carries the screen's own header buttons", async () => {
    asPhone()
    const wrapper = await headerOn('/financeiro', { slots: { default: '<button class="btn-print">print</button>' } })
    expect(wrapper.find('.btn-print').exists()).toBe(false)
    await wrapper.find('.menu-toggle').trigger('click')
    expect(wrapper.find('.header-menu .btn-print').exists()).toBe(true)
  })
})
