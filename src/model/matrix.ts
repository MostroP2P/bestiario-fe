/**
 * The currency-by-instance cross of artboard 2a: which Mostro traded which
 * currency, and how many orders it created there.
 *
 * `instances:<window>` names the instances and `orders:<window>:i:<pubkey>`
 * breaks one instance's orders down by currency. Neither document carries the
 * cross on its own; putting them side by side is what makes it, and it is the
 * same pair of documents the map is drawn from, so the grid and the map can
 * never disagree.
 *
 * Two absences are kept as absences rather than turned into zeros. An
 * instance that published no scoped document has no row at all — a row of
 * zeros would say it traded nothing, which is a claim nobody published. A
 * pair with no currency block has an empty cell: the publisher writes no
 * block for a currency an instance did not trade in the window.
 */
import type { CurrencyOrders, InstanceRow } from './instances'

/** One instance's breakdown, as the view reads it from its scoped document. */
export type Trade = {
  readonly pubkey: string
  readonly currencies: readonly CurrencyOrders[]
}

export type MatrixRow = {
  readonly pubkey: string
  readonly name: string
  /** Orders created per column, aligned to `columns`. */
  readonly cells: readonly number[]
}

export type Matrix = {
  readonly columns: readonly string[]
  readonly rows: readonly MatrixRow[]
  /** The largest cell, which the heat is scaled against. Zero when empty. */
  readonly peak: number
}

/**
 * The cross, in the instances document's own order.
 *
 * Columns are ordered by what the whole network traded most, so the busiest
 * markets are the ones a reader sees before scrolling; a tie is broken by the
 * code, so the order is stable between two runs over the same archive.
 */
export function currencyMatrix(
  instances: readonly InstanceRow[],
  trades: readonly Trade[],
): Matrix {
  const breakdown = new Map(trades.map((trade) => [trade.pubkey, trade.currencies]))

  // Only an instance the instances document names can head a row: the name is
  // published there and nowhere else, and a row headed by a pubkey would be a
  // claim about an instance this client cannot name. The breakdown is carried
  // along with it, so nothing below has to look up what may be absent.
  const named = instances.flatMap((instance) => {
    const currencies = breakdown.get(instance.pubkey)
    return currencies ? [{ instance, currencies }] : []
  })

  const totals = new Map<string, number>()
  for (const { currencies } of named) {
    for (const currency of currencies) {
      totals.set(currency.code, (totals.get(currency.code) ?? 0) + currency.created)
    }
  }

  const columns = [...totals.entries()]
    .sort(([codeA, a], [codeB, b]) => b - a || codeA.localeCompare(codeB))
    .map(([code]) => code)

  const rows = named.map(({ instance, currencies }) => {
    const created = new Map(currencies.map((c) => [c.code, c.created]))
    return {
      pubkey: instance.pubkey,
      name: instance.name,
      cells: columns.map((code) => created.get(code) ?? 0),
    }
  })

  const peak = rows.reduce(
    (max, row) => row.cells.reduce((m, value) => Math.max(m, value), max),
    0,
  )

  return { columns, rows, peak }
}

/** How many shades the heat has above "nothing". */
export const HEAT_LEVELS = 4

/**
 * Heat level 0 to 4 for a count, scaled against the grid's own peak.
 *
 * Nothing keeps level 0 to itself, so an empty pair is never shaded, and one
 * order against a peak of a thousand still lands on level 1 rather than
 * rounding away into the background.
 */
export function heatLevel(count: number, peak: number): number {
  if (count <= 0 || peak <= 0) return 0
  return Math.max(1, Math.min(HEAT_LEVELS, Math.ceil((count / peak) * HEAT_LEVELS)))
}
