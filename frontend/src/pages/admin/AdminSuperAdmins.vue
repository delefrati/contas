<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdmin } from '../../composables/useAdmin'
import AdminLayout from '../../components/AdminLayout.vue'
import Modal from '../../components/Modal.vue'

const { t } = useI18n()
const { admin, get, post, patch } = useAdmin()

const superAdmins = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const successMessage = ref('')
const isAddModalOpen = ref(false)
const form = ref({ name: '', email: '' })

function showSuccess(message) {
  successMessage.value = '✓ ' + message
  setTimeout(() => { successMessage.value = '' }, 3000)
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    superAdmins.value = (await get('/super-admins')) || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function openAddModal() {
  form.value = { name: '', email: '' }
  error.value = ''
  isAddModalOpen.value = true
}

async function addSuperAdmin() {
  saving.value = true
  error.value = ''
  try {
    await post('/super-admins', { name: form.value.name.trim(), email: form.value.email.trim() })
    isAddModalOpen.value = false
    await load()
    showSuccess(t('admin.superAdmins.added'))
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}

async function toggleActive(superAdmin) {
  if (superAdmin.active && !confirm(t('admin.superAdmins.confirmDisable', { name: superAdmin.name }))) return
  saving.value = true
  error.value = ''
  try {
    await patch(`/super-admins/${superAdmin.id}/toggle-active`)
    await load()
  } catch (err) {
    error.value = err.message
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AdminLayout icon="fa-user-shield" :title="$t('admin.superAdmins.title')" @ready="load">
    <section class="expenses-section">
      <div class="section-header">
        <p class="hint">{{ $t('admin.superAdmins.hint') }}</p>
        <div class="section-actions">
          <button @click="openAddModal" class="btn-primary">+ {{ $t('admin.superAdmins.add') }}</button>
        </div>
      </div>

      <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
      <div v-if="error && !isAddModalOpen" class="alert alert-error">{{ error }}</div>

      <div v-if="loading && superAdmins.length === 0" class="loading">
        <i class="fa-solid fa-spinner fa-spin"></i> {{ $t('actions.loading') }}
      </div>

      <table v-else class="expenses-table">
        <thead>
          <tr>
            <th>{{ $t('members.name') }}</th>
            <th>{{ $t('members.email') }}</th>
            <th>{{ $t('members.status') }}</th>
            <th class="actions">{{ $t('members.actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="s in superAdmins" :key="s.id" class="expense-row">
            <td class="description">
              {{ s.name }}
              <span v-if="s.id === admin?.id" class="you">({{ $t('admin.superAdmins.you') }})</span>
            </td>
            <td>{{ s.email }}</td>
            <td>
              <span class="status-badge" :class="s.active ? 'is-active' : 'is-inactive'">
                {{ s.active ? $t('members.active') : $t('members.inactive') }}
              </span>
            </td>
            <td class="actions">
              <button
                v-if="s.id !== admin?.id"
                @click="toggleActive(s)"
                :disabled="saving"
                class="btn-secondary btn-small"
              >
                {{ s.active ? $t('members.disable') : $t('members.enable') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <Modal v-model="isAddModalOpen" :title="'🛡️ ' + $t('admin.superAdmins.add')">
      <form @submit.prevent="addSuperAdmin" class="form">
        <div v-if="error" class="alert alert-error">{{ error }}</div>
        <div class="form-group">
          <label for="super-admin-name">{{ $t('members.name') }} *</label>
          <input id="super-admin-name" v-model="form.name" type="text" maxlength="255" required />
        </div>
        <div class="form-group">
          <label for="super-admin-email">{{ $t('members.email') }} *</label>
          <input id="super-admin-email" v-model="form.email" type="email" maxlength="255" required />
        </div>
        <button type="submit" :disabled="saving" class="btn-primary">
          <i v-if="!saving" class="fa-solid fa-check"></i> {{ saving ? $t('actions.loading') : $t('actions.save') }}
        </button>
      </form>
    </Modal>
  </AdminLayout>
</template>

<style scoped>
.hint {
  margin: 0;
  color: var(--text-light);
  font-size: 0.9rem;
}
.you {
  color: var(--text-light);
  font-size: 0.85rem;
}
.btn-small {
  padding: 4px 10px;
  font-size: 0.8rem;
}
</style>
