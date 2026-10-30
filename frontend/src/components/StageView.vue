<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useWakeLock } from '../composables/useWakeLock'
import { setlistBlocks } from '../utils/setlist'

// Full-screen setlist for reading on a phone during a show: one block (songs up to a
// pause) at a time in big letters, with a peek at the next one. Tapping the name of a
// song with lyrics shows them, and from there the same moves go song by song.
const props = defineProps({
  setlist: { type: Array, required: true },
  showArtists: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const THEME_KEY = 'stage_view_theme'

function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === 'dark' || saved === 'light') return saved
  } catch {
    // Fall back to the system preference
  }
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

const theme = ref(readTheme())

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  try {
    localStorage.setItem(THEME_KEY, theme.value)
  } catch {
    // Not persisting the preference is fine
  }
}

const blocks = computed(() => setlistBlocks(props.setlist))
const index = ref(0)
const showingAll = ref(false)
const content = ref(null)

// The current block and the next, or every block in the overview
const shownBlocks = computed(() => {
  const all = blocks.value.map((block, i) => ({ block, i }))
  return showingAll.value ? all : all.slice(index.value, index.value + 2)
})

const isLast = computed(() => index.value === blocks.value.length - 1)

// Every song in order, each knowing its block. Songs are numbered from 1, so a
// song's number is also its place here.
const songs = computed(() => blocks.value.flatMap((block, i) => block.songs.map((song) => ({ ...song, block: i }))))

// Number of the song whose lyrics are open, if any
const lyricsNumber = ref(null)
const lyricsSong = computed(() => (lyricsNumber.value === null ? null : songs.value[lyricsNumber.value - 1]))

// Songs removed elsewhere while the view is open
watch(() => blocks.value.length, (length) => {
  if (index.value >= length) index.value = Math.max(length - 1, 0)
})
watch(() => songs.value.length, (length) => {
  if (lyricsNumber.value > length) lyricsNumber.value = null
})

function scrollToTop() {
  nextTick(() => {
    if (content.value) content.value.scrollTop = 0
  })
}

function goTo(i) {
  if (i < 0 || i >= blocks.value.length) return
  index.value = i
  showingAll.value = false
  scrollToTop()
}

function openLyrics(number) {
  if (number < 1 || number > songs.value.length) return
  lyricsNumber.value = number
  scrollToTop()
}

// Back to the block of the song last shown, which may have moved on from where it was opened
function closeLyrics() {
  const song = lyricsSong.value
  lyricsNumber.value = null
  if (song) goTo(song.block)
}

function next() {
  if (lyricsSong.value) openLyrics(lyricsNumber.value + 1)
  else goTo(index.value + 1)
}

function previous() {
  if (lyricsSong.value) openLyrics(lyricsNumber.value - 1)
  else goTo(index.value - 1)
}

const hasPrevious = computed(() => (lyricsSong.value ? lyricsNumber.value > 1 : index.value > 0))
const hasNext = computed(() =>
  lyricsSong.value ? lyricsNumber.value < songs.value.length : index.value < blocks.value.length - 1,
)

function onFooterClick() {
  if (lyricsSong.value) closeLyrics()
  else toggleAll()
}

function toggleAll() {
  showingAll.value = !showingAll.value
  if (!showingAll.value) {
    scrollToTop()
    return
  }
  nextTick(() => {
    content.value?.querySelector('.is-current')?.scrollIntoView?.({ block: 'start' })
  })
}

function onContentClick(e) {
  if (Date.now() - swipedAt < TAP_AFTER_SWIPE_MS) return
  if (showingAll.value) {
    const block = e.target.closest?.('[data-block]')
    if (block) goTo(Number(block.dataset.block))
    return
  }
  const title = !lyricsSong.value && e.target.closest?.('[data-lyrics]')
  if (title) {
    openLyrics(Number(title.dataset.lyrics))
    return
  }
  if (e.clientX < window.innerWidth / 2) previous()
  else next()
}

// Swiping turns blocks like pages: right to left goes forward. Only moves more sideways
// than up or down count, so scrolling through a long block doesn't turn it; a thumb
// swipe arcs, so anything flatter than 45° is sideways enough.
const SWIPE_MIN_DISTANCE = 40
// Some browsers still send a tap where the swipe ended, which would turn back
const TAP_AFTER_SWIPE_MS = 500
let touchStart = null
let swipedAt = 0

function onTouchStart(e) {
  const touch = e.touches[0]
  touchStart = e.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : null
}

function onTouchEnd(e) {
  const start = touchStart
  touchStart = null
  if (!start || showingAll.value) return
  const touch = e.changedTouches[0]
  const dx = touch.clientX - start.x
  const dy = touch.clientY - start.y
  if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) <= Math.abs(dy)) return
  if (e.cancelable) e.preventDefault()
  swipedAt = Date.now()
  if (dx < 0) next()
  else previous()
}

