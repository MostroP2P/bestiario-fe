/**
 * Ordering the per-currency volume table.
 *
 * The table opens on the busiest market rather than on the alphabet, and a
 * reader can rank it by any column. Two rules the ordering keeps, because
 * neither is what a naive comparator does:
 *
 * A figure nobody published is not a small figure. `null` and a missing
 * metric sink to the bottom in *both* directions — ascending by orders must
 * not crown a currency whose order count was never given.
 *
 * The order is total. Rows that tie on the chosen column fall back to their
 * code, so the same rows always land in the same place and the table does not
 * reshuffle under the reader between renders.
 *
 * One caveat the default encodes: the fiat columns are each denominated in
 * their own row's currency, so ranking by them compares ARS against USD. That
 * is a real ordering of the published numbers, and the reader may ask for it,
 * but it is not a ranking of market size. `orders` and `sats` are the two
 * columns that do compare across rows, and the table opens on `orders`: the
 * archive published no sats per currency until recently, and a default that
 * sorts on a column an older archive leaves absent would open the table on
 * the alphabet.
 */
import type { FiatRow } from '~/model/metrics'
import type { Metric } from '~/nostr/documents'

export type SortDirection = 'asc' | 'desc'

/** `code` is the currency column; anything else is a figure name. */
export type FiatSort = {
  readonly key: string
  readonly direction: SortDirection
}

export const CODE_KEY = 'code'

export const DEFAULT_FIAT_SORT: FiatSort = { key: 'orders', direction: 'desc' }

/**
 * What a figure is worth for ranking, or `null` when it cannot be ranked —
 * absent, published as `null`, or published as words rather than a quantity.
 */
function magnitude(metric: Metric | undefined): number | null {
  if (!metric) return null
  const value = metric.value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value !== null && typeof value === 'object') return value.amount
  return null
}

export function sortFiatRows(
  rows: readonly FiatRow[],
  sort: FiatSort,
): readonly FiatRow[] {
  const sign = sort.direction === 'asc' ? 1 : -1

  if (sort.key === CODE_KEY) {
    return [...rows].sort((a, b) => sign * a.code.localeCompare(b.code))
  }

  return [...rows].sort((a, b) => {
    const left = magnitude(a.figures.get(sort.key))
    const right = magnitude(b.figures.get(sort.key))
    if (left === null || right === null) {
      // Absence sinks, whichever way the column is pointing.
      if (left !== right) return left === null ? 1 : -1
    } else if (left !== right) {
      return sign * (left - right)
    }
    return a.code.localeCompare(b.code)
  })
}

/** The sort a click on `key` moves to: flip the active column, open a new one. */
export function nextSort(current: FiatSort, key: string): FiatSort {
  if (current.key === key) {
    return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' }
  }
  // A figure column opens on its largest value; a code column opens at A.
  return { key, direction: key === CODE_KEY ? 'asc' : 'desc' }
}
