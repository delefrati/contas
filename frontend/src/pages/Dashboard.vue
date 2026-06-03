<script setup>
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import LanguageSelector from '../components/LanguageSelector.vue'
import Modal from '../components/Modal.vue'

const { t, locale } = useI18n()
const router = useRouter()
const { logout, getAuthHeader, member } = useAuth()
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001'

const health = ref('loading...')
const expenses = ref([])
const members = ref([])
const report = ref([])
const types = ref([])
const logs = ref([])
const loading = ref(false)
const submitting = ref(false)
const creatingType = ref(false)
const error = ref('')
const successMessage = ref('')
const activeTab = ref('expenses')
const showLanguageSelector = ref(false)
const filtersVisible = ref(false)
const isAddExpenseModalOpen = ref(false)
const isEditExpenseModalOpen = ref(false)
const editingExpense = ref(null)
const editFormData = ref({
  description: '',
  typeId: '',
  amount: '',
  date: '',
  memberIds: [],
})
const updating = ref(false)
const openActionMenuId = ref(null)
const expandedLogId = ref(null)
const isAddMemberModalOpen = ref(false)
const newMemberName = ref('')
const newMemberEmail = ref('')
const creatingMember = ref(false)
const isEditMemberModalOpen = ref(false)
const editingMember = ref(null)
const editMemberFormData = ref({ name: '', email: '' })
const updatingMember = ref(false)
const newTypeName = ref('')

// Filters
const filters = ref({
  text: '',
  dateFrom: '',
  dateTo: '',
  typeId: '',
  memberIds: [],
})

// Form
const formData = ref({
  description: '',
  typeId: '',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  memberIds: [],
  notes: '',
})

const activeTypes = computed(() =>
  types.value.filter(type => !type.deletedAt)
)

const filteredExpenses = computed(() => {
  return expenses.value.filter(exp => {
    // Text search
    if (filters.value.text) {
      const search = filters.value.text.toLowerCase()
      const desc = (exp.description || '').toLowerCase()
      if (!desc.includes(search)) return false
    }
    // Date from
    if (filters.value.dateFrom) {
      const expDate = exp.date || (exp.createdAt ? exp.createdAt.slice(0, 10) : '')
      if (expDate < filters.value.dateFrom) return false
    }
    // Date to
    if (filters.value.dateTo) {
      const expDate = exp.date || (exp.createdAt ? exp.createdAt.slice(0, 10) : '')
      if (expDate > filters.value.dateTo) return false
    }
    // Type
    if (filters.value.typeId) {
      if (String(exp.typeId) !== String(filters.value.typeId)) return false
    }
    // Members
    if (filters.value.memberIds.length > 0) {
      const expMemberIds = (exp.memberIds || []).map(String)
      const hasMatch = filters.value.memberIds.some(id => expMemberIds.includes(String(id)))
      if (!hasMatch) return false
    }
    return true
  })
})

function toggleActionMenu(id) {
  openActionMenuId.value = openActionMenuId.value === id ? null : id
}

function clearFilters() {
  filters.value = { text: '', dateFrom: '', dateTo: '', typeId: '', memberIds: [] }
}

function syncSelectedType() {
  const hasCurrentType = activeTypes.value.some(
    type => String(type.id) === String(formData.value.typeId)
  )

  if (!hasCurrentType) {
    formData.value.typeId = activeTypes.value[0] ? String(activeTypes.value[0].id) : ''
  }
}