function onTouchCancel() {
  touchStart = null
}

// Arrows and page keys, which is also what Bluetooth page-turner pedals send
function onKeydown(e) {
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
    e.preventDefault()
    next()
  } else if (['ArrowLeft', 'PageUp'].includes(e.key)) {
    e.preventDefault()
    previous()
  } else if (e.key === 'Escape') {
    if (lyricsSong.value) closeLyrics()
    else if (showingAll.value) toggleAll()
    else emit('close')
  }
}

const wakeLock = useWakeLock()
let previousOverflow = ''

onMounted(() => {
  wakeLock.start()
  window.addEventListener('keydown', onKeydown)
  // The page behind would otherwise scroll along on phones
  previousOverflow = document.documentElement.style.overflow
  document.documentElement.style.overflow = 'hidden'
})

onBeforeUnmount(() => {
  wakeLock.stop()
  window.removeEventListener('keydown', onKeydown)
  document.documentElement.style.overflow = previousOverflow
})
</script>

<template>
  <div class="stage" :class="`is-${theme}`" role="dialog" aria-modal="true" :aria-label="$t('repertoires.stageView')">
    <header class="stage-toolbar">
      <button type="button" class="stage-btn stage-exit" @click="emit('close')">
        <i class="fa-solid fa-xmark"></i> {{ $t('repertoires.stageExit') }}
      </button>
      <!-- More tools will join this group -->
      <div class="stage-tools">
        <button
          type="button"
          class="stage-btn stage-theme"
          :title="theme === 'dark' ? $t('repertoires.stageLightMode') : $t('repertoires.stageDarkMode')"
          :aria-label="theme === 'dark' ? $t('repertoires.stageLightMode') : $t('repertoires.stageDarkMode')"
          @click="toggleTheme"
        >
          <i :class="theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon'"></i>
        </button>
      </div>
    </header>

    <main
      ref="content"
      class="stage-content"
      :class="{ 'is-overview': showingAll }"
      @click="onContentClick"
      @touchstart.passive="onTouchStart"
      @touchend="onTouchEnd"
      @touchcancel="onTouchCancel"
    >
      <article v-if="lyricsSong" class="stage-lyrics">
        <h2 class="stage-song">
          <span class="stage-number">{{ lyricsSong.number }}</span>
          <span class="stage-title">
            {{ lyricsSong.title }}
            <small v-if="showArtists && lyricsSong.artist" class="stage-artist">{{ lyricsSong.artist }}</small>
          </span>
        </h2>
        <div v-if="lyricsSong.lyrics" class="stage-lyrics-text">
          <p v-for="(line, n) in lyricsSong.lyrics.split('\n')" :key="n" class="stage-lyrics-line">{{ line }}</p>
        </div>
        <p v-else class="stage-empty">{{ $t('repertoires.stageNoLyrics') }}</p>
      </article>
      <template v-else>
        <section
          v-for="{ block, i } in shownBlocks"
          :key="i"
          class="stage-block"
          :class="{ 'is-current': i === index, 'is-upcoming': !showingAll && i > index }"
          :data-block="i"
        >
          <p v-if="block.pause" class="stage-pause">
            <span>{{ block.pause.label || $t('repertoires.pause') }}</span>
          </p>
          <ol class="stage-songs">
            <li v-for="song in block.songs" :key="song.id" class="stage-song">
              <span class="stage-number">{{ song.number }}</span>
              <span
                class="stage-title"
                :data-lyrics="song.lyrics ? song.number : null"
              >
                {{ song.title }}
                <i
                  v-if="song.lyrics"
                  class="fa-solid fa-align-left stage-lyrics-mark"
                  :title="$t('repertoires.stageLyricsHint')"
                  :aria-label="$t('repertoires.stageLyricsHint')"
                ></i>
                <small v-if="showArtists && song.artist" class="stage-artist">{{ song.artist }}</small>
              </span>
            </li>
          </ol>
        </section>
        <p v-if="!showingAll && isLast" class="stage-end">{{ $t('repertoires.stageEnd') }}</p>
        <p v-if="blocks.length === 0" class="stage-empty">{{ $t('repertoires.noSongs') }}</p>
      </template>
    </main>

    <template v-if="!showingAll">
      <span v-if="hasPrevious" class="stage-hint stage-hint-left"><i class="fa-solid fa-chevron-left"></i></span>
      <span v-if="hasNext" class="stage-hint stage-hint-right"><i class="fa-solid fa-chevron-right"></i></span>
    </template>

    <button v-if="lyricsSong" type="button" class="stage-footer" @click="onFooterClick">
      <span class="stage-position">
        {{ $t('repertoires.stageSong', { current: lyricsNumber, total: songs.length }) }}
      </span>
      <span class="stage-footer-action stage-close-lyrics">
        <i class="fa-solid fa-xmark"></i> {{ $t('repertoires.stageCloseLyrics') }}
      </span>
    </button>
    <button v-else type="button" class="stage-footer" @click="onFooterClick">
      <span v-if="blocks.length > 0" class="stage-position">
        {{ $t('repertoires.stageBlock', { current: index + 1, total: blocks.length }) }}
      </span>
      <span class="stage-footer-action">
        <i :class="showingAll ? 'fa-solid fa-arrow-left' : 'fa-solid fa-list-ol'"></i>
        {{ showingAll ? $t('repertoires.stageBackToBlock') : $t('repertoires.stageShowAll') }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.stage {
  --stage-bg: #000;
  --stage-fg: #fff;
  --stage-muted: rgba(255, 255, 255, 0.4);
  --stage-line: rgba(255, 255, 255, 0.2);
  --stage-highlight: rgba(255, 255, 255, 0.08);
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  background: var(--stage-bg);
  color: var(--stage-fg);
  text-align: left;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
}
.stage.is-light {
  --stage-bg: #fff;
  --stage-fg: #000;
  --stage-muted: rgba(0, 0, 0, 0.4);
  --stage-line: rgba(0, 0, 0, 0.2);
  --stage-highlight: rgba(0, 0, 0, 0.06);
}
.stage-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: calc(8px + env(safe-area-inset-top)) 12px 8px;
  border-bottom: 1px solid var(--stage-line);
}
.stage-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}
.stage-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  min-width: 44px;
  justify-content: center;
  padding: 8px 14px;
  border: 1px solid var(--stage-line);
  border-radius: 10px;
  background: transparent;
  color: var(--stage-fg);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}
