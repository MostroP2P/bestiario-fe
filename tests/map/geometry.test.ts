import { describe, expect, test } from 'vitest'
import { arcPoints, bowPoints, toPathData, type Point } from '~/map/geometry'

/** A trivial projection: degrees straight to pixels, so the maths is visible. */
const identity = (p: [number, number]): Point | null => [p[0], p[1]]
const nowhere = (): Point | null => null

describe('arcPoints', () => {
  test('samples the great circle from one place to the other', () => {
    // Arrange / Act
    const points = arcPoints([0, 0], [10, 0], identity, 8)

    // Assert
    expect(points).not.toBeNull()
    expect(points).toHaveLength(9)
  })

  test('starts and ends at the two places', () => {
    const points = arcPoints([0, 0], [10, 0], identity, 8)!

    expect(points[0]![0]).toBeCloseTo(0, 6)
    expect(points.at(-1)![0]).toBeCloseTo(10, 6)
  })

  test('bends towards the great circle rather than running straight', () => {
    // Two points at the same latitude: the great circle between them bows
    // poleward, so the middle sample must leave the parallel.
    const points = arcPoints([-100, 50], [20, 50], identity, 16)!

    expect(points[8]![1]).toBeGreaterThan(50)
  })

  test('gives nothing when a sample falls off the projection', () => {
    expect(arcPoints([0, 0], [10, 0], nowhere, 8)).toBeNull()
  })
})

describe('bowPoints', () => {
  const straight: Point[] = Array.from({ length: 11 }, (_, i) => [i * 10, 0])

  test('leaves the line alone when there is no bow', () => {
    expect(bowPoints(straight, 0)).toEqual(straight)
  })

  test('leaves both ends anchored', () => {
    const bowed = bowPoints(straight, 30)

    expect(bowed[0]).toEqual(straight[0])
    expect(bowed.at(-1)).toEqual(straight.at(-1))
  })

  test('displaces the middle by the bow amount', () => {
    const bowed = bowPoints(straight, 30)

    // Perpendicular to a west-to-east chord is north-south; a positive
    // amount bows to the +y side, which is downward in SVG.
    expect(bowed[5]![1]).toBeCloseTo(30, 6)
    expect(bowed[5]![0]).toBeCloseTo(50, 6)
  })

  test('bows to the other side for a negative amount', () => {
    expect(bowPoints(straight, -30)[5]![1]).toBeCloseTo(-30, 6)
  })

  test('fans parallel lines apart, which is what makes five orders five lines', () => {
    const middles = [-2, -1, 0, 1, 2].map((i) => bowPoints(straight, i * 12)[5]![1])

    expect(new Set(middles).size).toBe(5)
  })

  test('leaves a line with no length alone rather than dividing by zero', () => {
    const degenerate: Point[] = [
      [5, 5],
      [5, 5],
      [5, 5],
    ]

    expect(bowPoints(degenerate, 20)).toEqual(degenerate)
  })

  test('leaves a line too short to bow alone', () => {
    expect(bowPoints([[1, 1]], 20)).toEqual([[1, 1]])
  })
})

describe('toPathData', () => {
  test('draws a polyline as one stroke', () => {
    expect(
      toPathData([
        [0, 0],
        [10, 5],
        [20, 0],
      ]),
    ).toBe('M0.0,0.0L10.0,5.0L20.0,0.0')
  })

  test('lifts the pen where the projection wraps', () => {
    // Arrange — a route crossing the antimeridian: the projection puts one
    // sample at the right edge and the next at the left.
    const points: Point[] = [
      [900, 100],
      [990, 110],
      [10, 120],
      [90, 130],
    ]

    // Act
    const path = toPathData(points, 500)

    // Assert — two strokes, not one streak across the map.
    expect(path).toBe('M900.0,100.0L990.0,110.0M10.0,120.0L90.0,130.0')
  })

  test('joins everything when no seam is possible', () => {
    const points: Point[] = [
      [0, 0],
      [900, 0],
    ]

    expect(toPathData(points)).toBe('M0.0,0.0L900.0,0.0')
  })

  test('does not break on a step that is merely long', () => {
    expect(
      toPathData(
        [
          [0, 0],
          [400, 0],
        ],
        500,
      ),
    ).toBe('M0.0,0.0L400.0,0.0')
  })

  test('handles a single point', () => {
    expect(toPathData([[5, 5]], 500)).toBe('M5.0,5.0')
  })

  test('handles no points', () => {
    expect(toPathData([], 500)).toBe('')
  })
})
