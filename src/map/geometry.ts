/**
 * The shape of a line between a currency and the node trading it.
 *
 * Two pieces, both pure. `arcPoints` samples the way from one place to the
 * other *across this map* and projects it. `bowPoints` then pushes that
 * polyline sideways — which is how five orders on the same route read as
 * five lines and not as one line drawn five times.
 */
import type { LonLat } from '~/model/random-point'

/** A projected screen coordinate. */
export type Point = [number, number]

export type Projection = (lonLat: LonLat) => Point | null

/**
 * `samples + 1` points along the way from `from` to `to`, projected.
 *
 * The path is walked in longitude and latitude directly, never through the
 * antimeridian: every sample's longitude lies between the two ends' own. A
 * great circle would instead take whichever way round the globe is shorter,
 * and on a flat map that is a route which walks off one edge and reappears at
 * the other — two half-lines that read as a broken drawing rather than as one
 * journey. A reader of this map follows a line from a market to a node; it
 * has to be a line they can follow.
 *
 * The cost is that a route no longer traces the shortest path over the globe.
 * That was never what this map claims: `bowPoints` bends every route anyway,
 * and the arc is there to say "a path between two places", not to be measured.
 *
 * Null when any sample falls outside the projection — a partially drawn line
 * would imply a route that stops in the middle of the ocean.
 */
export function arcPoints(
  from: LonLat,
  to: LonLat,
  project: Projection,
  samples: number,
): Point[] | null {
  const [fromLon, fromLat] = from
  const [toLon, toLat] = to
  const points: Point[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    // The ends are the places themselves, not interpolations towards them: a
    // line has to terminate *at* its node, not a floating-point hair off it.
    const lonLat: LonLat =
      i === 0
        ? from
        : i === samples
          ? to
          : [fromLon + (toLon - fromLon) * t, fromLat + (toLat - fromLat) * t]
    const projected = project(lonLat)
    if (!projected) return null
    points.push(projected)
  }
  return points
}

/**
 * The same polyline pushed perpendicular to its own chord, by `amount` at the
 * midpoint and by nothing at either end.
 *
 * The displacement follows `sin(pi t)`, so lines leave and arrive at exactly
 * their endpoints and separate in between. A zero-length chord has no
 * perpendicular and is returned untouched.
 */
export function bowPoints(points: readonly Point[], amount: number): Point[] {
  if (amount === 0 || points.length < 3) return [...points]

  const first = points[0]!
  const last = points[points.length - 1]!
  const dx = last[0] - first[0]
  const dy = last[1] - first[1]
  const length = Math.hypot(dx, dy)
  if (length === 0) return [...points]

  // Unit normal, a quarter turn clockwise from the chord. In SVG's
  // y-down space a positive amount therefore bows below a west-to-east
  // line; the sign is a convention, and callers use it to fan lines to
  // both sides of a route.
  const nx = -dy / length
  const ny = dx / length

  const lastIndex = points.length - 1
  return points.map(([x, y], i) => {
    // Anchored exactly, not merely nearly: sin(pi) is not 0 in floating
    // point, and a line that misses its own node by 4e-15 is still a line
    // that misses its node.
    if (i === 0 || i === lastIndex) return [x, y] as Point
    const lift = Math.sin((i / lastIndex) * Math.PI) * amount
    return [x + nx * lift, y + ny * lift] as Point
  })
}

/**
 * An SVG path `d` for a polyline.
 *
 * One unbroken stroke: routes are sampled across the map rather than around
 * the globe (see `arcPoints`), so there is no seam left for the pen to lift
 * over.
 *
 * Coordinates are rounded to a tenth of a pixel, which is below what a screen
 * can show and keeps the markup readable.
 */
export function toPathData(points: readonly Point[]): string {
  return points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join('')
}
