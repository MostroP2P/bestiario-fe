/**
 * Which labels the map can carry.
 *
 * The design spread eleven markets across the globe and nothing collided. The
 * real network is concentrated: most of its currencies and most of its
 * instances sit inside South America, and at world scale their labels land on
 * top of one another and on top of the markers themselves.
 *
 * The map keeps the world, so the labels give way instead. A label is kept
 * only when it clears every label already kept and every marker but its own;
 * the rest are dropped from the map and carried by the legend beside it,
 * where they are all listed and none is guessed at. Callers pass labels in
 * priority order — busiest node first — so what survives on the map is what
 * carries the most flow.
 */

export type Label = {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly text: string
}

/** A node marker a label must not sit on. `key` matches the label it belongs to. */
export type Marker = {
  readonly key: string
  readonly x: number
  readonly y: number
  readonly r: number
}

type Box = { left: number; right: number; top: number; bottom: number }

/** Martian Mono at 8.5px, measured across the codes and hostnames this draws. */
const CHAR_WIDTH = 5.9
/** Breathing room, so two labels that merely touch do not read as one string. */
const PAD_X = 7
/** Half the cap height, plus a little: a label's vertical footprint. */
const PAD_Y = 5

function labelBox(label: Label): Box {
  return {
    left: label.x,
    right: label.x + label.text.length * CHAR_WIDTH + PAD_X,
    top: label.y - PAD_Y,
    bottom: label.y + PAD_Y,
  }
}

function markerBox(marker: Marker): Box {
  return {
    left: marker.x - marker.r,
    right: marker.x + marker.r,
    top: marker.y - marker.r,
    bottom: marker.y + marker.r,
  }
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

/**
 * The keys of the labels that can be drawn cleanly, taking `labels` in the
 * order given as the order of priority. A label never has to clear its own
 * marker: it is placed beside it on purpose.
 */
export function selectLabels(
  labels: readonly Label[],
  markers: readonly Marker[] = [],
): Set<string> {
  const kept: Box[] = []
  const keys = new Set<string>()

  for (const label of labels) {
    const box = labelBox(label)
    if (kept.some((other) => overlaps(box, other))) continue
    const hitsMarker = markers.some(
      (marker) => marker.key !== label.key && overlaps(box, markerBox(marker)),
    )
    if (hitsMarker) continue
    kept.push(box)
    keys.add(label.key)
  }

  return keys
}
