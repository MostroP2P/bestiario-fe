/**
 * Swaps: orders that trade Lightning sats for bitcoin on another rail.
 *
 * Mostro is also used to move bitcoin between Lightning and on-chain,
 * Liquid or Rootstock. Such an order carries a BTC-pegged code — `BTC`,
 * `LBTC`, `RBTC`, in any casing — and its fiat side is counted in sats of
 * the asset, not in a fiat currency (Mostro protocol §11.9). The publisher
 * signs those figures with unit `sats` and keeps the rows in
 * `volume.fiat.<CODE>.*`, so the per-currency family adds up to the
 * completed count. Shown as one more currency, a swap reads as if bitcoin
 * were a fiat market; this module is what tells the two apart.
 *
 * Stablecoins (`USDT`, `USDC`, `DOC`) are not swaps: Mostro prices them as
 * the dollar they track, in whole coins (§11.8), and they stay currencies.
 */
import type { FiatRow } from '~/model/metrics'

export type SwapRail = 'onchain' | 'liquid' | 'rootstock'

/** The `Peg::Btc` rows of mostrod's `KNOWN_PEGGED`, by rail. */
const RAILS: Readonly<Record<string, SwapRail>> = {
  BTC: 'onchain',
  LBTC: 'liquid',
  RBTC: 'rootstock',
}

/**
 * The rail a code swaps against, or `null` for a currency. Any casing,
 * because mostrod matches it that way and an order carries the code as its
 * maker typed it.
 */
export function swapRail(code: string): SwapRail | null {
  return RAILS[code.toUpperCase()] ?? null
}

/** The rows of a per-currency family, split into currencies and swaps. */
export function splitSwaps<T extends { readonly code: string }>(
  rows: readonly T[],
): { fiat: readonly T[]; swaps: readonly T[] } {
  return {
    fiat: rows.filter((row) => swapRail(row.code) === null),
    swaps: rows.filter((row) => swapRail(row.code) !== null),
  }
}

/**
 * The completed swaps across rails, or `null` when any rail did not publish
 * its count: a sum that silently skipped one would be a smaller number the
 * publisher never signed.
 */
export function swapCount(rows: readonly FiatRow[]): number | null {
  if (rows.length === 0) return null
  let total = 0
  for (const row of rows) {
    const value = row.figures.get('completed')?.value
    if (typeof value !== 'number') return null
    total += value
  }
  return total
}
