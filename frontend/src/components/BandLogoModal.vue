<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { useBand } from '../composables/useBand'
import Modal from './Modal.vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
})
const emit = defineEmits(['update:modelValue'])

// Same limits the API enforces; checked here too so the user hears about it before uploading
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 1024 * 1024

const { t } = useI18n()
const { getAuthHeader } = useAuth()
const { logoUrl, setBand } = useBand()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const file = ref(null)
const previewUrl = ref(null)
const saving = ref(false)
const error = ref('')

const shownLogo = computed(() => previewUrl.value || logoUrl.value)

function clearSelection() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
  file.value = null
}

watch(() => props.modelValue, (open) => {
  if (!open) clearSelection()
  error.value = ''
})
onBeforeUnmount(clearSelection)

function onFileChange(event) {
  const selected = event.target.files?.[0]
  event.target.value = ''
  error.value = ''
  if (!selected) return

  if (!ACCEPTED_TYPES.includes(selected.type)) {
    error.value = t('band.invalidType')
    return
  }
  if (selected.size > MAX_BYTES) {
    error.value = t('band.tooLarge')
    return
  }

  clearSelection()
  file.value = selected
  previewUrl.value = URL.createObjectURL(selected)
}

async function send(method, body) {
  saving.value = true
  error.value = ''
  try {
    const response = await fetch(`${apiBaseUrl}/api/band/logo`, { method, headers: getAuthHeader(), body })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      throw new Error(payload?.message || t('errors.genericError'))
    }
    setBand(payload.data)
    emit('update:modelValue', false)
  } catch (exception) {
    error.value = exception.message
  } finally {
    saving.value = false
  }
}

function save() {
  const body = new FormData()
  body.append('logo', file.value)
  send('PUT', body)
}

function remove() {
  if (confirm(t('band.confirmRemoveLogo'))) send('DELETE')
}
</script>

<template>
  <Modal
    :model-value="modelValue"
    :title="$t('band.logo')"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="logo-editor">
      <div class="logo-preview">
        <img v-if="shownLogo" :src="shownLogo" :alt="$t('band.logo')" />
        <p v-else>{{ $t('band.noLogo') }}</p>
      </div>

      <p class="logo-hint">{{ $t('band.logoHint') }}</p>
      <div v-if="error" class="alert alert-error">{{ error }}</div>

      <div class="logo-actions">
        <label class="btn-secondary">
          <i class="fa-solid fa-image"></i> {{ $t('band.chooseFile') }}
          <input type="file" accept="image/png,image/jpeg,image/webp" hidden @change="onFileChange" />
        </label>
        <button v-if="file" type="button" class="btn-primary" :disabled="saving" @click="save">
          <i class="fa-solid fa-check"></i> {{ saving ? $t('actions.loading') : $t('actions.save') }}
        </button>
        <button
          v-else-if="logoUrl"
          type="button"
          class="btn-secondary logo-remove"
          :disabled="saving"
          @click="remove"
        >
          <i class="fa-solid fa-trash"></i> {{ $t('band.removeLogo') }}
        </button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.logo-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.logo-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 180px;
  border: 1px dashed var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text-light);
}
.logo-preview img {
  max-width: 100%;
  max-height: 160px;
  object-fit: contain;
}
.logo-hint {
  margin: 0;
  color: var(--text-light);
  font-size: 13px;
}
.logo-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.logo-actions label {
  cursor: pointer;
}
.logo-remove {
  color: var(--error);
}
</style>