async function loadData() {
  loading.value = true
  error.value = ''

  try {
    const authHeader = getAuthHeader()
    const [healthResponse, expensesResponse, membersResponse, reportResponse, typesResponse, logsResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/api/health`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/expenses`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/members`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/expenses/report/by-member`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/expense-types?includeDeleted=true`, { headers: authHeader }),
      fetch(`${apiBaseUrl}/api/logs?limit=100`, { headers: authHeader }),
    ])

    if (!healthResponse.ok || !expensesResponse.ok || !typesResponse.ok) {
      throw new Error(t('expenses.loadingError'))
    }

    const healthPayload = await healthResponse.json()
    const expensesPayload = await expensesResponse.json()
    const membersPayload = membersResponse.ok ? await membersResponse.json() : { data: [] }
    const reportPayload = reportResponse.ok ? await reportResponse.json() : { data: [] }
    const typesPayload = await typesResponse.json()
    const logsPayload = logsResponse.ok ? await logsResponse.json() : { data: [] }

    health.value = healthPayload.status
    expenses.value = expensesPayload.data || []
    members.value = membersPayload.data || []
    report.value = reportPayload.data || []
    types.value = typesPayload.data || []
    logs.value = logsPayload.data || []
    syncSelectedType()
  } catch (exception) {
    health.value = 'erro'
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
  } finally {
    loading.value = false
  }
}

async function submitForm() {
  submitting.value = true
  error.value = ''
  successMessage.value = ''

  try {
    const selectedTypeId = parseInt(String(formData.value.typeId))
    if (!selectedTypeId) {
      throw new Error(t('form.typeRequired'))
    }

    const payload = {
      description: formData.value.description,
      typeId: selectedTypeId,
      amount: parseFloat(formData.value.amount),
      date: formData.value.date,
    }

    if (formData.value.memberIds.length > 0) {
      payload.memberIds = formData.value.memberIds.map((id) => parseInt(id))
    }

    const response = await fetch(`${apiBaseUrl}/api/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    successMessage.value = '✓ ' + t('expenses.successCreate')
    formData.value = {
      description: '',
      typeId: activeTypes.value[0] ? String(activeTypes.value[0].id) : '',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      memberIds: [],
      notes: '',
    }
    isAddExpenseModalOpen.value = false

    // Recarregar lista
    await loadData()
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
  } finally {
    submitting.value = false
  }
}

async function createExpenseType() {
  const trimmedTypeName = newTypeName.value.trim()
  if (!trimmedTypeName) {
    error.value = t('form.typeNameRequired')
    return
  }

  creatingType.value = true
  error.value = ''

  try {
    const response = await fetch(`${apiBaseUrl}/api/expense-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ name: trimmedTypeName }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    const payload = await response.json()
    const createdType = payload?.data

    await loadData()

    if (createdType?.id) {
      formData.value.typeId = String(createdType.id)
    } else {
      syncSelectedType()
    }

    newTypeName.value = ''
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
  } finally {
    creatingType.value = false
  }
}

async function deleteExpense(id) {
  if (!confirm(t('expenses.successDelete'))) {
    return
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/expenses/${id}`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    })

    if (!response.ok) {
      throw new Error(t('expenses.successDelete'))
    }

    successMessage.value = '✓ ' + t('expenses.successDelete')
    error.value = ''
    
    // Recarregar lista
    await loadData()
    
    // Limpar mensagem após 3 segundos
    setTimeout(() => { successMessage.value = '' }, 3000)
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
  }
}

function getTypeName(typeId) {
  const normalizedTypeId = parseInt(String(typeId))
  return types.value.find(t => t.id === normalizedTypeId)?.name || 'Unknown'
}

function openEditModal(expense) {
  editingExpense.value = expense
  editFormData.value = {
    description: expense.description,
    typeId: String(expense.typeId),
    amount: String(expense.amount),
    date: expense.date || (expense.createdAt ? expense.createdAt.slice(0, 10) : ''),
    memberIds: expense.memberIds ? expense.memberIds.map(String) : [],
  }
  isEditExpenseModalOpen.value = true
}

