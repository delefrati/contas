<template>
  <div class="login-container">
    <div class="login-card">
      <h1>{{ t('login.title') }}</h1>
      <p class="subtitle">{{ t('login.subtitle') }}</p>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>

      <div v-if="loading" class="loading-message">
        {{ t('login.loggingIn') }}
      </div>

      <div id="google-signin-btn" class="google-btn-wrapper"></div>

      <div class="login-info">
        <p>{{ t('login.info') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { loginWithGoogle, loading } = useAuth()

const error = ref('')

function initGoogleSignIn() {
  if (!window.google) return
  window.google.accounts.id.initialize({
    client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    callback: handleGoogleResponse,
  })
  window.google.accounts.id.renderButton(
    document.getElementById('google-signin-btn'),
    { theme: 'outline', size: 'large', width: 320, locale: 'auto' },
  )
}

async function handleGoogleResponse(response) {
  error.value = ''
  try {
    await loginWithGoogle(response.credential)
    const redirectTo = route.query.redirect || '/dashboard'
    router.push(redirectTo)
  } catch (err) {
    error.value = err.message || t('login.loginFailed')
  }
}

onMounted(() => {
  if (window.google?.accounts) {
    initGoogleSignIn()
    return
  }
  const script = document.createElement('script')
  script.src = 'https://accounts.google.com/gsi/client'
  script.onload = initGoogleSignIn
  document.head.appendChild(script)
})
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

.login-card {
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  padding: 40px;
  width: 100%;
  max-width: 400px;
  text-align: center;
}

h1 {
  margin: 0 0 10px 0;
  color: #333;
  font-size: 28px;
  font-weight: 600;
}

.subtitle {
  margin: 0 0 30px 0;
  color: #666;
  font-size: 14px;
}

.error-message {
  background-color: #fee;
  color: #c33;
  padding: 12px;
  border-radius: 4px;
  font-size: 14px;
  border-left: 4px solid #c33;
  text-align: left;
  margin-bottom: 20px;
}

.loading-message {
  color: #667eea;
  font-size: 14px;
  margin-bottom: 20px;
}

.google-btn-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  min-height: 44px;
}

.login-info {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.login-info p {
  color: #666;
  font-size: 13px;
  margin: 0;
  line-height: 1.5;
}

@media (max-width: 480px) {
  .login-card {
    padding: 30px 20px;
  }

  h1 {
    font-size: 24px;
  }
}
</style>
