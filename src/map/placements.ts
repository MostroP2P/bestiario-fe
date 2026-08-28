/**
 * Resolving a set of instances and currencies to points, once per page load.
 *
 * Both go through the same generator, seeded once, and both sort their input
 * first — so the map is the same map for the whole visit no matter what order
 * events arrived in, and a different one next visit. A node that moved between
 * renders would read as flow, and flow on this map means orders.
 */
import { pointFor, type Atlas } from '~/model/atlas'
import type { RegionId } from '~/model/regions'
import { anchorId } from './flows'
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
  for (const instance of [...instances].sort((a, b) =>
    a.pubkey.localeCompare(b.pubkey),
  )) {
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

/**
 * Where the illustrative routes end.
 *
 * One anchor per region, in a fixed order, each a random point inside that
 * region — so the routes leave a market in different directions instead of
 * all converging on one corner of the map. The regions are the spread; the
 * point inside one is the same seeded draw everything else uses.
 *
 * These are anchors and not instances. Nothing published says where a mostro
 * is, and an anchor makes no claim that one is here.
 */
const ANCHOR_REGIONS: readonly RegionId[] = [
  'north-america',
  'europe',
  'africa',
  'asia',
  'south-america',
  'oceania',
  'middle-east',
]

export function placeAnchors(
  atlas: Atlas,
  seed: number,
  count: number,
): Map<string, LonLat> {
  // A third stream, so adding a market moves neither the anchors nor the
  // currencies.
  const rng = seededRng(seed ^ 0x2f1b3c4d)
  const placed = new Map<string, LonLat>()
  for (let i = 0; i < count; i++) {
    const region = ANCHOR_REGIONS[i % ANCHOR_REGIONS.length]!
    const point = pointFor({ kind: 'region', region, via: 'name' }, atlas, rng)
    if (point) placed.set(anchorId(i), point)
  }
  return placed
}

export type MostroPlacement = {
  readonly point: LonLat
  /**
   * True when the instance's name named no place and the point is a
   * scattering rather than a location. The map says so; nothing published
   * carries an instance's coordinates.
   */
  readonly approximate: boolean
}

/** Every country the atlas can draw, for scattering an instance that names none. */
function anywhere(atlas: Atlas, rng: () => number): LonLat | null {
  const codes = [...atlas.byAlpha2.keys()].sort()
  if (codes.length === 0) return null
  const pick = codes[Math.floor(rng() * codes.length)]!
  return pointFor({ kind: 'country', alpha2: pick, via: 'name' }, atlas, rng)
}

/**
 * pubkey → where to draw the instance, and whether that is a claim.
 *
 * An instance publishes a name and no coordinates. A name that carries a flag
 * or a country is a location; a name like "Mostro" is not, and the instance
 * is scattered and flagged as approximate rather than left off the map — it
 * is a real instance with real orders, and hiding it would understate the
 * network more than placing it loosely overstates it.
 */
export function placeMostros(
  instances: readonly InstanceRef[],
  atlas: Atlas,
  seed: number,
): Map<string, MostroPlacement> {
  // Its own stream, so an instance appearing does not move the currencies.
  const rng = seededRng(seed ^ 0x7a3f19c5)
  const placed = new Map<string, MostroPlacement>()
  for (const instance of [...instances].sort((a, b) =>
    a.pubkey.localeCompare(b.pubkey),
  )) {
    const claimed = pointFor(resolvePlacement(instance.name), atlas, rng)
    if (claimed) {
      placed.set(instance.pubkey, { point: claimed, approximate: false })
      continue
    }
    const scattered = anywhere(atlas, rng)
    if (scattered) placed.set(instance.pubkey, { point: scattered, approximate: true })
  }
  return placed
}
