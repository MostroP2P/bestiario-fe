import { describe, expect, test } from 'vitest'
import { buildScene, fanOffsets } from '~/map/scene'
import type { Line } from '~/model/live-lines'
import type { LonLat } from '~/model/random-point'
import type { Point } from '~/map/geometry'

const identity = (p: LonLat): Point | null => [p[0], p[1]]

const PLACES: Record<string, LonLat> = {
  ARS: [-64, -34],
  VES: [-66, 8],
  BTC: [0, 0],
  'node-ar': [-58, -34],
  'node-ve': [-67, 10],
}

function line(over: Partial<Line> = {}): Line {
  return {
    orderId: 'o1',
    fiat: 'ARS',
    instancePubkey: 'node-ar',
    phase: 'live',
    updatedAt: 0,
    ...over,
  }
}

const base = {
  currencyAt: (code: string) => PLACES[code] ?? null,
  instanceAt: (pubkey: string) => PLACES[pubkey] ?? null,
  instanceLabel: (pubkey: string) => pubkey.toUpperCase(),
  project: identity,
}

describe('fanOffsets', () => {
  test('gives nothing for no lines', () => {
    expect(fanOffsets(0, 10)).toEqual([])
  })

  test('runs a single line straight down the middle', () => {
    expect(fanOffsets(1, 10)).toEqual([0])
  })

  test('splits a pair evenly either side', () => {
    expect(fanOffsets(2, 10)).toEqual([-5, 5])
  })

  test('centres an odd fan on zero', () => {
    expect(fanOffsets(5, 10)).toEqual([-20, -10, 0, 10, 20])
  })

  test('is symmetric, so a route is not visually biased to one side', () => {
    const offsets = fanOffsets(7, 4)

    expect(offsets.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 9)
  })
})

describe('buildScene', () => {
  test('draws one arc per line', () => {
    const scene = buildScene({ ...base, lines: [line(), line({ orderId: 'o2' })] })

    expect(scene.arcs).toHaveLength(2)
  })

  test('draws five ARS orders as five distinct lines', () => {
    // Arrange — the requirement, stated as a test.
    const lines = Array.from({ length: 5 }, (_, i) => line({ orderId: `ars-${i}` }))

    // Act
    const scene = buildScene({ ...base, lines })

    // Assert — five arcs, and no two of them the same shape.
    expect(scene.arcs).toHaveLength(5)
    const shapes = new Set(scene.arcs.map((a) => JSON.stringify(a.points)))
    expect(shapes.size).toBe(5)
  })

  test('anchors every arc at the currency and at the node', () => {
    const scene = buildScene({ ...base, lines: [line()] })
    const arc = scene.arcs[0]!

    expect(arc.points[0]).toEqual([-64, -34])
    expect(arc.points.at(-1)).toEqual([-58, -34])
  })

  test('counts the lines resting on each currency and each instance', () => {
    const lines = [
      line({ orderId: 'a' }),
      line({ orderId: 'b' }),
      line({ orderId: 'c', fiat: 'VES', instancePubkey: 'node-ve' }),
    ]

    const scene = buildScene({ ...base, lines })

    expect(scene.currencies).toEqual([
      { code: 'ARS', xy: [-64, -34], lines: 2 },
      { code: 'VES', xy: [-66, 8], lines: 1 },
    ])
    expect(scene.instances.map((i) => [i.pubkey, i.lines])).toEqual([
      ['node-ar', 2],
      ['node-ve', 1],
    ])
  })

  test('keeps the phase, so a settling line can be drawn as one', () => {
    const scene = buildScene({ ...base, lines: [line({ phase: 'settling' })] })

    expect(scene.arcs[0]!.phase).toBe('settling')
  })

  test('draws nothing for a currency it cannot place, and says how many', () => {
    const scene = buildScene({ ...base, lines: [line({ fiat: 'XXX' })] })

    expect(scene.arcs).toEqual([])
    expect(scene.unplaced).toEqual({ currencies: 1, instances: 0 })
  })

  test('draws nothing for an instance it cannot place, and says how many', () => {
    const scene = buildScene({ ...base, lines: [line({ instancePubkey: 'nowhere' })] })

    expect(scene.arcs).toEqual([])
    expect(scene.unplaced).toEqual({ currencies: 0, instances: 1 })
  })

  test('counts an unplaceable place once, however many orders rest on it', () => {
    const lines = [line({ fiat: 'XXX' }), line({ orderId: 'o2', fiat: 'XXX' })]

    expect(buildScene({ ...base, lines }).unplaced.currencies).toBe(1)
  })

  test('drops an arc that will not project rather than drawing half of it', () => {
    const scene = buildScene({ ...base, lines: [line()], project: () => null })

    expect(scene.arcs).toEqual([])
  })

  test('is empty for no lines', () => {
    const scene = buildScene({ ...base, lines: [] })

    expect(scene).toEqual({
      arcs: [],
      currencies: [],
      instances: [],
      unplaced: { currencies: 0, instances: 0 },
    })
  })
})
