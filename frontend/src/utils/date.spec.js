import { describe, it, expect } from 'vitest'
import { formatDate, parseDate, todayISO } from './date'

describe('date utils', () => {
  it('should read plain dates as local dates', () => {
    const date = parseDate('2026-10-18')
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 9, 18])
  })

  it('should format plain dates without shifting the day', () => {
    expect(formatDate('2026-10-18', 'pt')).toBe('18/10/2026')
  })

  it('should format timestamps', () => {
    const local = new Date(2026, 9, 18, 12, 0, 0)
    expect(formatDate(local.toISOString(), 'pt')).toBe('18/10/2026')
  })

  it('should return the placeholder for empty values', () => {
    expect(formatDate('', 'pt')).toBe('-')
    expect(formatDate(null, 'pt', '—')).toBe('—')
  })

  it('should return invalid values unchanged', () => {
    expect(formatDate('not a date', 'pt')).toBe('not a date')
  })

  it('should give today in local time', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})
