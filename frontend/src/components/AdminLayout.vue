<script setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdmin } from '../composables/useAdmin'
import { renderGoogleButton } from '../utils/googleSignIn'
import LanguageSelector from './LanguageSelector.vue'

defineProps({
  icon: { type: String, required: true },
  title: { type: String, required: true },
})

// Emitted once a super admin is signed in, so the page can load its data
const emit = defineEmits(['ready'])

const { t } = useI18n()
const { admin, isLoggedIn, expired, login, logout, refresh } = useAdmin()
const loginError = ref('')
const signingIn = ref(false)
const showLanguageSelector = ref(false)
const googleButton = ref(null)

const sections = [
  { path: '/admin', icon: 'fa-guitar', titleKey: 'admin.bands.title' },
  { path: '/admin/super-admins', icon: 'fa-user-shield', titleKey: 'admin.superAdmins.title' },
]

async function handleCredential(credential) {
  loginError.value = ''
  signingIn.value = true
  try {
    await login(credential)
    emit('ready')
  } catch (err) {
    loginError.value = err.message || t('login.loginFailed')
  } finally {
    signingIn.value = false
  }
}

function showGoogleButton() {
  nextTick(() => {
    if (googleButton.value) renderGoogleButton(googleButton.value, handleCredential)
  })
}

async function handleLogout() {
  if (confirm(t('app.confirmLogout'))) await logout()
}

// Signed out (by the button or an expired session): back to the sign-in card
watch(isLoggedIn, (loggedIn) => {
  if (!loggedIn) showGoogleButton()
})

onMounted(async () => {
  // A rejected session is cleared by refresh(); other failures surface in the page itself
  if (isLoggedIn.value) await refresh()
  if (isLoggedIn.value) {
    emit('ready')
    return
  }
  showGoogleButton()
})
</script>

<template>
  <div v-if="!isLoggedIn" class="admin-login">
    <div class="admin-login-card">
      <h1><i class="fa-solid fa-user-shield"></i> {{ $t('admin.title') }}</h1>
      <p class="subtitle">{{ $t('admin.signIn') }}</p>
      <div v-if="expired && !loginError" class="alert alert-error">{{ $t('admin.expired') }}</div>
      <div v-if="loginError" class="alert alert-error">{{ loginError }}</div>
      <p v-if="signingIn" class="subtitle">{{ $t('login.loggingIn') }}</p>
      <div ref="googleButton" class="google-btn-wrapper"></div>
    </div>
  </div>

  <div v-else class="container">
    <header class="header">
      <div class="header-top">
        <h1><i class="fa-solid" :class="icon"></i> {{ title }}</h1>
        <div class="header-controls">
          <nav class="admin-nav">
            <router-link
              v-for="section in sections"
              :key="section.path"
              :to="section.path"
              class="nav-link"
              :title="$t(section.titleKey)"
              :aria-label="$t(section.titleKey)"
            >
              <i class="fa-solid" :class="section.icon"></i>
            </router-link>
          </nav>
          <button @click="showLanguageSelector = !showLanguageSelector" class="btn-secondary btn-lang-toggle" :title="$t('app.language')">
            <i class="fa-solid fa-globe"></i>
          </button>
          <LanguageSelector v-if="showLanguageSelector" />
          <div class="user-info">
            <span class="user-name">{{ admin.name }}</span>
            <span class="super-admin-badge">{{ $t('app.superAdmin') }}</span>
          </div>
          <button @click="handleLogout" class="btn-logout" :title="$t('app.logout')">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </div>
    </header>

    <div class="content">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.admin-login {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.admin-login-card {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  text-align: center;
}
.admin-login-card h1 {
  margin: 0 0 10px;
  color: #333;
  font-size: 24px;
}
.admin-login-card .subtitle {
  margin: 0 0 24px;
  color: #666;
  font-size: 14px;
}
.admin-login-card .alert {
  margin: 0 0 20px;
  text-align: left;
}
.google-btn-wrapper {
  display: flex;
  justify-content: center;
  min-height: 44px;
}
.admin-nav {
  display: flex;
  align-items: center;
  gap: 4px;
}
.nav-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  color: var(--accent);
  text-decoration: none;
  transition: background 0.15s;
}
.nav-link:hover,
.nav-link.router-link-exact-active {
  background: var(--accent-light);
}
.super-admin-badge {
  margin-left: 6px;
  padding: 2px 8px;
  border-radius: 10px;
  background: #fef3c7;
  color: #92400e;
  font-size: 0.7rem;
  font-weight: 600;
  white-space: nowrap;
}
</style>
