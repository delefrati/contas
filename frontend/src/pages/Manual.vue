<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '../composables/useAuth'
import { useAdmin } from '../composables/useAdmin'
import { visibleParts } from '../manual'

const { locale } = useI18n()
const route = useRoute()
const router = useRouter()
const { member } = useAuth()
const { admin } = useAdmin()

// Signed in to a band as a super admin, or to the admin panel on the central host
const isSuperAdmin = computed(() => Boolean(member.value?.superAdmin || admin.value))
const parts = computed(() => visibleParts(isSuperAdmin.value))
const index = computed(() => parts.value.findIndex((p) => p.slug === route.params.part))
const part = computed(() => parts.value[index.value] ?? null)
const previous = computed(() => (index.value > 0 ? parts.value[index.value - 1] : null))
const next = computed(() => (index.value >= 0 ? parts.value[index.value + 1] ?? null : null))

// An unknown part, or one this reader can't see, goes to the index
watch(
  () => route.params.part,
  (slug) => {
    if (slug && !part.value) router.replace({ name: 'Manual' })
    window.scrollTo?.(0, 0)
  },
  { immediate: true },
)

function goBack() {
  if (window.history.state?.back) router.back()
  else router.push('/')
}

// Links between parts stay in the app instead of reloading it
function followLink(event) {
  const link = event.target.closest?.('a')
  const href = link?.getAttribute('href')
  if (!href || !/^\/(?![/\\])/.test(href)) return
  event.preventDefault()
  router.push(href)
}
</script>

<template>
  <div class="container manual">
    <header class="header">
      <div class="header-top">
        <h1><i class="fa-solid fa-circle-question"></i> {{ $t('manual.title') }}</h1>
        <div class="header-controls">
          <button type="button" class="btn-secondary" @click="goBack">
            <i class="fa-solid fa-arrow-left"></i> {{ $t('manual.back') }}
          </button>
        </div>
      </div>
    </header>

    <p v-if="locale !== 'pt'" class="manual-note">
      <i class="fa-solid fa-language"></i> {{ $t('manual.onlyPortuguese') }}
    </p>

    <div class="content">
      <section v-if="part" class="expenses-section manual-part">
        <!-- Bundled with the app from src/manual, never from user input -->
        <article class="manual-text" v-html="part.html" @click="followLink"></article>

        <nav class="manual-pager">
          <router-link v-if="previous" :to="`/ajuda/${previous.slug}`" class="manual-pager-link">
            <i class="fa-solid fa-chevron-left"></i> {{ previous.title }}
          </router-link>
          <router-link to="/ajuda" class="manual-pager-link manual-pager-index">
            <i class="fa-solid fa-list"></i> {{ $t('manual.index') }}
          </router-link>
          <router-link v-if="next" :to="`/ajuda/${next.slug}`" class="manual-pager-link manual-pager-next">
            {{ next.title }} <i class="fa-solid fa-chevron-right"></i>
          </router-link>
        </nav>
      </section>

      <section v-else class="expenses-section">
        <p class="manual-intro">{{ $t('manual.intro') }}</p>
        <ol class="manual-index">
          <li v-for="item in parts" :key="item.slug">
            <router-link :to="`/ajuda/${item.slug}`">{{ item.title }}</router-link>
          </li>
        </ol>
      </section>
    </div>
  </div>
</template>

<style scoped>
.manual .content {
  text-align: left;
}
.manual-note {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--accent-light);
  color: var(--accent);
  font-size: 0.9rem;
}
.manual-intro {
  margin: 0 0 12px;
  color: var(--text-light);
}
.manual-index {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding-left: 1.6em;
}
.manual-index a {
  display: inline-block;
  padding: 8px 0;
  color: var(--accent);
  font-size: 1.05rem;
  font-weight: 500;
  text-decoration: none;
}
.manual-index a:hover {
  text-decoration: underline;
}
.manual-text {
  max-width: 760px;
  line-height: 1.6;
}
.manual-text :deep(h1) {
  margin: 0 0 12px;
  color: var(--text-h);
  font-size: 1.6rem;
}
.manual-text :deep(h2) {
  margin: 28px 0 8px;
  color: var(--text-h);
  font-size: 1.2rem;
}
.manual-text :deep(h3) {
  margin: 20px 0 6px;
  color: var(--text-h);
  font-size: 1.05rem;
}
.manual-text :deep(p),
.manual-text :deep(ul),
.manual-text :deep(ol) {
  margin: 0 0 12px;
}
.manual-text :deep(li) {
  margin-bottom: 4px;
}
.manual-text :deep(a) {
  color: var(--accent);
}
.manual-text :deep(img) {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 8px 0 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.manual-text :deep(code) {
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--accent-light);
  font-size: 0.9em;
}
.manual-text :deep(blockquote) {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-left: 3px solid var(--accent);
  background: var(--accent-light);
  border-radius: 0 8px 8px 0;
}
.manual-text :deep(blockquote p) {
  margin: 0;
}
.manual-pager {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
  margin-top: 24px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.manual-pager-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 4px;
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}
.manual-pager-next {
  margin-left: auto;
}
@media (max-width: 600px) {
  .manual-pager {
    flex-direction: column;
  }
  .manual-pager-next {
    margin-left: 0;
  }
  .manual-pager-index {
    order: 3;
  }
}
</style>
