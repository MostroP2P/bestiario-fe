/**
 * The projection the map is drawn in.
 *
 * Natural Earth: a compromise projection that distorts area less than Mercator
 * at the latitudes this network actually trades in. Fitted to the panel with
 * the same insets the design uses, so the sphere sits where it was drawn.
 */
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo'
import type { GeoPermissibleObjects } from 'd3-geo'
import type { Point } from './geometry'
import type { LonLat } from '~/model/random-point'

const INSET_X = 10
const INSET_Y = 18

export type MapProjection = {
  readonly project: (lonLat: LonLat) => Point | null
  readonly pathFor: (object: GeoPermissibleObjects) => string
  readonly graticule: string
  readonly sphere: string
}

export function createProjection(width: number, height: number): MapProjection {
  const projection = geoNaturalEarth1().fitExtent(
    [
      [INSET_X, INSET_Y],
      [width - INSET_X, height - INSET_Y],
    ],
    { type: 'Sphere' },
  )
  const path = geoPath(projection)

  return {
    project: (lonLat) => {
      const xy = projection(lonLat)
      // A place outside the projection has no point on this map, and half a
      // line to nowhere is worse than no line.
      return xy ? [xy[0], xy[1]] : null
    },
    pathFor: (object) => path(object) ?? '',
    graticule: path(geoGraticule10()) ?? '',
    sphere: path({ type: 'Sphere' }) ?? '',
  }
}
