/**
 * Resolving a set of instances and currencies to points, once per page load.
 *
 * Both go through the same generator, seeded once, and both sort their input
 * first — so the map is the same map for the whole visit no matter what order
 * events arrived in, and a different one next visit. A node that moved between
 * renders would read as flow, and flow on this map means orders.
 */
import { pointFor, type Atlas } from '~/model/atlas'
import { resolvePlacement } from '~/model/node-location'
import { currencyPlacement } from '~/model/currency-location'
import { seededRng } from '~/model/rng'
import type { LonLat } from '~/model/random-point'

export type InstanceRef = { readonly pubkey: string; readonly name: string }

/** pubkey → point, omitting the instances whose names name no place. */
export function placeInstances(
  instances: readonly InstanceRef[],
  atlas: Atlas,
  seed: number,
): Map<string, LonLat> {
  const rng = seededRng(seed)
  const placed = new Map<string, LonLat>()
  for (const instance of [...instances].sort((a, b) => a.pubkey.localeCompare(b.pubkey))) {
    const point = pointFor(resolvePlacement(instance.name), atlas, rng)
    if (point) placed.set(instance.pubkey, point)
  }
  return placed
}

/** currency code → point, omitting the codes that belong to no country. */
export function placeCurrencies(
  codes: readonly string[],
  atlas: Atlas,
  seed: number,
): Map<string, LonLat> {
  // A different stream from the instances', so adding an instance does not
  // move every currency.
  const rng = seededRng(seed ^ 0x5bf03635)
  const placed = new Map<string, LonLat>()
  for (const code of [...new Set(codes)].sort()) {
    const point = pointFor(currencyPlacement(code), atlas, rng)
    if (point) placed.set(code, point)
  }
  return placed
}
