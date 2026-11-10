import { describe, it, expect } from 'vitest'
import { eventTime } from './events'

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
