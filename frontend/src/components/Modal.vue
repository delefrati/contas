<script setup>
import { computed, onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false,
  },
  title: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['update:modelValue', 'close'])

const isOpen = computed(() => props.modelValue)

function close() {
  emit('update:modelValue', false)
  emit('close')
}

function onOverlayClick(event) {
  if (event.target === event.currentTarget) {
    close()
  }
}

function onEscKey(event) {
  if (event.key === 'Escape' && isOpen.value) {
    close()
  }
}

watch(isOpen, (open) => {
  if (open) {
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onEscKey)
  } else {
    document.body.style.overflow = ''
    window.removeEventListener('keydown', onEscKey)
  }
})

onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onEscKey)
})
</script>

<template>
  <teleport to="body">
    <div
      v-if="isOpen"
      class="modal-overlay"
      role="presentation"
      @click="onOverlayClick"
    >
      <div
        class="modal-content"
        role="dialog"
        aria-modal="true"
        :aria-label="title || 'Dialog'"
      >
        <header class="modal-header">
          <h3>{{ title }}</h3>
          <button
            type="button"
            class="modal-close"
            aria-label="Close dialog"
            @click="close"
          >
            ×
          </button>
        </header>

        <section class="modal-body">
          <slot />
        </section>
      </div>
    </div>
  </teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.55);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 4rem 1rem 2rem;
  z-index: 1000;
  overflow-y: auto;
}

.modal-content {
  width: min(640px, 100%);
  background: var(--bg-white);
  color: var(--text);
  border-radius: 16px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border);
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--border);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.15rem;
  color: var(--text-h);
}

.modal-close {
  border: none;
  background: transparent;
  color: var(--text-light);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  padding: 0.25rem;
}

.modal-close:hover {
  color: var(--text-h);
}

.modal-body {
  padding: 1.25rem;
}
</style>