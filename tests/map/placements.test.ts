import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { geoContains } from 'd3-geo'
import type { Topology } from 'topojson-specification'
import { buildAtlas } from '~/model/atlas'
import {
  placeAnchors,
  placeCurrencies,
  placeInstances,
  placeMostros,
} from '~/map/placements'

const atlas = buildAtlas(
  JSON.parse(readFileSync('public/geo/countries-110m.json', 'utf8')) as Topology,
)

/** The five instances of the design, verbatim. */
const INSTANCES = [
  { pubkey: 'k1', name: 'mostro.network' },
  { pubkey: 'k2', name: 'p2p.lat' },
  { pubkey: 'k3', name: 'satoshi.br' },
  { pubkey: 'k4', name: 'nodo.mx' },
  { pubkey: 'k5', name: 'andes.pe' },
]

describe('placeInstances', () => {
  test('places the instances whose names name a place, and only those', () => {
    // Act
    const placed = placeInstances(INSTANCES, atlas, 1)

    // Assert — mostro.network names nowhere and gets no point.
    expect([...placed.keys()].sort()).toEqual(['k2', 'k3', 'k4', 'k5'])
  })

  test('puts an instance inside the country its name claims', () => {
    const placed = placeInstances(INSTANCES, atlas, 7)

    expect(geoContains(atlas.byAlpha2.get('BR')!, placed.get('k3')!)).toBe(true)
    expect(geoContains(atlas.byAlpha2.get('MX')!, placed.get('k4')!)).toBe(true)
    expect(geoContains(atlas.byAlpha2.get('PE')!, placed.get('k5')!)).toBe(true)
  })

  test('does not move when the same instances arrive in another order', () => {
    const forwards = placeInstances(INSTANCES, atlas, 3)
    const backwards = placeInstances([...INSTANCES].reverse(), atlas, 3)

    expect([...forwards]).toEqual([...backwards])
  })

  test('scatters differently on the next page load', () => {
    expect([...placeInstances(INSTANCES, atlas, 1)]).not.toEqual([
      ...placeInstances(INSTANCES, atlas, 2),
    ])
  })
})

describe('placeCurrencies', () => {
  test('places each currency in its own country', () => {
    const placed = placeCurrencies(['ARS', 'VES', 'BRL'], atlas, 4)

    expect(geoContains(atlas.byAlpha2.get('AR')!, placed.get('ARS')!)).toBe(true)
    expect(geoContains(atlas.byAlpha2.get('VE')!, placed.get('VES')!)).toBe(true)
    expect(geoContains(atlas.byAlpha2.get('BR')!, placed.get('BRL')!)).toBe(true)
  })

  test('omits a code that belongs to no country', () => {
    const placed = placeCurrencies(['ARS', 'BTC'], atlas, 4)

    expect(placed.has('BTC')).toBe(false)
    expect(placed.has('ARS')).toBe(true)
  })

  test('ignores duplicates', () => {
    expect(placeCurrencies(['ARS', 'ARS', 'ARS'], atlas, 4).size).toBe(1)
  })

  test('does not move a currency when an instance is added', () => {
    // The two draw from separate streams, so one set growing must not shift
    // the other.
    const before = placeCurrencies(['ARS', 'VES'], atlas, 9)
    placeInstances([...INSTANCES, { pubkey: 'k6', name: 'nuevo.cl' }], atlas, 9)
    const after = placeCurrencies(['ARS', 'VES'], atlas, 9)

    expect([...before]).toEqual([...after])
  })
})

