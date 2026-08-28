/**
 * Turning measured order counts into visible movement.
 *
 * What the network publishes per currency is a count: `volume.fiat.ARS.orders`
 * is nine, or fifty-nine, or three hundred and seventy-four. What it does not
 * publish is who the counterparty was — no document names an instance, and
 * none crosses a currency with one (NOSTR-PUBLICATION §3 has the addresses;
 * nothing on the wire fills them).
 *
 * So the routes here are illustrative and the panel says so. The measured
 * facts are the currency, the country it belongs to, and how many orders it
 * carried; those drive where a route starts and how many there are. The far
 * end is a synthetic anchor with no name, no pubkey and no claim attached: it
 * exists so a busy market reads as busy, and it is drawn as an anchor rather
 * than as a node so nothing invites a reader to think a mostro sits there.
 *
 * Everything below is a pure function of the counts and one seed.
 */
import type { Line } from '~/model/live-lines'

/** How many anchors the routes fan out to. */
export const ANCHOR_COUNT = 7

/** The busiest market gets this many routes; the quietest gets one. */
const MAX_ROUTES = 5

export const anchorId = (index: number): string => `anchor:${index}`

/**
 * Routes for one market, from its share of the busiest one.
 *
 * A share, not an absolute: the map should read the same on a quiet day and a
 * busy one, and the counts themselves are in the table below.
 */
export function routesFor(weight: number, peak: number): number {
  if (weight <= 0) return 0
  if (peak <= 0) return 1
  const share = Math.sqrt(weight / peak)
  return Math.max(1, Math.min(MAX_ROUTES, Math.round(share * MAX_ROUTES)))
}

export type Market = { readonly code: string; readonly weight: number }

/**
 * One line per route, spread across the anchors so a currency's routes do not
 * all leave in the same direction. Deterministic: the same markets give the
 * same map for the whole visit.
 */
export function flowLines(
  markets: readonly Market[],
  anchors: number = ANCHOR_COUNT,
): Line[] {
  if (anchors <= 0) return []
  const peak = markets.reduce((max, market) => Math.max(max, market.weight), 0)
  const ordered = [...markets].sort((a, b) => a.code.localeCompare(b.code))

  const lines: Line[] = []
  ordered.forEach((market, marketIndex) => {
    const routes = routesFor(market.weight, peak)
    for (let route = 0; route < routes; route++) {
      // A stride that is coprime with the anchor count where it can be, so a
      // market's routes land on different anchors rather than repeating one.
      const anchor = (marketIndex * 3 + route * 2) % anchors
      lines.push({
        orderId: `${market.code}-${route}`,
        fiat: market.code,
        instancePubkey: anchorId(anchor),
        phase: 'live',
        updatedAt: 0,
      })
    }
  })
  return lines
}
