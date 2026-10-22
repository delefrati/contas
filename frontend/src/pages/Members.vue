<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import AppHeader from '../components/AppHeader.vue'
import Modal from '../components/Modal.vue'

const { t } = useI18n()
const router = useRouter()
const { logout, getAuthHeader, getCurrentUser } = useAuth()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const members = ref([])
const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const isAddMemberModalOpen = ref(false)
const newMemberName = ref('')
const newMemberEmail = ref('')
const creatingMember = ref(false)
const isEditMemberModalOpen = ref(false)
const editingMember = ref(null)
const editMemberFormData = ref({ name: '', email: '' })
const updatingMember = ref(false)

function handleError(exception) {
  error.value = exception instanceof Error ? exception.message : t('errors.genericError')
}

function showSuccess(message) {
  successMessage.value = '✓ ' + message
  setTimeout(() => { successMessage.value = '' }, 3000)
}

async function loadData() {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${apiBaseUrl}/api/members`, { headers: getAuthHeader() })

    if (response.status === 401) {
      await logout()
      await router.push({ path: '/login', query: { reason: 'expired' } })
      return
    }

    if (!response.ok) {
      throw new Error(t('members.loadingError'))
    }

    members.value = (await response.json()).data || []
  } catch (exception) {
    handleError(exception)
  } finally {
    loading.value = false
  }
}

async function createMember() {
  const trimmedName = newMemberName.value.trim()
  const trimmedEmail = newMemberEmail.value.trim()

  if (!trimmedName) {
    error.value = t('members.nameRequired')
    return
  }

  creatingMember.value = true
  error.value = ''

  try {
    const response = await fetch(`${apiBaseUrl}/api/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({
        name: trimmedName,
        email: trimmedEmail || undefined,
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    newMemberName.value = ''
    newMemberEmail.value = ''
    isAddMemberModalOpen.value = false
    await loadData()
    showSuccess(t('members.successCreate'))
  } catch (exception) {
    handleError(exception)
  } finally {
    creatingMember.value = false
  }
}

function openEditMemberModal(m) {
  editingMember.value = m
  editMemberFormData.value = {
    name: m.name,
    email: m.email || '',
  }
  isEditMemberModalOpen.value = true
}

async function updateMember() {
  const trimmedName = editMemberFormData.value.name.trim()
  if (!trimmedName) {
    error.value = t('members.nameRequired')
    return
  }

  updatingMember.value = true
  error.value = ''

  try {
    const payload = {
      name: trimmedName,
      email: editMemberFormData.value.email.trim() || undefined,
    }

    const response = await fetch(`${apiBaseUrl}/api/members/${editingMember.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    isEditMemberModalOpen.value = false
    editingMember.value = null
    await loadData()
    showSuccess(t('members.successUpdate'))
  } catch (exception) {
    handleError(exception)
  } finally {
    updatingMember.value = false
  }
}

async function toggleMemberActive(id) {
  try {
    const response = await fetch(`${apiBaseUrl}/api/members/${id}/toggle-active`, {
      method: 'PATCH',
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    await loadData()
  } catch (exception) {
    handleError(exception)
  }
}

onMounted(async () => {
  const currentUser = await getCurrentUser()
  if (!currentUser) {
    await router.push('/login')
    return
  }

  loadData()
})
</script>

<template>
  <div class="container">
    <AppHeader icon="fa-users" :title="$t('members.title')" />

    <div class="content">
      <section class="expenses-section">
        <div class="section-header">
          <div class="section-actions">
            <button @click="isAddMemberModalOpen = true" class="btn-primary">
              + {{ $t('members.addMember') }}
            </button>
            <button @click="loadData" :disabled="loading" class="btn-secondary">
              <i v-if="!loading" class="fa-solid fa-arrows-rotate"></i> {{ loading ? $t('actions.loading') : $t('actions.refresh') }}
            </button>
          </div>
        </div>

        <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
        <div v-if="error" class="alert alert-error">{{ error }}</div>

        <div v-if="loading && members.length === 0" class="loading">
          <i class="fa-solid fa-spinner fa-spin"></i> {{ $t('actions.loading') }}
        </div>

        <div v-else-if="members.length === 0" class="empty-state">
          <p>{{ $t('members.noMembers') }}</p>
        </div>

        <table v-else class="expenses-table">
          <thead>
            <tr>
              <th class="id">#</th>
              <th>{{ $t('members.name') }}</th>
              <th>{{ $t('members.status') }}</th>
              <th class="actions">{{ $t('members.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in members" :key="m.id" class="expense-row">
              <td class="id">{{ m.id }}</td>
              <td class="description">{{ m.name }}</td>
              <td>
                <span class="status-badge" :class="m.active ? 'is-active' : 'is-inactive'">
                  {{ m.active ? $t('members.active') : $t('members.inactive') }}
                </span>
              </td>
              <td class="actions" style="white-space: nowrap;">
                <button
                  @click="openEditMemberModal(m)"
                  class="btn-secondary"
                  style="font-size: 0.8rem; padding: 4px 10px; margin-right: 4px;"
                  :title="$t('members.editMember')"
                >
                  <i class="fa-solid fa-pencil"></i>
                </button>
                <button
                  @click="toggleMemberActive(m.id)"
                  class="btn-secondary"
                  style="font-size: 0.8rem; padding: 4px 10px;"
                >
                  {{ m.active ? $t('members.disable') : $t('members.enable') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <Modal v-model="isAddMemberModalOpen" :title="'👤 ' + $t('members.addMember')">
      <form @submit.prevent="createMember" class="form">
        <div class="form-group">
          <label for="member-name">{{ $t('members.name') }} *</label>
          <input
            id="member-name"
            v-model="newMemberName"
            type="text"
            :placeholder="$t('members.name')"
            required
          />
        </div>
        <div class="form-group">
          <label for="member-email">{{ $t('members.email') }}</label>
          <input
            id="member-email"
            v-model="newMemberEmail"
            type="email"
            :placeholder="$t('members.email')"
          />
        </div>
        <button type="submit" :disabled="creatingMember" class="btn-primary">
          <i v-if="!creatingMember" class="fa-solid fa-check"></i> {{ creatingMember ? $t('actions.loading') : $t('actions.save') }}
        </button>
      </form>
    </Modal>

    <Modal v-model="isEditMemberModalOpen" :title="'✏️ ' + $t('members.editMember')">
      <form @submit.prevent="updateMember" class="form">
        <div class="form-group">
          <label for="edit-member-name">{{ $t('members.name') }} *</label>
          <input
            id="edit-member-name"
            v-model="editMemberFormData.name"
            type="text"
            :placeholder="$t('members.name')"
            required
          />
        </div>
        <div class="form-group">
          <label for="edit-member-email">{{ $t('members.email') }}</label>
          <input
            id="edit-member-email"
            v-model="editMemberFormData.email"
            type="email"
            :placeholder="$t('members.email')"
          />
        </div>
        <button type="submit" :disabled="updatingMember" class="btn-primary">
          <i v-if="!updatingMember" class="fa-solid fa-check"></i> {{ updatingMember ? $t('actions.loading') : $t('actions.save') }}
        </button>
      </form>
    </Modal>
  </div>
</template>
