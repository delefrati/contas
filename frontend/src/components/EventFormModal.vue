<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import Modal from './Modal.vue'
import { todayISO } from '../utils/date'
import { typeStyle } from '../utils/events'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // Event being edited; null creates a new one
  event: { type: Object, default: null },
  defaultDate: { type: String, default: '' },
  // The band's current event types
  types: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'saved'])

const { t } = useI18n()
const { getAuthHeader } = useAuth()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const form = ref({})
const saving = ref(false)
const error = ref('')

// An event keeps its type even after the type is deleted
const typeOptions = computed(() => {
  const current = props.event?.type
  return current && !props.types.some((type) => type.id === current.id)
    ? [...props.types, current]
    : props.types
})

function resetForm() {
  const event = props.event
  form.value = {
    typeId: event?.typeId ?? props.types[0]?.id ?? null,
    title: event?.title || '',
    date: event?.date || props.defaultDate || todayISO(),
    time: event?.time || '',
    location: event?.location || '',
    notes: event?.notes || '',
  }
  error.value = ''
}

watch(() => props.modelValue, (open) => {
  if (open) resetForm()
}, { immediate: true })

async function save() {
  if (!form.value.typeId) {
    error.value = t('agenda.typeRequired')
    return
  }
  if (!form.value.date) {
    error.value = t('agenda.dateRequired')
    return
  }

  saving.value = true
  error.value = ''
  try {
    const url = props.event
      ? `${apiBaseUrl}/api/events/${props.event.id}`
      : `${apiBaseUrl}/api/events`
    const response = await fetch(url, {
      method: props.event ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({
        typeId: form.value.typeId,
        title: form.value.title.trim(),
        date: form.value.date,
        time: form.value.time,
        location: form.value.location.trim(),
        notes: form.value.notes.trim(),
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    const saved = (await response.json()).data
    emit('update:modelValue', false)
    emit('saved', saved)
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="event ? $t('agenda.editEvent') : $t('agenda.newEvent')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <form @submit.prevent="save" class="form">
      <div v-if="error" class="alert alert-error">{{ error }}</div>
      <div class="form-group">
        <label>{{ $t('agenda.type') }}</label>
        <div v-if="typeOptions.length > 0" class="type-options">
          <label
            v-for="type in typeOptions"
            :key="type.id"
            class="type-option"
            :class="{ selected: form.typeId === type.id }"
            :style="typeStyle(type)"
          >
            <input type="radio" :value="type.id" v-model="form.typeId" />
            <span class="type-dot"></span>
            {{ type.name }}
          </label>
        </div>
        <p v-else class="hint">{{ $t('agenda.noTypes') }}</p>
      </div>
      <div class="form-group">
        <label>{{ $t('agenda.eventTitle') }}</label>
        <input type="text" v-model="form.title" :placeholder="$t('agenda.titlePlaceholder')" maxlength="255" />
      </div>
      <div class="form-row-2">
        <div class="form-group">
          <label>{{ $t('agenda.date') }} *</label>
          <input type="date" v-model="form.date" required />
        </div>
        <div class="form-group">
          <label>{{ $t('agenda.time') }}</label>
          <input type="time" v-model="form.time" />
        </div>
      </div>
      <div class="form-group">
        <label>{{ $t('agenda.location') }}</label>
        <input type="text" v-model="form.location" maxlength="255" />
      </div>
      <div class="form-group">
        <label>{{ $t('agenda.notes') }}</label>
        <textarea v-model="form.notes" rows="3"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" @click="emit('update:modelValue', false)" class="btn-secondary">{{ $t('actions.cancel') }}</button>
        <button type="submit" :disabled="saving" class="btn-primary">
          {{ saving ? $t('actions.loading') : $t('actions.save') }}
        </button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.form-group {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.form-group input,
.form-group textarea {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: inherit;
}
.form-row-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.type-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.type-option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
}
.type-option input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.type-option.selected {
  border-color: var(--type-color);
  background: color-mix(in srgb, var(--type-color) 15%, transparent);
  color: var(--text-h);
}
.hint {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-light);
}
.type-option:has(input:focus-visible) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}
</style>
