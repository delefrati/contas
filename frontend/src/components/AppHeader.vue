<script setup>
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import LanguageSelector from './LanguageSelector.vue'
import { adminUrl } from '../hosts'
import { connectionLost } from '../offline/connection'
import { copyInfo } from '../offline/snapshot'
import { helpPath } from '../manual'

defineProps({
  icon: { type: String, required: true },
  title: { type: String, required: true },
  // Shown instead of the icon when set
  logo: { type: String, default: null },
  // Turns the logo/icon into a button that emits edit-logo
  logoEditable: { type: Boolean, default: false },
})

const emit = defineEmits(['edit-logo'])

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { logout, member, sessionExpired } = useAuth()
const showLanguageSelector = ref(false)

const sections = [
  { path: '/dashboard', icon: 'fa-house', titleKey: 'home.title' },
  { path: '/agenda', icon: 'fa-calendar-days', titleKey: 'agenda.title', offline: true },
  { path: '/musicas', icon: 'fa-music', titleKey: 'songs.title', offline: true },
  { path: '/financeiro', icon: 'fa-coins', titleKey: 'finance.title' },
  { path: '/integrantes', icon: 'fa-users', titleKey: 'members.title' },
  { path: '/registros', icon: 'fa-clock-rotate-left', titleKey: 'logs.title' },
]

const otherSections = computed(() => sections.filter((s) => s.path !== route.path))

// Opens the manual on the part about this screen; it's bundled, so it works offline too
const help = computed(() => helpPath(route.name))

const unavailableOffline = computed(() => connectionLost.value || sessionExpired.value)

// Leaving deletes the download, and without a connection it can't be fetched again
function confirmLogoutMessage() {
  return unavailableOffline.value && copyInfo.value ? t('offline.confirmLogout') : t('app.confirmLogout')
}

async function handleLogout() {
  if (confirm(confirmLogoutMessage())) {
    await logout()
    router.push('/login')
  }
}
</script>

<template>
  <header class="header">
    <div class="header-top">
      <h1>
        <component
          :is="logoEditable ? 'button' : 'span'"
          :type="logoEditable ? 'button' : undefined"
          class="header-logo"
          :class="{ 'is-editable': logoEditable }"
          :title="logoEditable ? $t('band.changeLogo') : undefined"
          :aria-label="logoEditable ? $t('band.changeLogo') : undefined"
          @click="logoEditable && emit('edit-logo')"
        >
          <img v-if="logo" :src="logo" alt="" />
          <i v-else class="fa-solid" :class="icon"></i>
          <span v-if="logoEditable" class="header-logo-edit"><i class="fa-solid fa-camera"></i></span>
        </component>
        {{ title }}
      </h1>
      <div class="header-controls">
        <nav class="header-nav">
          <router-link
            v-for="section in otherSections"
            :key="section.path"
            :to="section.path"
            class="nav-link"
            :class="{ 'is-unavailable': unavailableOffline && !section.offline }"
            :title="$t(section.titleKey)"
            :aria-label="$t(section.titleKey)"
          >
            <i class="fa-solid" :class="section.icon"></i>
          </router-link>
          <router-link
            :to="help"
            class="nav-link"
            :title="$t('manual.open')"
            :aria-label="$t('manual.open')"
          >
            <i class="fa-solid fa-circle-question"></i>
          </router-link>
          <a
            v-if="member?.superAdmin"
            :href="adminUrl()"
            class="nav-link"
            :title="$t('admin.openPanel')"
            :aria-label="$t('admin.openPanel')"
          >
            <i class="fa-solid fa-user-shield"></i>
          </a>
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
.header-logo {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  margin-right: 6px;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
}
.header-logo img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 8px;
}
.header-logo.is-editable {
  cursor: pointer;
}
.header-logo-edit {
  position: absolute;
  right: -6px;
  bottom: -4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  font-size: 10px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
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
.nav-link.is-unavailable {
  opacity: 0.4;
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
/* Seven icons on an event's page (every section, plus help) fit a 360px phone */
@media (max-width: 400px) {
  .nav-link {
    width: 26px;
  }
}
</style>
