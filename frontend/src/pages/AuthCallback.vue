<template>
  <div class="login-container">
    <div class="login-card">
      <p v-if="!error" class="status">{{ t('login.completing') }}</p>
      <template v-else>
        <div class="error-message">{{ error }}</div>
        <router-link to="/login" class="back-link">{{ t('login.backToLogin') }}</router-link>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { safeRedirectPath } from '../hosts'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { exchangeLoginCode } = useAuth()

const error = ref('')

onMounted(async () => {
  try {
    await exchangeLoginCode(route.query.code)
    router.replace(safeRedirectPath(route.query.redirect))
  } catch {
    error.value = t('login.codeFailed')
  }
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

.status {
  margin: 0;
  color: #667eea;
  font-size: 15px;
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

.back-link {
  color: #667eea;
  font-size: 14px;
}
</style>