describe('placeAnchors', () => {
  test('places as many anchors as it is asked for', () => {
    // Act
    const anchors = placeAnchors(atlas, 5, 7)

    // Assert
    expect(anchors.size).toBe(7)
  })

  test('names them as anchors, never as instances', () => {
    for (const key of placeAnchors(atlas, 5, 7).keys()) {
      expect(key).toMatch(/^anchor:\d+$/)
    }
  })

  test('spreads them across the world rather than clustering', () => {
    // One per region, so no two share a longitude by accident.
    const points = [...placeAnchors(atlas, 5, 7).values()]
    const longitudes = points.map(([lon]) => lon)

    expect(Math.max(...longitudes) - Math.min(...longitudes)).toBeGreaterThan(120)
  })

  test('puts each anchor on land', () => {
    const anchors = placeAnchors(atlas, 11, 7)

    for (const point of anchors.values()) {
      const onLand = atlas.features.some((feature) => geoContains(feature, point))
      expect(onLand).toBe(true)
    }
  })

  test('does not move between renders of one visit', () => {
    expect([...placeAnchors(atlas, 3, 7)]).toEqual([...placeAnchors(atlas, 3, 7)])
  })

  test('scatters differently on the next visit', () => {
    expect([...placeAnchors(atlas, 1, 7)]).not.toEqual([...placeAnchors(atlas, 2, 7)])
  })

  test('does not move the currencies when the anchor count changes', () => {
    // Separate streams: the markets are measured and must not shift because
    // the illustration around them did.
    const before = placeCurrencies(['ARS', 'VES'], atlas, 9)
    placeAnchors(atlas, 9, 12)
    const after = placeCurrencies(['ARS', 'VES'], atlas, 9)

    expect([...before]).toEqual([...after])
  })

  test('asks for none and gets none', () => {
    expect(placeAnchors(atlas, 5, 0).size).toBe(0)
  })
})

describe('placeMostros', () => {
  const AR = { pubkey: 'a'.repeat(64), name: 'Mostro 🇦🇷' }
  const PLAIN = { pubkey: 'b'.repeat(64), name: 'Mostro' }

  test('puts an instance whose name names a country inside it', () => {
    // Act
    const placed = placeMostros([AR], atlas, 4)

    // Assert
    expect(geoContains(atlas.byAlpha2.get('AR')!, placed.get(AR.pubkey)!.point)).toBe(
      true,
    )
    expect(placed.get(AR.pubkey)!.approximate).toBe(false)
  })

  test('scatters an instance whose name names none, and says the point is a guess', () => {
    // A real instance with real orders: leaving it off understates the
    // network more than placing it loosely overstates it.
    const placed = placeMostros([PLAIN], atlas, 4)

    expect(placed.get(PLAIN.pubkey)).toBeDefined()
    expect(placed.get(PLAIN.pubkey)!.approximate).toBe(true)
  })

  test('puts every scattered instance on land', () => {
    const placed = placeMostros([PLAIN], atlas, 12)
    const point = placed.get(PLAIN.pubkey)!.point

    expect(atlas.features.some((feature) => geoContains(feature, point))).toBe(true)
  })

  test('does not move between renders of one visit', () => {
    expect([...placeMostros([AR, PLAIN], atlas, 8)]).toEqual([
      ...placeMostros([AR, PLAIN], atlas, 8),
    ])
  })

  test('does not depend on the order the documents arrived in', () => {
    expect([...placeMostros([AR, PLAIN], atlas, 8)]).toEqual([
      ...placeMostros([PLAIN, AR], atlas, 8),
    ])
  })

  test('does not move the currencies when an instance appears', () => {
    const before = placeCurrencies(['ARS', 'VES'], atlas, 9)
    placeMostros([AR, PLAIN], atlas, 9)
    const after = placeCurrencies(['ARS', 'VES'], atlas, 9)

    expect([...before]).toEqual([...after])
  })

  test('places nothing for no instances', () => {
    expect(placeMostros([], atlas, 4).size).toBe(0)
  })
})

describe('placeMostros · an atlas that can draw nothing', () => {
  test('places no instance rather than inventing a point', () => {
    const empty = { byAlpha2: new Map(), features: [] }

    expect(
      placeMostros([{ pubkey: 'c'.repeat(64), name: 'Mostro' }], empty, 1).size,
    ).toBe(0)
  })
})
