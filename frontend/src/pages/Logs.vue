<script setup>
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import AppHeader from '../components/AppHeader.vue'
import { formatDate } from '../utils/date'

const { t, locale } = useI18n()
const router = useRouter()
const { logout, getAuthHeader, getCurrentUser } = useAuth()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const logs = ref([])
const loading = ref(false)
const error = ref('')
const expandedLogId = ref(null)

async function loadData() {
  loading.value = true
  error.value = ''

  try {
    const response = await fetch(`${apiBaseUrl}/api/logs?limit=100`, { headers: getAuthHeader() })

    if (response.status === 401) {
      await logout()
      await router.push({ path: '/login', query: { reason: 'expired' } })
      return
    }

    if (!response.ok) {
      throw new Error(t('logs.loadingError'))
    }

    logs.value = (await response.json()).data || []
  } catch (exception) {
    error.value = exception instanceof Error ? exception.message : t('errors.genericError')
  } finally {
    loading.value = false
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
    <AppHeader icon="fa-clock-rotate-left" :title="$t('logs.title')" />

    <div class="content">
      <section class="expenses-section">
        <div class="section-header">
          <div class="section-actions">
            <button @click="loadData" :disabled="loading" class="btn-secondary">
              <i v-if="!loading" class="fa-solid fa-arrows-rotate"></i> {{ loading ? $t('actions.loading') : $t('actions.refresh') }}
            </button>
          </div>
        </div>

        <div v-if="error" class="alert alert-error">{{ error }}</div>

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
                <td class="date">{{ formatDate(log.createdAt, locale) }}</td>
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
                    <div><strong>{{ $t('logs.createdAt') }}:</strong> {{ formatDate(log.createdAt, locale) }}</div>
                    <div v-if="log.details"><strong>{{ $t('logs.details') }}:</strong> <code>{{ log.details }}</code></div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </section>
    </div>
  </div>
</template>