async function updateExpense() {
  updating.value = true
  error.value = ''

  try {
    const payload = {
      description: editFormData.value.description,
      typeId: parseInt(editFormData.value.typeId),
      amount: parseFloat(editFormData.value.amount),
      date: editFormData.value.date,
    }

    if (editFormData.value.memberIds.length > 0) {
      payload.memberIds = editFormData.value.memberIds.map((id) => parseInt(id))
    }

    const response = await fetch(`${apiBaseUrl}/api/expenses/${editingExpense.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }

    successMessage.value = '✓ ' + t('expenses.successUpdate')
    isEditExpenseModalOpen.value = false
    editingExpense.value = null
    await loadData()
    setTimeout(() => { successMessage.value = '' }, 3000)
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
  } finally {
    updating.value = false
  }
}

function getMemberNames(expense) {
  if (Array.isArray(expense.members) && expense.members.length > 0) {
    return expense.members.join(', ')
  }

  if (Array.isArray(expense.memberIds) && expense.memberIds.length > 0) {
    return expense.memberIds
      .map((id) => members.value.find((i) => i.id === id)?.name || `#${id}`)
      .join(', ')
  }

  if (expense.memberId) {
    return members.value.find((i) => i.id === expense.memberId)?.name || 'Unknown'
  }

  return '—'
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString(locale.value === 'pt' ? 'pt-BR' : locale.value, { year: 'numeric', month: '2-digit', day: '2-digit' })
  } catch {
    return dateStr
  }
}

function calculateTotal() {
  return filteredExpenses.value.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0)
}

const totalInflows = computed(() =>
  filteredExpenses.value
    .filter(e => parseFloat(e.amount) > 0)
    .reduce((sum, e) => sum + parseFloat(e.amount), 0)
)

const totalOutflows = computed(() =>
  filteredExpenses.value
    .filter(e => parseFloat(e.amount) < 0)
    .reduce((sum, e) => sum + parseFloat(e.amount), 0)
)

const netBalance = computed(() => totalInflows.value + totalOutflows.value)

function calculateReportTotal() {
  return report.value.reduce((sum, item) => sum + parseFloat(item.total || 0), 0)
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

    successMessage.value = '✓ ' + t('members.successCreate')
    newMemberName.value = ''
    newMemberEmail.value = ''
    isAddMemberModalOpen.value = false
    await loadData()
    setTimeout(() => { successMessage.value = '' }, 3000)
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
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

    successMessage.value = '✓ ' + t('members.successUpdate')
    isEditMemberModalOpen.value = false
    editingMember.value = null
    await loadData()
    setTimeout(() => { successMessage.value = '' }, 3000)
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
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
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
  }
}

onMounted(() => {
  loadData()
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.actions-mobile')) {
      openActionMenuId.value = null
    }
  })
})

async function handleLogout() {
  if (confirm(t('app.confirmLogout'))) {
    await logout()
    router.push('/login')
  }
}
</script>

