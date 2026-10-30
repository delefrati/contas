import { describe, it, expect } from 'vitest'
import { setlistBlocks } from './setlist'

const song = (id) => ({ id, type: 'song', title: `Song ${id}` })
const pause = (id, label = '') => ({ id, type: 'pause', label })

describe('setlistBlocks', () => {
  it('should split the setlist at its pauses and keep numbering across blocks', () => {
    const blocks = setlistBlocks([song(1), song(2), pause(3, 'BIS'), song(4)])
    expect(blocks).toHaveLength(2)
    expect(blocks[0].pause).toBeNull()
    expect(blocks[0].songs.map((s) => s.number)).toEqual([1, 2])
    expect(blocks[1].pause.label).toBe('BIS')
    expect(blocks[1].songs.map((s) => [s.id, s.number])).toEqual([[4, 3]])
  })

  it('should not make blocks out of pauses without songs after them', () => {
    const blocks = setlistBlocks([pause(1), song(2), pause(3), pause(4, 'BIS'), song(5), pause(6)])
    expect(blocks.map((b) => [b.pause?.id, b.songs.map((s) => s.id)])).toEqual([
      [1, [2]],
      [4, [5]],
    ])
  })

  it('should have no blocks for an empty setlist', () => {
    expect(setlistBlocks([])).toEqual([])
    expect(setlistBlocks([pause(1)])).toEqual([])
  })
})
