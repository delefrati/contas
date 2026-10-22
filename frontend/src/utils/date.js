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

// A date as YYYY-MM-DD in the local time zone
export function isoDate(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Today's date as YYYY-MM-DD in the local time zone
export function todayISO(now = new Date()) {
  return isoDate(now)
}

// Whole weeks (Sunday first) covering a month, as rows of YYYY-MM-DD dates.
// `month` is zero-based, as in Date.
export function monthGrid(year, month) {
  const first = new Date(year, month, 1)
  const start = new Date(year, month, 1 - first.getDay())
  const weeks = []
  const day = new Date(start)
  do {
    const week = []
    for (let i = 0; i < 7; i++) {
      week.push(isoDate(day))
      day.setDate(day.getDate() + 1)
    }
    weeks.push(week)
  } while (day.getMonth() === month)
  return weeks
}
