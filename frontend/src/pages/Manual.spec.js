import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import { ref } from 'vue'
import Manual from './Manual.vue'
import { parts } from '../manual'
import pt from '../i18n/locales/pt.json'
import en from '../i18n/locales/en.json'

// jsdom has no scrolling
window.scrollTo = vi.fn()

const member = ref(null)
const admin = ref(null)

vi.mock('../composables/useAuth', () => ({
  useAuth: () => ({ member }),
}))

vi.mock('../composables/useAdmin', () => ({
  useAdmin: () => ({ admin }),
}))

const titleOf = (slug) => parts.find((p) => p.slug === slug).title

async function open(path, { locale = 'pt' } = {}) {
  const i18n = createI18n({ legacy: false, locale, messages: { pt, en } })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/ajuda/:part?', name: 'Manual', component: Manual },
      { path: '/:other(.*)', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  const wrapper = mount(Manual, { global: { plugins: [i18n, router] }, attachTo: document.body })
  await flushPromises()
  return { wrapper, router }
}

describe('Manual', () => {
  beforeEach(() => {
    member.value = null
    admin.value = null
  })

  it('has every part of the app, each with a title and text', () => {
    expect(parts.map((p) => p.slug)).toEqual([
      'entrar', 'inicio', 'agenda', 'evento', 'musicas', 'financeiro', 'integrantes',
      'registros', 'permissoes', 'celular', 'idioma', 'admin',
    ])
    for (const part of parts) {
      expect(part.title).not.toBe('')
      expect(part.html).toContain('<p>')
    }
  })

  describe.each([
    ['signed out', null],
    ['signed in', { id: 1, name: 'Ana', superAdmin: false }],
  ])('%s', (_, signedIn) => {
    beforeEach(() => {
      member.value = signedIn
    })

    it('shows the index, without the super admin part', async () => {
      const { wrapper } = await open('/ajuda')
      const links = wrapper.findAll('.manual-index a').map((a) => a.text())
      expect(links).toContain(titleOf('entrar'))
      expect(links).toContain(titleOf('agenda'))
      expect(links).not.toContain(titleOf('admin'))
    })

    it("shows a part's page", async () => {
      const { wrapper } = await open('/ajuda/agenda')
      expect(wrapper.find('.manual-text h1').text()).toBe(titleOf('agenda'))
      expect(wrapper.find('.manual-index').exists()).toBe(false)
    })

    it('sends the super admin part to the index', async () => {
      const { wrapper, router } = await open('/ajuda/admin')
      expect(router.currentRoute.value.fullPath).toBe('/ajuda')
      expect(wrapper.find('.manual-index').exists()).toBe(true)
    })
  })

  it('sends an unknown part to the index', async () => {
    const { wrapper, router } = await open('/ajuda/nada-disso')
    expect(router.currentRoute.value.fullPath).toBe('/ajuda')
    expect(wrapper.find('.manual-index').exists()).toBe(true)
  })

  it('shows the super admin part to a super admin signed in to a band', async () => {
    member.value = { id: 1, name: 'Ana', superAdmin: true }
    const { wrapper } = await open('/ajuda/admin')
    expect(wrapper.find('.manual-text h1').text()).toBe(titleOf('admin'))
  })

  it('shows the super admin part to a super admin in the admin panel', async () => {
    admin.value = { email: 'ana@example.com', name: 'Ana' }
    const { wrapper } = await open('/ajuda')
    expect(wrapper.findAll('.manual-index a').map((a) => a.text())).toContain(titleOf('admin'))
  })

  it('links to the previous and next parts and back to the index', async () => {
    const { wrapper } = await open('/ajuda/agenda')
    const pager = wrapper.findAll('.manual-pager a').map((a) => a.attributes('href'))
    expect(pager).toEqual(['/ajuda/inicio', '/ajuda', '/ajuda/evento'])
  })

  it('follows a link between parts inside the app', async () => {
    const { wrapper, router } = await open('/ajuda/permissoes')
    const link = wrapper.find('.manual-text a[href^="/ajuda/"]')
    expect(link.exists()).toBe(true)
    const href = link.attributes('href')
    await link.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe(href)
  })

  it('says the manual is only in Portuguese in other languages', async () => {
    const { wrapper } = await open('/ajuda', { locale: 'en' })
    expect(wrapper.find('.manual-note').text()).toBe(en.manual.onlyPortuguese)
  })

  it("doesn't show that note in Portuguese", async () => {
    const { wrapper } = await open('/ajuda')
    expect(wrapper.find('.manual-note').exists()).toBe(false)
  })
})
