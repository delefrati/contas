<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import Modal from './Modal.vue'
import { TYPE_COLORS, nextTypeColor, typeStyle } from '../utils/events'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // The band's current event types
  types: { type: Array, default: () => [] },
})

const emit = defineEmits(['update:modelValue', 'changed'])

const { t } = useI18n()
const { getAuthHeader } = useAuth()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const newType = ref({ name: '', color: TYPE_COLORS[0] })
const editing = ref(null)
const saving = ref(false)
const error = ref('')

watch(() => props.modelValue, (open) => {
  if (!open) return
  newType.value = { name: '', color: nextTypeColor(props.types) }
  editing.value = null
  error.value = ''
}, { immediate: true })

async function request(url, method, body) {
  saving.value = true
  error.value = ''
  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => null)
      throw new Error(response.status === 409 ? t('agenda.typeExists') : payload?.message || t('errors.genericError'))
    }
    emit('changed')
    return true
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
    return false
  } finally {
    saving.value = false
  }
}

async function addType() {
  const name = newType.value.name.trim()
  if (!name) {
    error.value = t('agenda.typeNameRequired')
    return
  }
  const created = await request(`${apiBaseUrl}/api/event-types`, 'POST', { name, color: newType.value.color })
  if (created) {
    // Pick a color for the next one that isn't taken yet
    newType.value = { name: '', color: nextTypeColor([...props.types, { color: newType.value.color }]) }
  }
}

function startEdit(type) {
  editing.value = { id: type.id, name: type.name, color: type.color }
  error.value = ''
}

async function saveEdit() {
  const name = editing.value.name.trim()
  if (!name) {
    error.value = t('agenda.typeNameRequired')
    return
  }
  const saved = await request(`${apiBaseUrl}/api/event-types/${editing.value.id}`, 'PATCH', {
    name,
    color: editing.value.color,
  })
  if (saved) editing.value = null
}

async function deleteType(type) {
  if (!confirm(t('agenda.confirmDeleteType', { name: type.name }))) return
  await request(`${apiBaseUrl}/api/event-types/${type.id}`, 'DELETE')
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="$t('agenda.typesTitle')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="error" class="alert alert-error">{{ error }}</div>

    <ul class="type-list">
      <li v-for="type in types" :key="type.id" class="type-row">
        <form v-if="editing?.id === type.id" class="type-form" @submit.prevent="saveEdit">
          <input type="text" v-model="editing.name" maxlength="255" :aria-label="$t('agenda.typeName')" />
          <div class="swatches" role="radiogroup" :aria-label="$t('agenda.typeColor')">
            <button
              v-for="color in TYPE_COLORS"
              :key="color"
              type="button"
              class="swatch"
              :class="{ selected: editing.color === color }"
              :style="typeStyle({ color })"
              role="radio"
              :aria-checked="editing.color === color"
              :aria-label="color"
              @click="editing.color = color"
            ></button>
          </div>
          <div class="row-actions">
            <button type="button" class="btn-secondary" @click="editing = null">{{ $t('actions.cancel') }}</button>
            <button type="submit" class="btn-primary" :disabled="saving">{{ $t('actions.save') }}</button>
          </div>
        </form>
        <template v-else>
          <span class="type-dot" :style="typeStyle(type)"></span>
          <span class="type-name">{{ type.name }}</span>
          <button type="button" class="btn-edit" :title="$t('actions.edit')" :aria-label="$t('actions.edit')" @click="startEdit(type)">
            <i class="fa-solid fa-pencil"></i>
          </button>
          <button type="button" class="btn-delete" :title="$t('actions.delete')" :aria-label="$t('actions.delete')" @click="deleteType(type)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </template>
      </li>
    </ul>
    <p v-if="types.length === 0" class="empty-state">{{ $t('agenda.noTypes') }}</p>

    <form class="type-form new-type" @submit.prevent="addType">
      <h3>{{ $t('agenda.newType') }}</h3>
      <input type="text" v-model="newType.name" maxlength="255" :placeholder="$t('agenda.typeNamePlaceholder')" :aria-label="$t('agenda.typeName')" />
      <div class="swatches" role="radiogroup" :aria-label="$t('agenda.typeColor')">
        <button
          v-for="color in TYPE_COLORS"
          :key="color"
          type="button"
          class="swatch"
          :class="{ selected: newType.color === color }"
          :style="typeStyle({ color })"
          role="radio"
          :aria-checked="newType.color === color"
          :aria-label="color"
          @click="newType.color = color"
        ></button>
      </div>
      <div class="row-actions">
        <button type="submit" class="btn-primary" :disabled="saving">+ {{ $t('agenda.addType') }}</button>
      </div>
    </form>
  </Modal>
</template>

<style scoped>
.type-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.type-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
}
.type-name {
  flex: 1;
  font-weight: 600;
  color: var(--text-h);
  text-align: left;
  overflow-wrap: anywhere;
}
.type-form {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.type-form input {
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 0.95rem;
  font-family: inherit;
}
.new-type {
  margin-top: 16px;
}
.new-type h3 {
  margin: 0;
  font-size: 1rem;
  text-align: left;
}
.swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.swatch {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  background: var(--type-color);
  cursor: pointer;
}
.swatch.selected {
  border-color: var(--bg-white);
  box-shadow: 0 0 0 2px var(--type-color);
}
.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
