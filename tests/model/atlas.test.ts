import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { geoContains } from 'd3-geo'
import type { Topology } from 'topojson-specification'
import { buildAtlas, pointFor } from '~/model/atlas'
import { seededRng } from '~/model/rng'
import { REGIONS } from '~/model/regions'

/** The atlas this site actually ships, not a stand-in for it. */
const topology = JSON.parse(
  readFileSync('public/geo/countries-110m.json', 'utf8'),
) as Topology
const atlas = buildAtlas(topology)

describe('buildAtlas', () => {
  test('keys every drawable country by its alpha-2 code', () => {
    expect(atlas.byAlpha2.size).toBe(174)
  })

  test('exposes the land itself for drawing', () => {
    expect(atlas.features.length).toBe(177)
  })

  test('resolves the countries this network trades in', () => {
    for (const code of ['AR', 'VE', 'CO', 'BR', 'MX', 'PE', 'CL', 'US', 'NG', 'ID']) {
      expect(atlas.byAlpha2.has(code)).toBe(true)
    }
  })

  test('rejects a topology with no countries', () => {
    expect(() => buildAtlas({ type: 'Topology', objects: {}, arcs: [] })).toThrow(
      /no `countries` object/,
    )
  })
})

describe('pointFor', () => {
  test('puts a country placement inside that country', () => {
    // Arrange
    const rng = seededRng(11)

    // Act
    const point = pointFor({ kind: 'country', alpha2: 'VE', via: 'flag' }, atlas, rng)

    // Assert
    expect(point).not.toBeNull()
    expect(geoContains(atlas.byAlpha2.get('VE')!, point!)).toBe(true)
  })

  test('puts a region placement inside one of the regions countries', () => {
    const point = pointFor(
      { kind: 'region', region: 'latam', via: 'tld' },
      atlas,
      seededRng(3),
    )

    expect(point).not.toBeNull()
    const landed = REGIONS.latam.filter((code) => {
      const f = atlas.byAlpha2.get(code)
      return f ? geoContains(f, point!) : false
    })
    expect(landed).toHaveLength(1)
  })

  test('gives no point for an unknown placement', () => {
    expect(pointFor({ kind: 'unknown' }, atlas, seededRng(1))).toBeNull()
  })

  test('gives no point for a country the atlas cannot draw', () => {
    expect(
      pointFor({ kind: 'country', alpha2: 'MC', via: 'flag' }, atlas, seededRng(1)),
    ).toBeNull()
  })

  test('gives no point for a region whose countries are all undrawable', () => {
    const empty = { byAlpha2: new Map(), features: [] }

    expect(
      pointFor({ kind: 'region', region: 'latam', via: 'tld' }, empty, seededRng(1)),
    ).toBeNull()
  })

  test('is stable for a seed, so a node stays put across re-renders', () => {
    expect(
      pointFor({ kind: 'country', alpha2: 'AR', via: 'flag' }, atlas, seededRng(8)),
    ).toEqual(
      pointFor({ kind: 'country', alpha2: 'AR', via: 'flag' }, atlas, seededRng(8)),
    )
  })

  test('scatters different seeds to different points', () => {
    expect(
      pointFor({ kind: 'country', alpha2: 'BR', via: 'flag' }, atlas, seededRng(1)),
    ).not.toEqual(
      pointFor({ kind: 'country', alpha2: 'BR', via: 'flag' }, atlas, seededRng(2)),
    )
  })
})
