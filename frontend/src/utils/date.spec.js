import { describe, it, expect } from 'vitest'
import { formatDate, monthGrid, parseDate, todayISO } from './date'

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

  it('should cover a month with whole weeks starting on Sunday', () => {
    // October 2026 starts on a Thursday and ends on a Saturday
    const weeks = monthGrid(2026, 9)
    expect(weeks).toHaveLength(5)
    expect(weeks[0][0]).toBe('2026-09-27')
    expect(weeks[0][4]).toBe('2026-10-01')
    expect(weeks[4][6]).toBe('2026-10-31')
  })

  it('should add a trailing week when the month ends mid-week', () => {
    // November 2026 starts on a Sunday and ends on a Monday
    const weeks = monthGrid(2026, 10)
    expect(weeks[0][0]).toBe('2026-11-01')
    expect(weeks).toHaveLength(5)
    expect(weeks[4][6]).toBe('2026-12-05')
  })
})
