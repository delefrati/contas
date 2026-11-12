<script setup>
import { useI18n } from 'vue-i18n'
import { localeTag, parseDate } from '../utils/date'
import { eventName, eventTime, typeStyle } from '../utils/events'

defineProps({
  event: { type: Object, required: true },
  // Faded, for the days already gone in a month
  past: { type: Boolean, default: false },
})

const { locale } = useI18n()

function formatWeekday(date) {
  return parseDate(date).toLocaleDateString(localeTag(locale.value), { weekday: 'short' })
}
</script>

<template>
  <router-link :to="`/agenda/${event.id}`" class="event-row" :class="{ 'is-past': past }">
    <span class="event-date">
      <span class="event-date-day">{{ Number(event.date.slice(8)) }}</span>
      <span class="event-date-weekday">{{ formatWeekday(event.date) }}</span>
    </span>
    <span class="event-info">
      <span class="event-name">
        <span class="type-tag" :style="typeStyle(event.type)">{{ event.type.name }}</span>
        {{ eventName(event) }}
      </span>
      <span class="event-meta">
        <span v-if="event.time"><i class="fa-regular fa-clock"></i> {{ eventTime(event) }}</span>
        <span v-if="event.location"><i class="fa-solid fa-location-dot"></i> {{ event.location }}</span>
        <span><i class="fa-solid fa-list-ol"></i> {{ $t('agenda.songCount', event.songCount) }}</span>
      </span>
    </span>
    <i class="fa-solid fa-chevron-right event-arrow"></i>
  </router-link>
</template>

<style scoped>
.event-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--border);
  color: var(--text);
  text-decoration: none;
}
.event-row:hover {
  background: var(--accent-light);
}
.event-row.is-past {
  opacity: 0.6;
}
.event-date {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 44px;
}
.event-date-day {
  font-size: 1.4rem;
  font-weight: 700;
  line-height: 1;
  color: var(--text-h);
}
.event-date-weekday {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--text-light);
}
.event-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  text-align: left;
}
.event-name {
  font-weight: 600;
  color: var(--text-h);
  overflow-wrap: anywhere;
}
.event-name .type-tag {
  margin-right: 6px;
}
.event-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 14px;
  font-size: 0.85rem;
  color: var(--text-light);
}
.event-arrow {
  color: var(--text-light);
}
</style>
