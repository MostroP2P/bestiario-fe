/**
 * Keeping labels off each other.
 *
 * The design spread eleven markets across the globe and nothing collided. The
 * real network is concentrated: most of its currencies and most of its
 * instances sit inside South America, and at this projection their labels land
 * on top of one another. An unreadable label is not a smaller problem than a
 * missing one.
 *
 * The rule is deliberately dumb and therefore predictable: labels are placed
 * top to bottom, and one that would overlap a label already placed is pushed
 * down until it does not. No label is dropped and none is moved sideways, so
 * a label stays next to the node it names.
 */

export type Label = {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly text: string
}

/** Martian Mono at 8.5px, measured across the codes and hostnames this draws. */
const CHAR_WIDTH = 5.9
const MIN_GAP = 10

function overlapsHorizontally(a: Label, b: Label): boolean {
  const aRight = a.x + a.text.length * CHAR_WIDTH
  const bRight = b.x + b.text.length * CHAR_WIDTH
  return a.x < bRight && b.x < aRight
}

/**
 * The same labels with their `y` adjusted so no two that share horizontal
 * space sit within `minGap` of each other. Order in, order out.
 */
export function layoutLabels(labels: readonly Label[], minGap: number = MIN_GAP): Label[] {
  const ordered = [...labels].sort((a, b) => a.y - b.y || a.key.localeCompare(b.key))
  const placed: Label[] = []

  for (const label of ordered) {
    let y = label.y
    // Re-checked from scratch after each nudge: pushing past one label can
    // land on the next.
    let moved = true
    while (moved) {
      moved = false
      for (const other of placed) {
        if (!overlapsHorizontally(label, other)) continue
        if (Math.abs(y - other.y) >= minGap) continue
        y = other.y + minGap
        moved = true
      }
    }
    placed.push({ ...label, y })
  }

  const byKey = new Map(placed.map((l) => [l.key, l]))
  return labels.map((l) => byKey.get(l.key) ?? l)
}