.stage-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px 24px;
  font-size: clamp(1.75rem, min(9vw, 8vh), 4rem);
  line-height: 1.2;
  cursor: pointer;
  /* Sideways moves are swipes, not page pans */
  touch-action: pan-y;
}
.stage-content.is-overview {
  font-size: clamp(1.15rem, min(5vw, 5vh), 2rem);
}
.stage-block.is-upcoming {
  color: var(--stage-muted);
}
.is-overview .stage-block {
  padding: 4px 10px;
  border-radius: 10px;
}
.is-overview .stage-block.is-current {
  background: var(--stage-highlight);
}
.stage-pause {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0.5em 0 0.3em;
  color: var(--stage-muted);
  font-size: 0.55em;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.stage-pause::before,
.stage-pause::after {
  content: '';
  flex: 1;
  border-top: 2px dashed var(--stage-line);
}
.stage-songs {
  list-style: none;
  margin: 0;
  padding: 0;
}
.stage-song {
  display: flex;
  align-items: baseline;
  gap: 0.4em;
  padding: 0.15em 0;
}
.stage-number {
  min-width: 1.6em;
  text-align: right;
  font-size: 0.55em;
  font-weight: 700;
  color: var(--stage-muted);
}
.stage-title {
  font-weight: 700;
  overflow-wrap: anywhere;
}
.stage-artist {
  display: block;
  font-size: 0.5em;
  font-weight: 400;
  color: var(--stage-muted);
}
.stage-lyrics-mark {
  margin-left: 0.3em;
  font-size: 0.45em;
  vertical-align: middle;
  color: var(--stage-muted);
}
.stage-lyrics .stage-song {
  margin: 0 0 0.6em;
  color: inherit;
  font-size: 1em;
  line-height: 1.2;
}
.stage-lyrics-text {
  font-size: clamp(1.2rem, min(6vw, 5vh), 2.5rem);
  line-height: 1.35;
}
/* A verse too long for the screen goes on indented, so it doesn't read as a new one */
.stage-lyrics-line {
  min-height: 1em;
  margin: 0 0 0.15em;
  padding-left: 1em;
  text-indent: -1em;
  overflow-wrap: anywhere;
}
.stage-end,
.stage-empty {
  margin: 1em 0 0;
  text-align: center;
  font-size: 0.55em;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--stage-muted);
}
.stage-hint {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  font-size: 1.5rem;
  color: var(--stage-muted);
  opacity: 0.5;
  pointer-events: none;
}
.stage-hint-left {
  left: 4px;
}
.stage-hint-right {
  right: 4px;
}
.stage-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 15vh;
  padding: 12px 20px calc(12px + env(safe-area-inset-bottom));
  border: none;
  border-top: 1px solid var(--stage-line);
  background: var(--stage-highlight);
  color: var(--stage-fg);
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}
.stage-position {
  color: var(--stage-muted);
}
.stage-footer-action {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
