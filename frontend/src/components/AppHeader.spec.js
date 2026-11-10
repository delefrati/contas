import { describe, it, expect, vi } from 'vitest'
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

async function headerOn(path) {
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
    ],
  })
  await router.push(path)
  const i18n = createI18n({ legacy: false, locale: 'pt', messages: { pt } })
  const wrapper = mount(AppHeader, {
    props: { icon: 'fa-house', title: 'Teste' },
    global: { plugins: [i18n, router] },
  })
  await flushPromises()
  return wrapper.find(`a[aria-label="${pt.manual.open}"]`)
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
    const link = await headerOn(path)
    expect(link.attributes('href')).toBe(help)
  })

  it('opens the index on a screen without a part of its own', async () => {
    const link = await headerOn('/outra')
    expect(link.attributes('href')).toBe('/ajuda')
  })
})
