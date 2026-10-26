<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import LanguageSelector from './LanguageSelector.vue'

defineProps({
  icon: { type: String, required: true },
  title: { type: String, required: true },
})

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { logout, member } = useAuth()
const showLanguageSelector = ref(false)

const sections = [
  { path: '/dashboard', icon: 'fa-house', titleKey: 'home.title' },
  { path: '/agenda', icon: 'fa-calendar-days', titleKey: 'agenda.title' },
  { path: '/musicas', icon: 'fa-music', titleKey: 'songs.title' },
  { path: '/financeiro', icon: 'fa-coins', titleKey: 'finance.title' },
  { path: '/integrantes', icon: 'fa-users', titleKey: 'members.title' },
  { path: '/registros', icon: 'fa-clock-rotate-left', titleKey: 'logs.title' },
]

const otherSections = computed(() => sections.filter((s) => s.path !== route.path))

async function handleLogout() {
  if (confirm(t('app.confirmLogout'))) {
    await logout()
    router.push('/login')
  }
}
</script>

<template>
  <header class="header">
    <div class="header-top">
      <h1><i class="fa-solid" :class="icon"></i> {{ title }}</h1>
      <div class="header-controls">
        <nav class="header-nav">
          <router-link
            v-for="section in otherSections"
            :key="section.path"
            :to="section.path"
            class="nav-link"
            :title="$t(section.titleKey)"
            :aria-label="$t(section.titleKey)"
          >
            <i class="fa-solid" :class="section.icon"></i>
          </router-link>
        </nav>
        <slot />
        <button @click="showLanguageSelector = !showLanguageSelector" class="btn-secondary btn-lang-toggle" :title="$t('app.language')">
          <i class="fa-solid fa-globe"></i>
        </button>
        <LanguageSelector v-if="showLanguageSelector" />
        <div v-if="member" class="user-info">
          <span class="user-name">{{ member.name }}</span>
          <span v-if="member.superAdmin" class="super-admin-badge">{{ $t('app.superAdmin') }}</span>
        </div>
        <button @click="handleLogout" class="btn-logout" :title="$t('app.logout')">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
    </div>
  </header>
</template>

<style scoped>
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
.header-nav {
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
.nav-link:hover {
  background: var(--accent-light);
}
@media (max-width: 600px) {
  .header-nav {
    gap: 0;
  }
  .nav-link {
    width: 30px;
    height: 30px;
  }
}
</style>
