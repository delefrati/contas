import { describe, it, expect } from 'vitest'
import { eventTime, groupByMonth, listEvents, matchesSearch } from './events'

describe('eventTime', () => {
  it('should show the start and end of an event', () => {
    expect(eventTime({ time: '21:00', endTime: '23:30' })).toBe('21:00–23:30')
  })

  it('should show only the start when there is no end', () => {
    expect(eventTime({ time: '21:00', endTime: '' })).toBe('21:00')
    expect(eventTime({ time: '21:00' })).toBe('21:00')
  })

  it('should be empty for events without a time', () => {
    expect(eventTime({ time: '', endTime: '' })).toBe('')
    expect(eventTime(null)).toBe('')
  })
})

const show = { id: 1, name: 'Show' }
const rehearsal = { id: 2, name: 'Ensaio' }
const events = [
  { id: 1, type: show, title: 'Festa de São João', date: '2026-06-24', location: 'Praça' },
  { id: 2, type: rehearsal, title: '', date: '2026-11-04', location: null },
  { id: 3, type: show, title: 'Bar do Zé', date: '2026-11-12', location: 'Centro' },
  { id: 4, type: show, title: 'Mercadão', date: '2026-11-20', location: 'Vila Domitila' },
  { id: 5, type: show, title: 'Réveillon', date: '2026-12-31', location: 'Centro' },
]
const today = '2026-11-12'
const ids = (list) => list.map((event) => event.id)

describe('matchesSearch', () => {
  it('should find the name, the type and the place, ignoring case and accents', () => {
    expect(matchesSearch(events[0], 'sao joao')).toBe(true)
    expect(matchesSearch(events[1], 'ENSAIO')).toBe(true)
    expect(matchesSearch(events[3], 'domitila')).toBe(true)
    expect(matchesSearch(events[3], 'centro')).toBe(false)
  })

  it('should need every word typed, in any order', () => {
    expect(matchesSearch(events[2], 'centro show')).toBe(true)
    expect(matchesSearch(events[2], 'centro ensaio')).toBe(false)
  })

  it('should keep everything for an empty search', () => {
    expect(matchesSearch(events[1], '  ')).toBe(true)
  })
})

describe('listEvents', () => {
  it('should list the next events soonest first, today included', () => {
    expect(listEvents(events, { period: 'upcoming', today })).toEqual({
      upcoming: [events[2], events[3], events[4]],
      past: [],
    })
  })

  it('should list the past events latest first', () => {
    const { upcoming, past } = listEvents(events, { period: 'past', today })
    expect(upcoming).toEqual([])
    expect(ids(past)).toEqual([2, 1])
  })

  it('should list both for all', () => {
    const { upcoming, past } = listEvents(events, { period: 'all', today })
    expect(ids(upcoming)).toEqual([3, 4, 5])
    expect(ids(past)).toEqual([2, 1])
  })

  it('should keep only the events found', () => {
    const { upcoming, past } = listEvents(events, { period: 'all', search: 'centro', today })
    expect(ids(upcoming)).toEqual([3, 5])
    expect(past).toEqual([])
  })

  it('should not reorder the events it was given', () => {
    const copy = [...events]
    listEvents(events, { period: 'all', today })
    expect(events).toEqual(copy)
  })
})

describe('groupByMonth', () => {
  it('should group consecutive events of the same month', () => {
    expect(groupByMonth([events[4], events[3], events[2], events[0]]).map((g) => [g.month, ids(g.events)])).toEqual([
      ['2026-12', [5]],
      ['2026-11', [4, 3]],
      ['2026-06', [1]],
    ])
  })

  it('should be empty without events', () => {
    expect(groupByMonth([])).toEqual([])
  })
})
