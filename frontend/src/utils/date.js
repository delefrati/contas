const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function localeTag(locale) {
  return locale === 'pt' ? 'pt-BR' : locale
}

// Plain YYYY-MM-DD dates would be parsed as UTC midnight and show up a day early
// west of Greenwich, so they are read as local dates instead.
export function parseDate(value) {
  return DATE_ONLY.test(value) ? new Date(`${value}T00:00:00`) : new Date(value)
}

export function formatDate(value, locale, empty = '-') {
  if (!value) return empty
  const date = parseDate(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(localeTag(locale), { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// Today's date as YYYY-MM-DD in the local time zone
export function todayISO(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}
