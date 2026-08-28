/**
 * The currency-by-instance grid: how many active lines each pair carries.
 *
 * The design draws this as a heat map. The figures behind it are counted from
 * the same lines the map draws, so the grid and the map can never disagree,
 * which they would if one came from aggregates and the other from live events.
 */
import type { Line } from './live-lines'

export type Grid = {
  readonly rows: readonly string[]
  readonly columns: readonly string[]
  /** `counts[row][column]`, zero where a pair has no active line. */
  readonly counts: readonly (readonly number[])[]
  /** The largest count, for scaling the heat. Zero when the grid is empty. */
  readonly peak: number
}

/** Neither a pubkey nor a currency code can contain a space. */
const SEPARATOR = ' '

export function buildGrid(
  lines: readonly Line[],
  rows: readonly string[],
  columns: readonly string[],
): Grid {
  const index = new Map<string, number>()
  for (const line of lines) {
    const key = line.instancePubkey + SEPARATOR + line.fiat
    index.set(key, (index.get(key) ?? 0) + 1)
  }

  const counts = rows.map((row) =>
    columns.map((column) => index.get(row + SEPARATOR + column) ?? 0),
  )
  const peak = counts.reduce((max, row) => row.reduce((m, v) => Math.max(m, v), max), 0)

  return { rows, columns, counts, peak }
}

/** Heat level 0 to 4 for a count, scaled against the grid's own peak. */
export function heatLevel(count: number, peak: number): number {
  if (count === 0 || peak === 0) return 0
  return Math.max(1, Math.min(4, Math.ceil((count / peak) * 4)))
}
