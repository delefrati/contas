// Colors offered for event types; they read well on light and dark backgrounds
export const TYPE_COLORS = ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#d53f8c', '#38b2ac', '#805ad5', '#d69e2e']

// Events without a title are named after their type ("Show", "Ensaio")
export function eventName(event) {
  return event?.title || event?.type?.name || ''
}

// "21:00–23:30", "21:00" without an end, '' for events without a time
export function eventTime(event) {
  if (!event?.time) return ''
  return event.endTime ? `${event.time}–${event.endTime}` : event.time
}

// Exposes the type color to CSS as --type-color
export function typeStyle(type) {
  return { '--type-color': type?.color || TYPE_COLORS[0] }
}

// First palette color no type uses yet, so new types stand apart
export function nextTypeColor(types) {
  const used = new Set(types.map((type) => type.color))
  return TYPE_COLORS.find((color) => !used.has(color)) || TYPE_COLORS[types.length % TYPE_COLORS.length]
}

// Lowercase without accents, so "sao joao" finds "São João"
function searchable(text) {
  return (text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

// Every word typed has to appear in the name, the type or the place
export function matchesSearch(event, search) {
  const words = searchable(search).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = searchable([eventName(event), event?.type?.name, event?.location].join(' '))
  return words.every((word) => haystack.includes(word))
}

export const LIST_PERIODS = ['upcoming', 'past', 'all']

// The events for the list, split around today: the next ones soonest first, the past ones
// latest first. Events come from the API ordered by date and time.
export function listEvents(events, { period = 'upcoming', search = '', today }) {
  const found = events.filter((event) => matchesSearch(event, search))
  return {
    upcoming: period === 'past' ? [] : found.filter((event) => event.date >= today),
    past: period === 'upcoming' ? [] : found.filter((event) => event.date < today).reverse(),
  }
}

// Consecutive events of the same month, as [{ month: 'YYYY-MM', events }]
export function groupByMonth(events) {
  const groups = []
  for (const event of events) {
    const month = event.date.slice(0, 7)
    if (groups.at(-1)?.month !== month) groups.push({ month, events: [] })
    groups.at(-1).events.push(event)
  }
  return groups
}
