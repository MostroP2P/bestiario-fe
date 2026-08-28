import { describe, expect, test } from 'vitest'
import { geoBounds, geoContains } from 'd3-geo'
import type { Feature, Polygon } from 'geojson'
import { randomPointInFeature } from '~/model/random-point'
import { seededRng, sessionSeed } from '~/model/rng'

/** A 10°×10° square off the coast of Africa — simple, and easy to reason about. */
const SQUARE: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
      ],
    ],
  },
}

/** Zero area: nothing can land inside it. */
const DEGENERATE: Feature<Polygon> = {
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    ],
  },
}

describe('randomPointInFeature', () => {
  test('lands inside the feature', () => {
    // Arrange
    const rng = seededRng(1)

    // Act
    const point = randomPointInFeature(SQUARE, rng)

    // Assert
    expect(point).not.toBeNull()
    expect(geoContains(SQUARE, point!)).toBe(true)
  })

  test('lands inside the feature on every draw, not just the first', () => {
    const rng = seededRng(7)

    for (let i = 0; i < 50; i++) {
      const point = randomPointInFeature(SQUARE, rng)
      expect(point).not.toBeNull()
      expect(geoContains(SQUARE, point!)).toBe(true)
    }
  })

  test('is deterministic for a given seed, so a node does not jitter on re-render', () => {
    expect(randomPointInFeature(SQUARE, seededRng(42))).toEqual(
      randomPointInFeature(SQUARE, seededRng(42)),
    )
  })

  test('places different seeds in different spots', () => {
    expect(randomPointInFeature(SQUARE, seededRng(1))).not.toEqual(
      randomPointInFeature(SQUARE, seededRng(2)),
    )
  })

  test('gives up rather than looping forever on a feature with no area', () => {
    expect(randomPointInFeature(DEGENERATE, seededRng(1), 20)).toBeNull()
  })
})

describe('seededRng', () => {
  test('yields the same sequence for the same seed', () => {
    const a = seededRng(99)
    const b = seededRng(99)

    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })

  test('yields values in [0, 1)', () => {
    const rng = seededRng(3)

    for (let i = 0; i < 200; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('randomPointInFeature · antimeridian', () => {
  /** Fiji-shaped: a box whose bounds wrap, so west > east. */
  const WRAPPED: Feature<Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      // Wound so d3 reads the small box, not its complement: bounds come back
      // as [[170, …], [-170, …]] — west > east, exactly as Fiji and Russia do
      // in the real atlas.
      coordinates: [
        [
          [170, 10],
          [-170, 10],
          [-170, -10],
          [170, -10],
          [170, 10],
        ],
      ],
    },
  }

  test('has bounds that actually wrap, or the test proves nothing', () => {
    const [[west], [east]] = geoBounds(WRAPPED)

    expect(west).toBeGreaterThan(east)
  })

  test('samples the short way round rather than across the whole globe', () => {
    const rng = seededRng(5)

    for (let i = 0; i < 30; i++) {
      const point = randomPointInFeature(WRAPPED, rng)
      expect(point).not.toBeNull()
      expect(geoContains(WRAPPED, point!)).toBe(true)
    }
  })
})

describe('sessionSeed', () => {
  test('is an unsigned 32-bit integer', () => {
    const seed = sessionSeed()

    expect(Number.isInteger(seed)).toBe(true)
    expect(seed).toBeGreaterThanOrEqual(0)
    expect(seed).toBeLessThanOrEqual(0xffffffff)
  })

  test('drives the generator, so two page loads scatter nodes differently', () => {
    const seeds = new Set(Array.from({ length: 40 }, () => sessionSeed()))

    // Not a distribution test — just that it is not a constant.
    expect(seeds.size).toBeGreaterThan(1)
  })
})
