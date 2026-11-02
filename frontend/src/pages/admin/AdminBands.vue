<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdmin } from '../../composables/useAdmin'
import { bandUrl } from '../../hosts'
import AdminLayout from '../../components/AdminLayout.vue'
import Modal from '../../components/Modal.vue'

const { t } = useI18n()
const { get, post } = useAdmin()

const bands = ref([])
const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const isCreateModalOpen = ref(false)
const creating = ref(false)
const form = ref(emptyForm())
// The address follows the name until it's edited by hand
const slugEdited = ref(false)

function emptyForm() {
  return { name: '', slug: '', memberName: '', memberEmail: '' }
}

// "Banda do Zé!" -> "banda-do-ze"
function slugify(text) {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
    .replace(/-+$/, '')
}

watch(() => form.value.name, (name) => {
  if (!slugEdited.value) form.value.slug = slugify(name)
})

function showSuccess(message) {
  successMessage.value = '✓ ' + message
  setTimeout(() => { successMessage.value = '' }, 3000)
}

async function loadBands() {
  loading.value = true
  error.value = ''
  try {
    bands.value = (await get('/bands')) || []
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function openCreateModal() {
  form.value = emptyForm()
  slugEdited.value = false
  error.value = ''
  isCreateModalOpen.value = true
}

async function createBand() {
  creating.value = true
  error.value = ''
  try {
    const { name, slug, memberName, memberEmail } = form.value
    const member = memberName.trim() || memberEmail.trim()
      ? { name: memberName.trim(), email: memberEmail.trim() || undefined }
      : undefined
    await post('/bands', { name: name.trim(), slug: slug.trim(), member })
    isCreateModalOpen.value = false
    await loadBands()
    showSuccess(t('admin.bands.created'))
  } catch (err) {
    error.value = err.message
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <AdminLayout icon="fa-guitar" :title="$t('admin.bands.title')" @ready="loadBands">
    <section class="expenses-section">
      <div class="section-header">
        <div class="section-actions">
          <button @click="openCreateModal" class="btn-primary">+ {{ $t('admin.bands.add') }}</button>
          <button @click="loadBands" :disabled="loading" class="btn-secondary">
            <i v-if="!loading" class="fa-solid fa-arrows-rotate"></i> {{ loading ? $t('actions.loading') : $t('actions.refresh') }}
          </button>
        </div>
      </div>

      <div v-if="successMessage" class="alert alert-success">{{ successMessage }}</div>
      <div v-if="error && !isCreateModalOpen" class="alert alert-error">{{ error }}</div>

      <div v-if="loading && bands.length === 0" class="loading">
        <i class="fa-solid fa-spinner fa-spin"></i> {{ $t('actions.loading') }}
      </div>

      <div v-else-if="bands.length === 0" class="empty-state">
        <p>{{ $t('admin.bands.none') }}</p>
      </div>

      <table v-else class="expenses-table">
        <thead>
          <tr>
            <th>{{ $t('admin.bands.name') }}</th>
            <th>{{ $t('admin.bands.address') }}</th>
            <th>{{ $t('admin.bands.activeMembers') }}</th>
            <th>{{ $t('admin.bands.status') }}</th>
            <th class="actions"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="band in bands" :key="band.id" class="expense-row">
            <td class="description">{{ band.name }}</td>
            <td>
              <a v-if="band.active && bandUrl(band.slug)" :href="bandUrl(band.slug)" target="_blank" rel="noopener">
                {{ band.slug }}
              </a>
              <span v-else>{{ band.slug }}</span>
            </td>
            <td>{{ band.activeMembers }}</td>
            <td>
              <span class="status-badge" :class="band.active ? 'is-active' : 'is-inactive'">
                {{ band.active ? $t('admin.bands.active') : $t('admin.bands.inactive') }}
              </span>
            </td>
            <td class="actions">
              <router-link :to="`/admin/bandas/${band.id}`" class="btn-secondary btn-manage">
                {{ $t('admin.bands.manage') }}
              </router-link>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <Modal v-model="isCreateModalOpen" :title="'🎸 ' + $t('admin.bands.add')">
      <form @submit.prevent="createBand" class="form">
        <div v-if="error" class="alert alert-error">{{ error }}</div>
        <div class="form-group">
          <label for="band-name">{{ $t('admin.bands.name') }} *</label>
          <input id="band-name" v-model="form.name" type="text" maxlength="255" required />
        </div>
        <div class="form-group">
          <label for="band-slug">{{ $t('admin.bands.address') }} *</label>
          <input
            id="band-slug"
            v-model="form.slug"
            type="text"
            maxlength="63"
            pattern="[a-z0-9]([a-z0-9\-]*[a-z0-9])?"
            required
            @input="slugEdited = true"
          />
          <small class="hint">{{ $t('admin.bands.addressHint') }}</small>
        </div>
        <fieldset class="first-member">
          <legend>{{ $t('admin.bands.firstMember') }}</legend>
          <div class="form-group">
            <label for="first-member-name">{{ $t('members.name') }}</label>
            <input id="first-member-name" v-model="form.memberName" type="text" maxlength="255" />
          </div>
          <div class="form-group">
            <label for="first-member-email">{{ $t('members.email') }}</label>
            <input id="first-member-email" v-model="form.memberEmail" type="email" maxlength="255" />
          </div>
          <small class="hint">{{ $t('admin.bands.firstMemberHint') }}</small>
        </fieldset>
        <button type="submit" :disabled="creating" class="btn-primary">
          <i v-if="!creating" class="fa-solid fa-check"></i> {{ creating ? $t('actions.loading') : $t('actions.save') }}
        </button>
      </form>
    </Modal>
  </AdminLayout>
</template>

<style scoped>
.btn-manage {
  display: inline-block;
  padding: 4px 10px;
  font-size: 0.8rem;
  text-decoration: none;
}
.hint {
  display: block;
  margin-top: 4px;
  color: var(--text-light);
  font-size: 0.8rem;
}
.first-member {
  margin: 0 0 16px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.first-member legend {
  padding: 0 4px;
  color: var(--text-light);
  font-size: 0.85rem;
}
</style>
