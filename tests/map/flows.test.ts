import { describe, expect, test } from 'vitest'
import { ANCHOR_COUNT, anchorId, flowLines, routesFor } from '~/map/flows'

describe('routesFor', () => {
  test('gives the busiest market the most routes', () => {
    expect(routesFor(374, 374)).toBe(5)
  })

  test('gives the quietest market one, never none', () => {
    // One order is still movement and must be visible.
    expect(routesFor(1, 374)).toBe(1)
  })

  test('gives a market with no orders no routes at all', () => {
    expect(routesFor(0, 374)).toBe(0)
  })

  test('never invents a route when nothing traded', () => {
    expect(routesFor(0, 0)).toBe(0)
  })

  test('climbs with the share', () => {
    const counts = [1, 20, 90, 200, 374].map((w) => routesFor(w, 374))

    expect(counts).toEqual([...counts].sort((a, b) => a - b))
  })

  test('reads the same on a quiet day as on a busy one', () => {
    // A share and not an absolute: the counts themselves are in the table.
    expect(routesFor(10, 10)).toBe(routesFor(1000, 1000))
  })
})

describe('flowLines', () => {
  const markets = [
    { code: 'COP', weight: 374 },
    { code: 'EUR', weight: 256 },
    { code: 'ARS', weight: 59 },
    { code: 'ETB', weight: 1 },
  ]

  test('draws a route for every market that traded', () => {
    // Arrange / Act
    const lines = flowLines(markets)

    // Assert
    const codes = new Set(lines.map((line) => line.fiat))
    expect(codes).toEqual(new Set(['COP', 'EUR', 'ARS', 'ETB']))
  })

  test('gives a busier market more routes than a quieter one', () => {
    const lines = flowLines(markets)
    const count = (code: string) => lines.filter((line) => line.fiat === code).length

    expect(count('COP')).toBeGreaterThan(count('ETB'))
  })

  test('sends a market routes to different anchors, not all to one', () => {
    const lines = flowLines(markets).filter((line) => line.fiat === 'COP')

    expect(new Set(lines.map((line) => line.instancePubkey)).size).toBeGreaterThan(1)
  })

  test('names every anchor as an anchor, never as an instance', () => {
    // Nothing published names an instance; nothing here pretends to.
    for (const line of flowLines(markets)) {
      expect(line.instancePubkey).toMatch(/^anchor:\d+$/)
    }
  })

  test('stays within the anchors it was given', () => {
    const lines = flowLines(markets, 3)
    const used = new Set(lines.map((line) => line.instancePubkey))

    expect([...used].every((id) => [0, 1, 2].map(anchorId).includes(id))).toBe(true)
  })

  test('is deterministic, so the map does not reshuffle under the reader', () => {
    expect(flowLines(markets)).toEqual(flowLines([...markets].reverse()))
  })

  test('draws nothing for a market with no orders', () => {
    const lines = flowLines([{ code: 'XXX', weight: 0 }])

    expect(lines).toEqual([])
  })

  test('draws nothing with no markets', () => {
    expect(flowLines([])).toEqual([])
  })

  test('draws nothing with no anchors to reach', () => {
    expect(flowLines(markets, 0)).toEqual([])
  })

  test('gives every line a distinct id, so each is its own traveller', () => {
    const lines = flowLines(markets)

    expect(new Set(lines.map((line) => line.orderId)).size).toBe(lines.length)
  })

  test('defaults to the anchor count the map draws', () => {
    expect(ANCHOR_COUNT).toBeGreaterThan(1)
    expect(flowLines(markets).length).toBeGreaterThan(0)
  })
})
