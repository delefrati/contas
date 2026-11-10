import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createI18n } from 'vue-i18n'
import pt from '../i18n/locales/pt.json'
import NotFound from './NotFound.vue'

describe('NotFound', () => {
  it('explains and offers the way back home and to the help', async () => {
    const i18n = createI18n({ legacy: false, locale: 'pt', messages: { pt } })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: NotFound }],
    })
    await router.push('/xyz')
    const wrapper = mount(NotFound, { global: { plugins: [router, i18n] } })

    expect(wrapper.text()).toContain('404')
    expect(wrapper.text()).toContain('Página não encontrada')
    const links = wrapper.findAll('a').map((a) => a.attributes('href'))
    expect(links).toEqual(['/', '/ajuda'])
  })
})
