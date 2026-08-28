/**
 * A random point inside a country.
 *
 * Instances do not say where they are beyond a flag, so a node placed on the
 * map is placed *somewhere in that country* and nowhere more precise than
 * that. Rejection sampling over the feature's bounding box is the honest
 * implementation of exactly that claim: uniform over the box, kept only when
 * it falls on land the feature covers.
 *
 * It can fail — a bounding box far larger than its feature, or a degenerate
 * one — and failing is `null`. A caller that wanted a point and got none
 * draws no node, which is better than drawing one in the sea.
 */
import { geoBounds, geoContains } from 'd3-geo'
import type { Feature, Geometry } from 'geojson'

/** [longitude, latitude] */
export type LonLat = [number, number]

const DEFAULT_ATTEMPTS = 400

export function randomPointInFeature(
  feature: Feature<Geometry>,
  rng: () => number,
  maxAttempts: number = DEFAULT_ATTEMPTS,
): LonLat | null {
  const [[west, south], [east, north]] = geoBounds(feature)

  // geoBounds wraps a box crossing the antimeridian, giving west > east.
  // Sampling the long way round would scatter points across the wrong ocean,
  // so the span is taken modulo the globe and the result normalised back.
  const lonSpan = east >= west ? east - west : 360 - west + east
  const latSpan = north - south

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const lon = normaliseLon(west + rng() * lonSpan)
    const lat = south + rng() * latSpan
    const point: LonLat = [lon, lat]
    if (geoContains(feature, point)) return point
  }
  return null
}

function normaliseLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180
}
