<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import AppHeader from '../components/AppHeader.vue'
import { connectionLost } from '../offline/connection'
import { copyInfo } from '../offline/snapshot'
import { THEMES, theme } from '../theme'
import { formatTimeAgo } from '../utils/date'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { member, sessionExpired, getAuthHeader, getCurrentUser, handleUnauthorized, syncCopy } = useAuth()
const apiBaseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

const themeIcons = { system: 'fa-circle-half-stroke', light: 'fa-sun', dark: 'fa-moon' }
const languages = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
]

// Super admins who aren't in the band have no member record to change here
const canEditProfile = computed(() => Boolean(member.value?.id))

const name = ref(member.value?.name ?? '')
const saving = ref(false)
const profileError = ref('')
const profileSaved = ref(false)

// The name can come back fresher from the server after the page opened; typing isn't overwritten
watch(() => member.value?.name, (value, previous) => {
  if (name.value.trim() === (previous ?? '')) name.value = value ?? ''
})

const nameChanged = computed(() => name.value.trim() !== (member.value?.name ?? ''))

async function saveProfile() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    profileError.value = t('members.nameRequired')
    return
  }
  saving.value = true
  profileError.value = ''
  profileSaved.value = false
  try {
    const response = await fetch(`${apiBaseUrl}/api/members/${member.value.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ name: trimmed }),
    })
    if (response.status === 401) {
      await handleUnauthorized()
      await router.push({ path: '/login', query: { redirect: route.fullPath, reason: 'expired' } })
      return
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(body?.message || t('errors.genericError'))
    }
    name.value = trimmed
    profileSaved.value = true
    // Brings the new name into the header and into what's kept for the next visit
    await getCurrentUser()
  } catch (exception) {
    // A TypeError is fetch failing to reach the server at all
    profileError.value = exception instanceof Error && !(exception instanceof TypeError)
      ? exception.message
      : t('errors.genericError')
  } finally {
    saving.value = false
  }
}

function changeLanguage(event) {
  locale.value = event.target.value
  localStorage.setItem('language', event.target.value)
}

const refreshing = ref(false)
// 'saved' or 'failed', from the last tap
const refreshResult = ref(null)

const savedWhen = computed(() => (copyInfo.value ? formatTimeAgo(copyInfo.value.savedAt, locale.value) : ''))

// Tried even when the app thinks there's no connection: tapping is how one finds out it's back
async function refreshData() {
  refreshing.value = true
  refreshResult.value = null
  const result = await syncCopy({ force: true })
  refreshResult.value = result === 'saved' ? 'saved' : 'failed'
  refreshing.value = false
}

// Installed apps on iPhones keep their data much better than a Safari tab does
const shouldSuggestInstall = /iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone

function signIn() {
  router.push({ path: '/login', query: { redirect: route.fullPath } })
}
</script>

<template>
  <div class="container">
    <AppHeader icon="fa-gear" :title="$t('settings.title')" />

    <div class="content settings">
      <section class="form-section">
        <h2><i class="fa-solid fa-user"></i> {{ $t('settings.profile') }}</h2>
        <form class="form" @submit.prevent="saveProfile">
          <div class="form-group">
            <label for="settings-name">{{ $t('settings.name') }}</label>
            <input
              id="settings-name"
              v-model="name"
              type="text"
              maxlength="255"
              autocomplete="name"
              :disabled="!canEditProfile || saving"
              @input="profileSaved = false"
            />
          </div>
          <div class="form-group">
            <label for="settings-email">{{ $t('settings.email') }}</label>
            <input
              id="settings-email"
              type="text"
              :value="member?.email || $t('settings.noEmail')"
              disabled
            />
            <small class="settings-hint">{{ $t('settings.emailHint') }}</small>
          </div>

          <p v-if="!canEditProfile" class="settings-hint">{{ $t('settings.superAdminHint') }}</p>
          <template v-else>
            <div v-if="profileError" class="alert alert-error">{{ profileError }}</div>
            <div v-if="profileSaved" class="alert alert-success">✓ {{ $t('settings.saved') }}</div>
            <p v-if="connectionLost" class="settings-hint">{{ $t('settings.needsConnection') }}</p>
            <div class="settings-actions">
              <button type="submit" class="btn-primary" :disabled="saving || !nameChanged || connectionLost">
                <i v-if="saving" class="fa-solid fa-spinner fa-spin"></i>
                {{ $t('actions.save') }}
              </button>
            </div>
          </template>
        </form>
      </section>

      <section class="form-section">
        <h2><i class="fa-solid fa-palette"></i> {{ $t('settings.appearance') }}</h2>
        <div class="form">
          <div class="form-group">
            <span id="settings-theme-label" class="settings-label">{{ $t('settings.theme') }}</span>
            <div class="theme-options" role="radiogroup" aria-labelledby="settings-theme-label">
              <button
                v-for="option in THEMES"
                :key="option"
                type="button"
                role="radio"
                class="theme-option"
                :class="{ 'is-selected': theme === option }"
                :aria-checked="theme === option"
                :data-theme-option="option"
                @click="theme = option"
              >
                <i class="fa-solid" :class="themeIcons[option]"></i>
                {{ $t(`settings.themes.${option}`) }}
              </button>
            </div>
          </div>
          <div class="form-group">
            <label for="settings-language">{{ $t('settings.language') }}</label>
            <select id="settings-language" :value="locale" @change="changeLanguage">
              <option v-for="language in languages" :key="language.value" :value="language.value">
                {{ language.label }}
              </option>
            </select>
          </div>
        </div>
      </section>

      <section class="form-section">
        <h2><i class="fa-solid fa-cloud-arrow-down"></i> {{ $t('settings.offlineData') }}</h2>
        <div class="form">
          <p class="settings-hint">{{ $t('settings.offlineIntro') }}</p>
          <p v-if="shouldSuggestInstall" class="settings-hint">{{ $t('offline.installHint') }}</p>
          <p class="settings-copy-state" aria-live="polite">
            {{ copyInfo ? $t('settings.savedAt', { when: savedWhen }) : $t('settings.noCopy') }}
          </p>

          <template v-if="sessionExpired">
            <div class="alert alert-error">{{ $t('settings.expired') }}</div>
            <div class="settings-actions">
              <button type="button" class="btn-primary" @click="signIn">{{ $t('offline.signIn') }}</button>
            </div>
          </template>
          <template v-else>
            <div v-if="refreshResult === 'saved'" class="alert alert-success">✓ {{ $t('settings.refreshed') }}</div>
            <div v-if="refreshResult === 'failed'" class="alert alert-error">{{ $t('settings.refreshFailed') }}</div>
            <div class="settings-actions">
              <button type="button" class="btn-primary" :disabled="refreshing" @click="refreshData">
                <i class="fa-solid" :class="refreshing ? 'fa-spinner fa-spin' : 'fa-rotate'"></i>
                {{ refreshing ? $t('actions.loading') : $t('settings.refresh') }}
              </button>
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings {
  max-width: 640px;
  margin: 0 auto;
  text-align: left;
}
.settings h2 {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.2rem;
}
.settings h2 i {
  color: var(--accent);
}
.settings-label {
  font-weight: 500;
  color: var(--text-h);
  font-size: 12px;
}
.settings-hint {
  margin: 0;
  color: var(--text-light);
  font-size: 0.85rem;
}
.settings-copy-state {
  margin: 0;
  color: var(--text-h);
}
.settings-actions {
  display: flex;
  justify-content: flex-end;
}
.form-group input:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
.theme-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.theme-option {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 0;
  justify-content: center;
  min-width: 0;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text);
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
}
@media (max-width: 600px) {
  .theme-option {
    flex-direction: column;
    gap: 4px;
    padding: 8px 6px;
    font-size: 0.85rem;
    white-space: normal;
  }
}
.theme-option:hover {
  border-color: var(--accent);
}
.theme-option.is-selected {
  border-color: var(--accent);
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}
</style>
