// The setlist split at its pauses, songs numbered across blocks like the printed list.
// A pause with no songs after it (two in a row, or one at the end) doesn't start a block.
export function setlistBlocks(setlist) {
  const blocks = []
  let block = { pause: null, songs: [] }
  let number = 0

  for (const item of setlist) {
    if (item.type === 'pause') {
      if (block.songs.length > 0) blocks.push(block)
      block = { pause: item, songs: [] }
    } else {
      block.songs.push({ ...item, number: ++number })
    }
  }
  if (block.songs.length > 0) blocks.push(block)

  return blocks
}
