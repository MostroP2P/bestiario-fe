/**
 * Country geometry, and how a placement becomes a point on it.
 *
 * The atlas is Natural Earth at 110m, shipped in `public/geo` and fetched
 * from this site's own origin (SPEC 1.1 forbids third-party scripts, and a
 * map that phones a CDN is the same mixed message). It is keyed by ISO 3166-1
 * numeric, so `iso-table.ts` is what turns a flag into a polygon.
 */
import { feature } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { Feature, Geometry } from 'geojson'
import { ALPHA2_TO_NUMERIC } from './iso-table'
import { REGIONS } from './regions'
import { randomPointInFeature, type LonLat } from './random-point'
import type { Placement } from './node-location'

export type Atlas = {
  /** ISO alpha-2 → the country's polygon, for the countries drawn at 110m. */
  readonly byAlpha2: ReadonlyMap<string, Feature<Geometry>>
  /** Every country, for drawing the land itself. */
  readonly features: readonly Feature<Geometry>[]
}

export function buildAtlas(topology: Topology): Atlas {
  const countries = topology.objects['countries']
  if (!countries) throw new Error('atlas has no `countries` object')

  // `feature` returns a collection for a GeometryCollection, which is what
  // world-atlas ships and the only shape this site loads.
  const collection = feature(topology, countries as GeometryCollection)
  const features = collection.features

  const byNumeric = new Map<string, Feature<Geometry>>()
  for (const f of features) {
    if (f.id !== undefined) byNumeric.set(String(f.id), f)
  }

  const byAlpha2 = new Map<string, Feature<Geometry>>()
  for (const [alpha2, numeric] of Object.entries(ALPHA2_TO_NUMERIC)) {
    const f = byNumeric.get(numeric)
    if (f) byAlpha2.set(alpha2, f)
  }

  return { byAlpha2, features }
}

/**
 * A point for a placement, or null when there is nowhere honest to put one.
 *
 * A country is scattered inside its own polygon. A region is scattered inside
 * one of its countries, chosen by the same generator — which is as precise as
 * "LATAM" deserves and no more. `unknown` yields null, and a caller that gets
 * null draws nothing: SPEC 2 says absence renders as absence.
 */
export function pointFor(
  placement: Placement,
  atlas: Atlas,
  rng: () => number,
): LonLat | null {
  if (placement.kind === 'unknown') return null

  if (placement.kind === 'country') {
    const f = atlas.byAlpha2.get(placement.alpha2)
    return f ? randomPointInFeature(f, rng) : null
  }

  const drawable = REGIONS[placement.region].filter((code) => atlas.byAlpha2.has(code))
  if (drawable.length === 0) return null

  // Both non-null: the index is inside a non-empty array, and every code in
  // `drawable` was just filtered on the map having it.
  const pick = drawable[Math.floor(rng() * drawable.length)]!
  return randomPointInFeature(atlas.byAlpha2.get(pick)!, rng)
}
