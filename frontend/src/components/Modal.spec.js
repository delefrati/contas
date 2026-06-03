import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import Modal from './Modal.vue'

describe('Modal', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('should not render when modelValue is false', () => {
    const wrapper = mount(Modal, {
      props: { modelValue: false, title: 'Test Modal' },
      global: { stubs: { teleport: true } },
    })
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('should render when modelValue is true', () => {
    const wrapper = mount(Modal, {
      props: { modelValue: true, title: 'Test Modal' },
      global: { stubs: { teleport: true } },
    })
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.find('.modal-header h3').text()).toBe('Test Modal')
  })

  it('should emit close and update:modelValue when close button clicked', async () => {
    const wrapper = mount(Modal, {
      props: { modelValue: true, title: 'Test' },
      global: { stubs: { teleport: true } },
    })

    await wrapper.find('.modal-close').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeTruthy()
    expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('should close when overlay is clicked', async () => {
    const wrapper = mount(Modal, {
      props: { modelValue: true, title: 'Test' },
      global: { stubs: { teleport: true } },
    })

    await wrapper.find('.modal-overlay').trigger('click')

    expect(wrapper.emitted('update:modelValue')[0]).toEqual([false])
  })

  it('should render slot content', () => {
    const wrapper = mount(Modal, {
      props: { modelValue: true, title: 'Test' },
      slots: { default: '<p class="slot-content">Hello</p>' },
      global: { stubs: { teleport: true } },
    })

    expect(wrapper.find('.slot-content').text()).toBe('Hello')
  })

  it('should set aria-label from title', () => {
    const wrapper = mount(Modal, {
      props: { modelValue: true, title: 'My Dialog' },
      global: { stubs: { teleport: true } },
    })

    expect(wrapper.find('[role="dialog"]').attributes('aria-label')).toBe('My Dialog')
  })
})
