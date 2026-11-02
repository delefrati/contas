<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAdmin } from '../../composables/useAdmin'
import { bandUrl } from '../../hosts'
import { formatDate } from '../../utils/date'
import AdminLayout from '../../components/AdminLayout.vue'
import Modal from '../../components/Modal.vue'

const { t, locale } = useI18n()
const route = useRoute()
const { get, post, patch } = useAdmin()

const bandId = computed(() => Number(route.params.id))
const band = ref(null)
const members = ref([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const successMessage = ref('')

const isRenameModalOpen = ref(false)
const newName = ref('')
// Add and edit share one modal; editingMember is null when adding
const isMemberModalOpen = ref(false)
const editingMember = ref(null)
const memberForm = ref({ name: '', email: '' })

const url = computed(() => (band.value?.active ? bandUrl(band.value.slug) : null))

function showSuccess(message) {
  successMessage.value = '✓ ' + message
  setTimeout(() => { successMessage.value = '' }, 3000)
}

// Runs a change; on success shows message and reloads, on failure shows the error
async function save(change, message) {
  saving.value = true
  error.value = ''
  try {
    await change()
    await load()
    if (message) showSuccess(message)
    return true
  } catch (err) {
    error.value = err.message
    return false
  } finally {
    saving.value = false
  }
}

async function load() {
  loading.value = true
  try {
    const [loadedBand, loadedMembers] = await Promise.all([
      get(`/bands/${bandId.value}`),
      get(`/bands/${bandId.value}/members`),
    ])
    band.value = loadedBand
    members.value = loadedMembers || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function openRenameModal() {
  newName.value = band.value.name
  error.value = ''
  isRenameModalOpen.value = true
}

async function rename() {
  const ok = await save(() => patch(`/bands/${bandId.value}`, { name: newName.value.trim() }), t('admin.bands.renamed'))
  if (ok) isRenameModalOpen.value = false
}

async function toggleBandActive() {
  const active = !band.value.active
  if (!active && !confirm(t('admin.bands.confirmDisable', { name: band.value.name }))) return
  await save(
    () => patch(`/bands/${bandId.value}`, { active }),
    active ? t('admin.bands.enabled') : t('admin.bands.disabled'),
  )
}

function openMemberModal(member = null) {
  editingMember.value = member
  memberForm.value = { name: member?.name || '', email: member?.email || '' }
  error.value = ''
  isMemberModalOpen.value = true
}

async function saveMember() {
  const body = { name: memberForm.value.name.trim(), email: memberForm.value.email.trim() }
  const ok = editingMember.value
    ? await save(() => patch(`/bands/${bandId.value}/members/${editingMember.value.id}`, body), t('members.successUpdate'))
    : await save(() => post(`/bands/${bandId.value}/members`, body), t('members.successCreate'))
  if (ok) isMemberModalOpen.value = false
}

function toggleMemberActive(member) {
  return save(() => patch(`/bands/${bandId.value}/members/${member.id}/toggle-active`))
}
</script>

<template>
  <AdminLayout icon="fa-guitar" :title="band?.name || $t('admin.bands.title')" @ready="load">
    <router-link to="/admin" class="back-link">
      <i class="fa-solid fa-arrow-left"></i> {{ $t('admin.bands.back') }}
    </router-link>

    <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
    <div v-if="error && !isRenameModalOpen && !isMemberModalOpen" class="alert alert-error">{{ error }}</div>

    <section v-if="band" class="expenses-section">
      <div class="section-header">
        <div class="band-facts">
          <span class="status-badge" :class="band.active ? 'is-active' : 'is-inactive'">
            {{ band.active ? $t('admin.bands.active') : $t('admin.bands.inactive') }}
          </span>
          <span>
            {{ $t('admin.bands.address') }}:
            <a v-if="url" :href="url" target="_blank" rel="noopener">{{ band.slug }}</a>
            <strong v-else>{{ band.slug }}</strong>
          </span>
          <span>{{ $t('admin.bands.createdAt') }} {{ formatDate(band.createdAt, locale) }}</span>
        </div>
        <div class="section-actions">
          <button @click="openRenameModal" class="btn-secondary">
            <i class="fa-solid fa-pencil"></i> {{ $t('admin.bands.rename') }}
          </button>
          <button @click="toggleBandActive" :disabled="saving" class="btn-secondary">
            {{ band.active ? $t('admin.bands.disable') : $t('admin.bands.enable') }}
          </button>
        </div>
      </div>
    </section>

    <section v-if="band" class="expenses-section">
      <div class="section-header">
        <h2>{{ $t('members.title') }}</h2>
        <div class="section-actions">
          <button @click="openMemberModal()" class="btn-primary">+ {{ $t('members.addMember') }}</button>
        </div>
      </div>

      <div v-if="members.length === 0" class="empty-state">
        <p>{{ $t('members.noMembers') }}</p>
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
          <tr v-for="m in members" :key="m.id" class="expense-row">
            <td class="description">{{ m.name }}</td>
            <td>{{ m.email || '—' }}</td>
            <td>
              <span class="status-badge" :class="m.active ? 'is-active' : 'is-inactive'">
                {{ m.active ? $t('members.active') : $t('members.inactive') }}
              </span>
            </td>
            <td class="actions" style="white-space: nowrap;">
              <button
                @click="openMemberModal(m)"
                class="btn-secondary btn-small"
                :title="$t('members.editMember')"
                :aria-label="$t('members.editMember')"
              >
                <i class="fa-solid fa-pencil"></i>
              </button>
              <button @click="toggleMemberActive(m)" :disabled="saving" class="btn-secondary btn-small">
                {{ m.active ? $t('members.disable') : $t('members.enable') }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <div v-else-if="loading" class="loading">
      <i class="fa-solid fa-spinner fa-spin"></i> {{ $t('actions.loading') }}
    </div>

    <Modal v-model="isRenameModalOpen" :title="'✏️ ' + $t('admin.bands.rename')">
      <form @submit.prevent="rename" class="form">
        <div v-if="error" class="alert alert-error">{{ error }}</div>
        <div class="form-group">
          <label for="band-new-name">{{ $t('admin.bands.name') }} *</label>
          <input id="band-new-name" v-model="newName" type="text" maxlength="255" required />
        </div>
        <button type="submit" :disabled="saving" class="btn-primary">
          <i v-if="!saving" class="fa-solid fa-check"></i> {{ saving ? $t('actions.loading') : $t('actions.save') }}
        </button>
      </form>
    </Modal>

    <Modal
      v-model="isMemberModalOpen"
      :title="editingMember ? '✏️ ' + $t('members.editMember') : '👤 ' + $t('members.addMember')"
    >
      <form @submit.prevent="saveMember" class="form">
        <div v-if="error" class="alert alert-error">{{ error }}</div>
        <div class="form-group">
          <label for="admin-member-name">{{ $t('members.name') }} *</label>
          <input id="admin-member-name" v-model="memberForm.name" type="text" maxlength="255" required />
        </div>
        <div class="form-group">
          <label for="admin-member-email">{{ $t('members.email') }}</label>
          <input id="admin-member-email" v-model="memberForm.email" type="email" maxlength="255" />
        </div>
        <button type="submit" :disabled="saving" class="btn-primary">
          <i v-if="!saving" class="fa-solid fa-check"></i> {{ saving ? $t('actions.loading') : $t('actions.save') }}
        </button>
      </form>
    </Modal>
  </AdminLayout>
</template>

<style scoped>
.back-link {
  align-self: flex-start;
  color: var(--accent);
  text-decoration: none;
}
.band-facts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  color: var(--text-light);
}
.btn-small {
  margin-right: 4px;
  padding: 4px 10px;
  font-size: 0.8rem;
}
</style>
