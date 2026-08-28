import { describe, expect, test } from 'vitest'
import { bowFor, bowSet, buildScene } from '~/map/scene'
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

describe('bowSet', () => {
  test('gives nothing for no lines', () => {
    expect(bowSet(0, 30)).toEqual([])
  })

  test('gives a lone line the route own curve, unchanged', () => {
    expect(bowSet(1, 30)).toEqual([30])
  })

  test('spreads a fan around that curve', () => {
    const bows = bowSet(5, 100)

    expect(bows).toHaveLength(5)
    expect(bows[2]).toBeCloseTo(100, 6)
    expect(bows[0]).toBeLessThan(bows[4]!)
  })

  test('keeps every line of a fan on the same side of the chord', () => {
    // An additive spread wider than the base bow pushes an inner line back
    // through zero, and a line with no bow is a straight line.
    for (const bow of bowSet(9, 20)) expect(bow).toBeGreaterThan(0)
  })

  test('never leaves a line of a fan uncurved', () => {
    for (const bow of bowSet(9, 20)) expect(Math.abs(bow)).toBeGreaterThan(5)
  })

  test('gives every line of a fan a different curve', () => {
    expect(new Set(bowSet(5, 100)).size).toBe(5)
  })

  test('is symmetric about the route own curve', () => {
    const bows = bowSet(5, 100)

    expect(bows.reduce((a, b) => a + b, 0) / bows.length).toBeCloseTo(100, 6)
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

  test('never draws a route straight, not even a lone one', () => {
    // Arrange — one line, so nothing fans it off the chord.
    const scene = buildScene({ ...base, lines: [line()] })
    const arc = scene.arcs[0]!

    // Act — how far the midpoint sits off the straight line between the ends.
    const first = arc.points[0]!
    const last = arc.points.at(-1)!
    const mid = arc.points[Math.floor(arc.points.length / 2)]!
    const offset = Math.hypot(
      mid[0] - (first[0] + last[0]) / 2,
      mid[1] - (first[1] + last[1]) / 2,
    )

    // Assert — a straight line across a world map reads as a diagram.
    expect(offset).toBeGreaterThan(10)
  })

  test('curves every line of a fan, not only the outer ones', () => {
    const lines = Array.from({ length: 5 }, (_, i) => line({ orderId: `o${i}` }))
    const scene = buildScene({ ...base, lines })

    for (const arc of scene.arcs) {
      const first = arc.points[0]!
      const last = arc.points.at(-1)!
      const mid = arc.points[Math.floor(arc.points.length / 2)]!
      const offset = Math.hypot(
        mid[0] - (first[0] + last[0]) / 2,
        mid[1] - (first[1] + last[1]) / 2,
      )
      expect(offset).toBeGreaterThan(5)
    }
  })

  test('counts the lines resting on each currency and each instance', () => {
    const lines = [
      line({ orderId: 'a' }),
      line({ orderId: 'b' }),
      line({ orderId: 'c', fiat: 'VES', instancePubkey: 'node-ve' }),
    ]

    const scene = buildScene({ ...base, lines })

    expect(scene.currencies).toEqual([
      { code: 'ARS', xy: [-64, -34], lines: 2, weight: 2 },
      { code: 'VES', xy: [-66, 8], lines: 1, weight: 1 },
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

describe('buildScene · currencies with no drawable counterparty', () => {
  test('draws a currency the network trades even when no line reaches it', () => {
    // Arrange — nothing published names an instance, so there is no line to
    // draw; the market exists all the same.
    const scene = buildScene({ ...base, lines: [], currencies: [{ code: 'ARS', weight: 9 }] })

    // Assert
    expect(scene.arcs).toEqual([])
    expect(scene.currencies).toEqual([{ code: 'ARS', xy: [-64, -34], lines: 0, weight: 9 }])
  })

  test('sizes it by what the network published, not by its lines', () => {
    const scene = buildScene({
      ...base,
      lines: [line()],
      currencies: [{ code: 'ARS', weight: 40 }],
    })

    expect(scene.currencies[0]).toMatchObject({ lines: 1, weight: 40 })
  })

  test('counts a currency it cannot place, rather than dropping it quietly', () => {
    const scene = buildScene({ ...base, lines: [], currencies: [{ code: 'XXX', weight: 3 }] })

    expect(scene.currencies).toEqual([])
    expect(scene.unplaced.currencies).toBe(1)
  })

  test('does not draw a currency twice when a line already reached it', () => {
    const scene = buildScene({
      ...base,
      lines: [line()],
      currencies: [{ code: 'ARS', weight: 9 }],
    })

    expect(scene.currencies).toHaveLength(1)
  })
})

describe('bowFor', () => {
  test('curves a long route more than a short one', () => {
    expect(bowFor(1000)).toBeGreaterThan(bowFor(300))
  })

  test('curves a very short hop anyway, rather than leaving it flat', () => {
    expect(bowFor(0)).toBeGreaterThan(10)
    expect(bowFor(10)).toBe(bowFor(0))
  })

  test('is proportional once past the floor', () => {
    expect(bowFor(2000) / bowFor(1000)).toBeCloseTo(2, 6)
  })
})

describe('bowFor · the ceiling', () => {
  test('caps a long route so it stays on the globe', () => {
    expect(bowFor(4000, 120)).toBe(120)
  })

  test('leaves a route under the cap alone', () => {
    expect(bowFor(300, 400)).toBeCloseTo(51, 6)
  })

  test('still curves a short hop even under a tight cap', () => {
    // The floor wins over the ceiling: a flat line is the thing to avoid.
    expect(bowFor(10, 2)).toBeGreaterThan(10)
  })

  test('is uncapped when no ceiling is given', () => {
    expect(bowFor(4000)).toBeGreaterThan(400)
  })
})
