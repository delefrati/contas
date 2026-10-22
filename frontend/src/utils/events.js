// Colors offered for event types; they read well on light and dark backgrounds
export const TYPE_COLORS = ['#667eea', '#48bb78', '#ed8936', '#e53e3e', '#d53f8c', '#38b2ac', '#805ad5', '#d69e2e']

// Events without a title are named after their type ("Show", "Ensaio")
export function eventName(event) {
  return event?.title || event?.type?.name || ''
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
