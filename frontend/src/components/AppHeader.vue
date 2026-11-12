<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { adminUrl } from '../hosts'
import { connectionLost } from '../offline/connection'
import { copyInfo } from '../offline/snapshot'
import { helpPath } from '../manual'

const props = defineProps({
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

const sections = [
  { path: '/dashboard', icon: 'fa-house', titleKey: 'home.title' },
  { path: '/agenda', icon: 'fa-calendar-days', titleKey: 'agenda.title', offline: true },
  { path: '/musicas', icon: 'fa-music', titleKey: 'songs.title', offline: true },
  { path: '/financeiro', icon: 'fa-coins', titleKey: 'finance.title' },
  { path: '/integrantes', icon: 'fa-users', titleKey: 'members.title' },
  { path: '/registros', icon: 'fa-clock-rotate-left', titleKey: 'logs.title' },
]

const otherSections = computed(() => sections.filter((s) => s.path !== route.path))

// On the Início itself the logo is the button that changes it
const homeLink = computed(() => !props.logoEditable && route.path !== '/dashboard')

// On a phone only the logo and the name stay in the header; the buttons go into a menu
const PHONE_QUERY = '(max-width: 600px)'
const phoneMedia = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(PHONE_QUERY) : null
const isPhone = ref(Boolean(phoneMedia?.matches))
const menuOpen = ref(false)

function onMediaChange(event) {
  isPhone.value = event.matches
  if (!event.matches) menuOpen.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape') menuOpen.value = false
}

onMounted(() => {
  phoneMedia?.addEventListener?.('change', onMediaChange)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  phoneMedia?.removeEventListener?.('change', onMediaChange)
  document.removeEventListener('keydown', onKeydown)
})

// Going anywhere closes it
watch(() => route.fullPath, () => {
  menuOpen.value = false
})

// Opens the manual on the part about this screen; it's bundled, so it works offline too
const help = computed(() => helpPath(route.name))

const unavailableOffline = computed(() => connectionLost.value || sessionExpired.value)

// Leaving deletes the download, and without a connection it can't be fetched again
function confirmLogoutMessage() {
  return unavailableOffline.value && copyInfo.value ? t('offline.confirmLogout') : t('app.confirmLogout')
}

async function handleLogout() {
  menuOpen.value = false
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
        <!-- The logo and the title go back to the Início, except on it, where the logo changes it -->
        <component
          :is="homeLink ? 'router-link' : 'span'"
          :to="homeLink ? '/dashboard' : undefined"
          :title="homeLink ? $t('home.title') : undefined"
          class="header-home"
        >
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
          <span class="header-title">{{ title }}</span>
        </component>
      </h1>
      <div v-if="!isPhone" class="header-controls">
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
        <!-- Theme, language, one's own details and the downloaded data. Like the sections, not on
             its own page, where every section's icon already shows -->
        <router-link
          v-if="route.name !== 'Settings'"
          to="/configuracoes"
          class="btn-settings"
          :title="$t('settings.open')"
          :aria-label="$t('settings.open')"
        >
          <i class="fa-solid fa-gear"></i>
        </router-link>
        <router-link v-if="member" to="/configuracoes" class="user-info" :title="$t('settings.open')">
          <span class="user-name">{{ member.name }}</span>
          <span v-if="member.superAdmin" class="super-admin-badge">{{ $t('app.superAdmin') }}</span>
        </router-link>
        <button @click="handleLogout" class="btn-logout" :title="$t('app.logout')">
          <i class="fa-solid fa-right-from-bracket"></i>
        </button>
      </div>
      <button
        v-else
        type="button"
        class="menu-toggle"
        :aria-expanded="menuOpen"
        aria-controls="header-menu"
        :aria-label="$t('app.menu')"
        :title="$t('app.menu')"
        @click="menuOpen = !menuOpen"
      >
        <i class="fa-solid" :class="menuOpen ? 'fa-xmark' : 'fa-bars'"></i>
      </button>
    </div>

    <template v-if="isPhone && menuOpen">
      <div class="menu-backdrop" @click="menuOpen = false"></div>
      <nav id="header-menu" class="header-menu" :aria-label="$t('app.menu')">
        <router-link v-if="member" to="/configuracoes" class="menu-user">
          <i class="fa-solid fa-circle-user"></i>
          <span class="menu-user-name">{{ member.name }}</span>
          <span v-if="member.superAdmin" class="super-admin-badge">{{ $t('app.superAdmin') }}</span>
        </router-link>
        <router-link
          v-for="section in sections"
          :key="section.path"
          :to="section.path"
          class="menu-item"
          :class="{
            'is-current': section.path === route.path,
            'is-unavailable': unavailableOffline && !section.offline,
          }"
          :aria-current="section.path === route.path ? 'page' : undefined"
        >
          <i class="fa-solid" :class="section.icon"></i> {{ $t(section.titleKey) }}
        </router-link>
        <hr />
        <router-link :to="help" class="menu-item">
          <i class="fa-solid fa-circle-question"></i> {{ $t('manual.open') }}
        </router-link>
        <a v-if="member?.superAdmin" :href="adminUrl()" class="menu-item">
          <i class="fa-solid fa-user-shield"></i> {{ $t('admin.openPanel') }}
        </a>
        <router-link
          to="/configuracoes"
          class="menu-item"
          :class="{ 'is-current': route.name === 'Settings' }"
          :aria-current="route.name === 'Settings' ? 'page' : undefined"
        >
          <i class="fa-solid fa-gear"></i> {{ $t('settings.open') }}
        </router-link>
        <!-- What the screen adds to the header, like the Financeiro's print button -->
        <div v-if="$slots.default" class="menu-extra" @click="menuOpen = false"><slot /></div>
        <hr />
        <button type="button" class="menu-item menu-logout" @click="handleLogout">
          <i class="fa-solid fa-right-from-bracket"></i> {{ $t('app.logout') }}
        </button>
      </nav>
    </template>
  </header>
</template>

<style scoped>
/* The title gives way, with an ellipsis, when the icons need the room */
.header-top h1 {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
}
.header-home {
  display: flex;
  align-items: center;
  /* The space the text had after the logo before this was a flex row */
  column-gap: 0.25em;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}
a.header-home:hover .header-title {
  color: var(--accent);
}
.header-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* On a phone a long name gets two lines before the ellipsis */
@media (max-width: 600px) {
  .header-top h1 {
    justify-content: flex-start;
  }
  .header-title {
    text-align: left;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    white-space: normal;
    line-height: 1.15;
    hyphens: auto;
    overflow-wrap: anywhere;
  }
}
.header-logo {
  flex-shrink: 0;
}
.header-controls {
  flex-shrink: 0;
}
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
.btn-settings {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  font-size: 16px;
  color: var(--text-light);
  text-decoration: none;
  transition: all 0.2s;
}
.btn-settings:hover {
  color: var(--accent);
  transform: scale(1.1);
}
.user-info {
  color: inherit;
  text-decoration: none;
}
.user-info:hover .user-name {
  color: var(--accent);
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
.header {
  position: relative;
}
.menu-toggle {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-white);
  color: var(--accent);
  font-size: 1.2rem;
  cursor: pointer;
}
.menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 900;
  background: rgba(0, 0, 0, 0.25);
}
.header-menu {
  position: absolute;
  top: calc(100% - 4px);
  right: 0;
  z-index: 901;
  display: flex;
  flex-direction: column;
  width: min(300px, 100%);
  max-height: calc(100vh - 100px);
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-white);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
  text-align: left;
}
.header-menu hr {
  width: 100%;
  margin: 4px 0;
  border: none;
  border-top: 1px solid var(--border);
}
.menu-user,
.menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 12px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}
.menu-item i,
.menu-user i {
  width: 20px;
  text-align: center;
  color: var(--accent);
}
.menu-item:hover,
.menu-user:hover {
  background: var(--accent-light);
}
.menu-item.is-current {
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 600;
}
.menu-item.is-unavailable {
  opacity: 0.4;
}
.menu-user {
  font-weight: 600;
}
.menu-user-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.menu-logout,
.menu-logout i {
  color: var(--error);
}
/* A screen's own header buttons become menu items, with the label they keep hidden in the header
   (class header-action-label) */
.menu-extra {
  display: flex;
  flex-direction: column;
}
.menu-extra :deep(button) {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 11px 12px;
  border: none;
  border-radius: 8px;
  background: none;
  color: var(--text-h);
  font: inherit;
  font-size: 1rem;
  text-align: left;
  cursor: pointer;
}
.menu-extra :deep(button i) {
  width: 20px;
  text-align: center;
  color: var(--accent);
}
.menu-extra :deep(button:hover) {
  background: var(--accent-light);
}
.header-controls :deep(.header-action-label) {
  display: none;
}
</style>
