/**
 * The shape of a line between a currency and the node trading it.
 *
 * Two pieces, both pure. `arcPoints` samples the great circle between two
 * places and projects it, so a line follows the globe rather than the screen.
 * `bowPoints` then pushes that polyline sideways — which is how five orders
 * on the same route read as five lines and not as one line drawn five times.
 */
import { geoInterpolate } from 'd3-geo'
import type { LonLat } from '~/model/random-point'

/** A projected screen coordinate. */
export type Point = [number, number]

export type Projection = (lonLat: LonLat) => Point | null

/**
 * `samples + 1` points along the great circle from `from` to `to`.
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
  const along = geoInterpolate(from, to)
  const points: Point[] = []
  for (let i = 0; i <= samples; i++) {
    // The ends are the places themselves, not interpolations towards them:
    // geoInterpolate at t=1 lands a floating-point hair off its own target,
    // and a line has to terminate *at* its node, not near it.
    const lonLat = i === 0 ? from : i === samples ? to : along(i / samples)
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
 * An SVG path `d` for a polyline, broken where the projection wraps.
 *
 * A great circle that crosses the antimeridian projects to points at one edge
 * of the map and then at the other. Joined with a line, that is a bright
 * streak straight across the world — the most conspicuous wrong thing this
 * map can draw, and the reason `maxJump` exists: a step wider than it is not
 * a segment, it is the seam, and the path lifts its pen over it.
 *
 * Coordinates are rounded to a tenth of a pixel, which is below what a screen
 * can show and keeps the markup readable.
 */
export function toPathData(points: readonly Point[], maxJump: number = Infinity): string {
  let path = ''
  let previous: Point | null = null

  for (const point of points) {
    const [x, y] = point
    const wrapped =
      previous !== null && Math.abs(x - previous[0]) > maxJump
    path += `${previous === null || wrapped ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    previous = point
  }
  return path
}
