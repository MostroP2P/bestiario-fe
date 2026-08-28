/**
 * The map's lines, from what the network published about itself.
 *
 * `orders:<window>:i:<pubkey>` says how many orders an instance created in
 * each currency. That is the cross the map needs: a line from a currency's
 * country to the instance trading it, and as many lines as that pair's share
 * of the busiest pair warrants.
 *
 * Nothing here is illustrative. Every line stands for a pair the publisher
 * signed a figure for, and a pair with no figure gets no line.
 */
import { routesFor } from './flows'
import type { Line } from '~/model/live-lines'
import type { CurrencyOrders } from '~/model/instances'

export type InstanceTrade = {
  readonly pubkey: string
  readonly currencies: readonly CurrencyOrders[]
}

/**
 * One line per route, `routes` of them per pair, scaled against the busiest
 * pair on the map so a quiet day and a busy one read alike.
 *
 * Deterministic: sorted by pubkey and then by code, so the same snapshot
 * gives the same map however the documents arrived.
 */
export function networkLines(instances: readonly InstanceTrade[]): Line[] {
  const peak = instances.reduce(
    (max, instance) =>
      instance.currencies.reduce(
        (inner, currency) => Math.max(inner, currency.created),
        max,
      ),
    0,
  )

  const lines: Line[] = []
  for (const instance of [...instances].sort((a, b) =>
    a.pubkey.localeCompare(b.pubkey),
  )) {
    for (const currency of [...instance.currencies].sort((a, b) =>
      a.code.localeCompare(b.code),
    )) {
      const routes = routesFor(currency.created, peak)
      for (let route = 0; route < routes; route++) {
        lines.push({
          orderId: `${instance.pubkey}-${currency.code}-${route}`,
          fiat: currency.code,
          instancePubkey: instance.pubkey,
          phase: 'live',
          updatedAt: 0,
        })
      }
    }
  }
  return lines
}

/** Every currency any instance traded, with the network's total per code. */
export function tradedCurrencies(
  instances: readonly InstanceTrade[],
): { code: string; weight: number }[] {
  const totals = new Map<string, number>()
  for (const instance of instances) {
    for (const currency of instance.currencies) {
      totals.set(currency.code, (totals.get(currency.code) ?? 0) + currency.created)
    }
  }
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, weight]) => ({ code, weight }))
}