<template>
  <div class="container">
    <header class="header">
      <div class="header-top">
        <h1><i class="fa-solid fa-coins"></i> {{ $t('app.title') }}</h1>
        <div class="header-controls">
          <button @click="showLanguageSelector = !showLanguageSelector" class="btn-secondary btn-lang-toggle" :title="$t('app.language')">
            <i class="fa-solid fa-globe"></i>
          </button>
          <LanguageSelector v-if="showLanguageSelector" />
          <div v-if="member" class="user-info">
            <span class="user-name">{{ member.name }}</span>
          </div>
          <button @click="handleLogout" class="btn-logout" :title="$t('app.logout')">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="tabs">
      <button 
        @click="activeTab = 'expenses'" 
        :class="{ active: activeTab === 'expenses' }"
        class="tab-button"
      >
        <i class="fa-solid fa-list"></i> {{ $t('tabs.expenses') }}
      </button>
      <button 
        @click="activeTab = 'report'" 
        :class="{ active: activeTab === 'report' }"
        class="tab-button"
      >
        <i class="fa-solid fa-chart-bar"></i> {{ $t('tabs.report') }}
      </button>
      <button 
        @click="activeTab = 'members'" 
        :class="{ active: activeTab === 'members' }"
        class="tab-button"
      >
        <i class="fa-solid fa-users"></i> {{ $t('tabs.members') }}
      </button>
      <button 
        @click="activeTab = 'logs'" 
        :class="{ active: activeTab === 'logs' }"
        class="tab-button"
      >
        <i class="fa-solid fa-pen-to-square"></i> {{ $t('tabs.logs') }}
      </button>
    </div>

    <!-- Expenses Tab -->
    <div v-if="activeTab === 'expenses'" class="content">
      <!-- Expenses List -->
      <section class="expenses-section">
        <div class="section-header">
          <div class="section-actions">
            <button @click="filtersVisible = !filtersVisible" class="btn-secondary" :title="$t('filters.toggle')">
              <i class="fa-solid fa-filter"></i>
            </button>
            <button @click="isAddExpenseModalOpen = true" class="btn-primary">
              + {{ $t('form.addExpense') }}
            </button>
            <button @click="loadData" :disabled="loading" class="btn-secondary">
              <i v-if="!loading" class="fa-solid fa-arrows-rotate"></i> {{ loading ? $t('actions.loading') : $t('actions.refresh') }}
            </button>
          </div>
        </div>

        <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
        <div v-if="error" class="alert alert-error">{{ error }}</div>

        <!-- Filters -->
        <div v-show="filtersVisible" class="filters">
          <div class="filter-group">
            <label>{{ $t('filters.text') }}</label>
            <input type="text" v-model="filters.text" :placeholder="$t('filters.textPlaceholder')" />
          </div>
          <div class="filter-group">
            <label>{{ $t('filters.dateFrom') }}</label>
            <input type="date" v-model="filters.dateFrom" />
          </div>
          <div class="filter-group">
            <label>{{ $t('filters.dateTo') }}</label>
            <input type="date" v-model="filters.dateTo" />
          </div>
          <div class="filter-group">
            <label>{{ $t('form.type') }}</label>
            <select v-model="filters.typeId">
              <option value="">{{ $t('filters.allTypes') }}</option>
              <option v-for="type in activeTypes" :key="type.id" :value="String(type.id)">
                {{ type.name }}
              </option>
            </select>
          </div>
          <div class="filter-group">
            <label>{{ $t('form.members') }}</label>
            <select v-model="filters.memberIds" multiple size="3">
              <option v-for="mem in members" :key="mem.id" :value="String(mem.id)">
                {{ mem.name }}
              </option>
            </select>
          </div>
          <div class="filter-group filter-actions">
            <button @click="clearFilters" class="btn-secondary">{{ $t('filters.clear') }}</button>
          </div>
        </div>

        <div v-if="loading && expenses.length === 0" class="loading">
          <i class="fa-solid fa-spinner fa-spin"></i> {{ $t('actions.loading') }}
        </div>

        <div v-else-if="filteredExpenses.length === 0" class="empty-state">
          <p>{{ $t('expenses.noExpenses') }}</p>
        </div>

        <table v-else class="expenses-table">
          <thead>
            <tr>
              <th class="id">#</th>
              <th class="description">{{ $t('form.description') }}</th>
              <th class="type">{{ $t('form.type') }}</th>
              <th class="member">{{ $t('form.members') }}</th>
              <th class="amount">{{ $t('form.amount') }}</th>
              <th class="date">{{ $t('expenses.date') }}</th>
              <th class="actions"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="expense in filteredExpenses" :key="expense.id" class="expense-row">
              <td class="id">{{ expense.id }}</td>
              <td class="description">{{ expense.description }}</td>
              <td class="type">
                <span class="type-badge" :title="getTypeName(expense.typeId ?? expense.type)">
                  <span class="type-full">{{ getTypeName(expense.typeId ?? expense.type) }}</span>
                  <span class="type-letter">{{ getTypeName(expense.typeId ?? expense.type).charAt(0) }}</span>
                </span>
              </td>
              <td class="member">{{ getMemberNames(expense) }}</td>
              <td class="amount" :class="{ 'amount-negative': parseFloat(expense.amount) < 0 }">R$ {{ parseFloat(expense.amount).toFixed(2) }}</td>
              <td class="date">{{ formatDate(expense.date || expense.createdAt) }}</td>
              <td class="actions">
                <div class="actions-desktop">
                  <button @click="openEditModal(expense)" class="btn-edit" :title="$t('actions.edit')">
                    <i class="fa-solid fa-pencil"></i>
                  </button>
                  <button @click="deleteExpense(expense.id)" class="btn-delete" :title="$t('actions.delete')">
                    <i class="fa-solid fa-xmark"></i>
                  </button>
                </div>
                <div class="actions-mobile">
                  <button @click="toggleActionMenu(expense.id)" class="btn-dots">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                  <div v-if="openActionMenuId === expense.id" class="action-dropdown">
                    <button @click="openEditModal(expense); openActionMenuId = null">
                      <i class="fa-solid fa-pencil"></i> {{ $t('actions.edit') }}
                    </button>
                    <button @click="deleteExpense(expense.id); openActionMenuId = null">
                      <i class="fa-solid fa-xmark"></i> {{ $t('actions.delete') }}
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="summary" v-if="filteredExpenses.length > 0">
          <strong>{{ $t('expenses.total') }}</strong> R$ {{ calculateTotal().toFixed(2) }}
        </div>
      </section>

      <Modal v-model="isAddExpenseModalOpen" :title="$t('form.addExpense')">
        <form @submit.prevent="submitForm" class="form">
          <div class="form-group">
            <label for="description">{{ $t('form.description') }} *</label>
            <input
              id="description"
              v-model="formData.description"
              type="text"
              :placeholder="$t('form.description')"
              required
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="type">{{ $t('form.type') }} *</label>
              <select id="type" v-model="formData.typeId" required>
                <option value="" disabled>{{ $t('form.selectType') }}</option>
                <option v-for="type in activeTypes" :key="type.id" :value="String(type.id)">
                  {{ type.name }}
                </option>
              </select>
              <div class="type-quick-add">
                <input
                  v-model="newTypeName"
                  type="text"
                  :placeholder="$t('form.newTypePlaceholder')"
                  :disabled="creatingType"
                />
                <button
                  type="button"
                  @click="createExpenseType"
                  :disabled="creatingType"
                  class="btn-secondary"
                >
                  {{ creatingType ? $t('actions.loading') : '+ ' + $t('form.addType') }}
                </button>
              </div>
            </div>

            <div class="form-group">
              <label for="amount">{{ $t('form.amount') }} *</label>
              <input
                id="amount"
                v-model="formData.amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="date">{{ $t('expenses.date') }} *</label>
            <input
              id="date"
              v-model="formData.date"
              type="date"
              required
            />
          </div>

          <div class="form-group">
            <label for="member">{{ $t('form.members') }}</label>
            <select id="member" v-model="formData.memberIds" multiple size="5">
              <option v-for="mem in members" :key="mem.id" :value="mem.id">
                {{ mem.name }}{{ !mem.active ? ' (disabled)' : '' }}
              </option>
            </select>
            <small>{{ $t('form.membersHint') }}</small>
          </div>

          <div class="form-group">
            <label for="notes">{{ $t('form.notes') }}</label>
            <textarea
              id="notes"
              v-model="formData.notes"
              :placeholder="$t('form.notes')"
              rows="3"
            ></textarea>
          </div>

          <button type="submit" :disabled="submitting || loading" class="btn-primary">
            <i v-if="!submitting" class="fa-solid fa-check"></i> {{ submitting ? $t('actions.loading') : $t('form.submit') }}
          </button>
        </form>
      </Modal>

      <Modal v-model="isEditExpenseModalOpen" :title="$t('expenses.edit')">
        <form @submit.prevent="updateExpense" class="form">
          <div class="form-group">
            <label for="edit-description">{{ $t('form.description') }} *</label>
            <input
              id="edit-description"
              v-model="editFormData.description"
              type="text"
              :placeholder="$t('form.description')"
              required
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="edit-type">{{ $t('form.type') }} *</label>
              <select id="edit-type" v-model="editFormData.typeId" required>
                <option value="" disabled>{{ $t('form.selectType') }}</option>
                <option v-for="type in activeTypes" :key="type.id" :value="String(type.id)">
                  {{ type.name }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label for="edit-amount">{{ $t('form.amount') }} *</label>
              <input
                id="edit-amount"
                v-model="editFormData.amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div class="form-group">
            <label for="edit-date">{{ $t('expenses.date') }} *</label>
            <input
              id="edit-date"
              v-model="editFormData.date"
              type="date"
              required
            />
          </div>

          <div class="form-group">
            <label for="edit-member">{{ $t('form.members') }}</label>
            <select id="edit-member" v-model="editFormData.memberIds" multiple size="5">
              <option v-for="mem in members" :key="mem.id" :value="String(mem.id)">
                {{ mem.name }}{{ !mem.active ? ' (disabled)' : '' }}
              </option>
            </select>
            <small>{{ $t('form.membersHint') }}</small>
          </div>

          <button type="submit" :disabled="updating" class="btn-primary">
            <i v-if="!updating" class="fa-solid fa-check"></i> {{ updating ? $t('actions.loading') : $t('actions.save') }}
          </button>
        </form>
      </Modal>
    </div>

    <!-- Report Tab -->
    <div v-else-if="activeTab === 'report'" class="content">
      <div v-if="loading" class="loading"><i class="fa-solid fa-spinner fa-spin"></i> {{ $t('actions.loading') }}</div>

      <div v-else-if="report.length === 0" class="empty-state">
        <p>{{ $t('report.noData') }}</p>
      </div>

      <template v-else>
        <!-- Summary -->
        <section class="report-section">
          <h2>{{ $t('report.summary') }}</h2>
          <table class="report-table">
            <thead>
              <tr>
                <th>{{ $t('report.description') }}</th>
                <th class="amount">{{ $t('form.amount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{{ $t('report.totalInflows') }}</td>
                <td class="amount">R$ {{ totalInflows.toFixed(2) }}</td>
              </tr>
              <tr>
                <td>{{ $t('report.totalExpenses') }}</td>
                <td class="amount amount-negative">R$ {{ totalOutflows.toFixed(2) }}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="summary-row">
                <td><strong>{{ $t('report.netBalance') }}</strong></td>
                <td class="amount" :class="{ 'amount-negative': netBalance < 0 }">
                  <strong>R$ {{ netBalance.toFixed(2) }}</strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </section>

        <!-- Settlement per member -->
        <section class="report-section">
          <h2>{{ $t('report.settlement') }}</h2>
          <table class="report-table">
            <thead>
              <tr>
                <th class="name">{{ $t('report.member') }}</th>
                <th>{{ $t('report.status') }}</th>
                <th class="amount">{{ $t('form.amount') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="item in report" :key="item.id" class="report-row">
                <td class="name">{{ item.name }}</td>
                <td>
                  <span class="status-badge" :class="item.active ? 'is-active' : 'is-inactive'">
                    {{ item.active ? $t('report.active') : $t('report.inactive') }}
                  </span>
                </td>
                <td class="amount" :class="{ 'amount-negative': parseFloat(item.total) < 0 }">
                  R$ {{ parseFloat(item.total).toFixed(2) }}
                </td>
              </tr>
            </tbody>
          </table>
        </section>
      </template>
    </div>

    <!-- Members Tab -->
    <div v-else-if="activeTab === 'members'" class="content">
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
            <tr v-for="member in members" :key="member.id" class="expense-row">
              <td class="id">{{ member.id }}</td>
              <td class="description">{{ member.name }}</td>
              <td>
                <span class="status-badge" :class="member.active ? 'is-active' : 'is-inactive'">
                  {{ member.active ? $t('members.active') : $t('members.inactive') }}
                </span>
              </td>
              <td class="actions" style="white-space: nowrap;">
                <button
                  @click="openEditMemberModal(member)"
                  class="btn-secondary"
                  style="font-size: 0.8rem; padding: 4px 10px; margin-right: 4px;"
                  :title="$t('members.editMember')"
                >
                  <i class="fa-solid fa-pencil"></i>
                </button>
                <button
                  @click="toggleMemberActive(member.id)"
                  class="btn-secondary"
                  style="font-size: 0.8rem; padding: 4px 10px;"
                >
                  {{ member.active ? $t('members.disable') : $t('members.enable') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>

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

    <!-- Logs Tab -->
    <div v-else-if="activeTab === 'logs'" class="content">
      <section class="expenses-section">
        <div class="section-header">
          <div class="section-actions">
            <button @click="loadData" :disabled="loading" class="btn-secondary">
              <i v-if="!loading" class="fa-solid fa-arrows-rotate"></i> {{ loading ? $t('actions.loading') : $t('actions.refresh') }}
            </button>
          </div>
        </div>

        <div v-if="loading && logs.length === 0" class="loading">
          <i class="fa-solid fa-spinner fa-spin"></i> {{ $t('actions.loading') }}
        </div>

        <div v-else-if="logs.length === 0" class="empty-state">
          <p>{{ $t('logs.noLogs') }}</p>
        </div>

        <table v-else class="expenses-table logs-table">
          <thead>
            <tr>
              <th class="id">#</th>
              <th>{{ $t('logs.action') }}</th>
              <th>{{ $t('logs.resource') }}</th>
              <th class="log-resource-id">{{ $t('logs.resourceId') }}</th>
              <th>{{ $t('logs.user') }}</th>
              <th class="log-details">{{ $t('logs.details') }}</th>
              <th class="date">{{ $t('logs.createdAt') }}</th>
              <th class="log-details-btn"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="log in logs" :key="log.id">
              <tr class="expense-row">
                <td class="id">{{ log.id }}</td>
                <td class="description">
                  <span class="action-badge" :class="'action-' + log.action.toLowerCase()">
                    {{ log.action }}
                  </span>
                </td>
                <td class="type">{{ log.resource }}</td>
                <td class="log-resource-id">{{ log.resourceId || '-' }}</td>
                <td>{{ log.userName || '-' }}</td>
                <td class="log-details" style="font-size: 0.85rem; word-break: break-word;">
                  <code v-if="log.details">{{ log.details.substring(0, 100) }}{{ log.details.length > 100 ? '...' : '' }}</code>
                  <span v-else>-</span>
                </td>
                <td class="date">{{ formatDate(log.createdAt) }}</td>
                <td class="log-details-btn">
                  <button class="btn-dots" @click="expandedLogId = expandedLogId === log.id ? null : log.id" :title="$t('logs.details')">
                    <i class="fa-solid fa-ellipsis-vertical"></i>
                  </button>
                </td>
              </tr>
              <tr v-if="expandedLogId === log.id" class="log-expanded-row">
                <td :colspan="5">
                  <div class="log-expanded-details">
                    <div><strong>{{ $t('logs.resourceId') }}:</strong> {{ log.resourceId || '-' }}</div>
                    <div><strong>{{ $t('logs.createdAt') }}:</strong> {{ formatDate(log.createdAt) }}</div>
                    <div v-if="log.details"><strong>{{ $t('logs.details') }}:</strong> <code>{{ log.details }}</code></div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>
    </div>

    <footer class="app-footer">
      <span class="badge" :class="{ online: health === 'ok', offline: health !== 'ok' }">
        <i class="fa-solid fa-circle"></i> {{ health === 'ok' ? 'Online' : 'Offline' }}
      </span>
    </footer>
  </div>
</template>
