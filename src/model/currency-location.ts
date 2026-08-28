/**
 * Where a currency is.
 *
 * ISO 4217 builds most codes out of the country's ISO 3166-1 alpha-2 plus a
 * letter for the unit: `AR` + `S` is the Argentine peso, `VE` + `S` the
 * bolívar, `BR` + `L` the real. So the country is already in the code, and no
 * table is needed for the long tail — only for the currencies that genuinely
 * belong to no single country, which are listed and are the whole exception
 * set.
 *
 * The one thing the code-prefix rule gets actively wrong is crypto: `BTC`
 * would read as Bhutan and `SAT` as Saudi Arabia. Those are listed and
 * refused. Bitcoin is the other side of every order on this map and belongs
 * to no country; a line runs from the fiat side to the node.
 */
import { ALPHA2_TO_NUMERIC } from './iso-table'
import type { Placement } from './node-location'
import type { RegionId } from './regions'

/** Currencies shared by many countries: placed in a region, never a capital. */
const REGIONAL_CURRENCIES: Readonly<Record<string, RegionId>> = {
  EUR: 'europe',
  XAF: 'africa',
  XOF: 'africa',
  XCD: 'caribbean',
  XPF: 'oceania',
}

/**
 * Codes that are not a country's money. Each would otherwise be misread by
 * the prefix rule — BTC as Bhutan, SAT as Saudi Arabia, USDT as the United
 * States — and a line drawn from any of them would be a claim about a place
 * that has nothing to do with the order.
 */
const NON_FIAT: ReadonlySet<string> = new Set([
  'BTC', 'XBT', 'SAT', 'SATS', 'ETH', 'LTC', 'XMR', 'DAI', 'USDT', 'USDC',
])

const UNKNOWN: Placement = { kind: 'unknown' }

export function currencyPlacement(code: string): Placement {
  const upper = code.toUpperCase()
  if (NON_FIAT.has(upper)) return UNKNOWN

  const region = REGIONAL_CURRENCIES[upper]
  if (region !== undefined) return { kind: 'region', region, via: 'name' }

  if (upper.length !== 3) return UNKNOWN

  const alpha2 = upper.slice(0, 2)
  if (alpha2 in ALPHA2_TO_NUMERIC) return { kind: 'country', alpha2, via: 'name' }

  return UNKNOWN
}
