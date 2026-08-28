import { describe, expect, test } from 'vitest'
import { activeLines, type LiveOrder } from '~/model/live-lines'

const CFG = {
  graceMs: 10 * 60 * 1000,
  liveStatuses: ['pending', 'in-progress'],
  settlingStatuses: ['success'],
  maxLines: 400,
} as const

const NOW = 1_700_000_000_000

function order(over: Partial<LiveOrder> = {}): LiveOrder {
  return {
    id: 'a1',
    fiat: 'ARS',
    status: 'pending',
    instancePubkey: 'npub-a',
    updatedAt: NOW,
    ...over,
  }
}

describe('activeLines', () => {
  test('returns no lines when there are no orders', () => {
    expect(activeLines([], NOW, CFG)).toEqual([])
  })

  test('draws one line per pending order, so five ARS orders are five lines', () => {
    // Arrange
    const orders = Array.from({ length: 5 }, (_, i) => order({ id: `ars-${i}` }))

    // Act
    const lines = activeLines(orders, NOW, CFG)

    // Assert
    expect(lines).toHaveLength(5)
    expect(new Set(lines.map((l) => l.fiat))).toEqual(new Set(['ARS']))
    expect(new Set(lines.map((l) => l.orderId)).size).toBe(5)
  })

  test('draws a line from the currency to the instance that published the order', () => {
    const lines = activeLines([order({ fiat: 'VES', instancePubkey: 'npub-ve' })], NOW, CFG)

    expect(lines[0]).toMatchObject({ fiat: 'VES', instancePubkey: 'npub-ve', phase: 'live' })
  })

  test('keeps a successful order on the map inside the grace period', () => {
    const settled = order({ status: 'success', updatedAt: NOW - 9 * 60 * 1000 })

    const lines = activeLines([settled], NOW, CFG)

    expect(lines).toHaveLength(1)
    expect(lines[0]?.phase).toBe('settling')
  })

  test('drops a successful order once the grace period has elapsed', () => {
    const settled = order({ status: 'success', updatedAt: NOW - 11 * 60 * 1000 })

    expect(activeLines([settled], NOW, CFG)).toEqual([])
  })

  test('treats the grace boundary as elapsed, so the period is exclusive', () => {
    const settled = order({ status: 'success', updatedAt: NOW - CFG.graceMs })

    expect(activeLines([settled], NOW, CFG)).toEqual([])
  })

  test('a shorter grace period drops what a longer one keeps', () => {
    const settled = order({ status: 'success', updatedAt: NOW - 5 * 60 * 1000 })

    const long = activeLines([settled], NOW, CFG)
    const short = activeLines([settled], NOW, { ...CFG, graceMs: 60 * 1000 })

    expect(long).toHaveLength(1)
    expect(short).toEqual([])
  })

  test('never expires a live order, however old it is', () => {
    const stale = order({ status: 'in-progress', updatedAt: NOW - 30 * 24 * 60 * 60 * 1000 })

    expect(activeLines([stale], NOW, CFG)).toHaveLength(1)
  })

  test('draws nothing for a status that is neither live nor settling', () => {
    const dead = order({ status: 'canceled' })

    expect(activeLines([dead], NOW, CFG)).toEqual([])
  })

  test('ignores an order whose updatedAt is in the future rather than dropping it', () => {
    const skewed = order({ status: 'success', updatedAt: NOW + 60_000 })

    expect(activeLines([skewed], NOW, CFG)).toHaveLength(1)
  })

  test('caps the result at maxLines, keeping the most recent orders', () => {
    // Arrange — 5 orders, oldest first, with room for only 3.
    const orders = Array.from({ length: 5 }, (_, i) =>
      order({ id: `o-${i}`, updatedAt: NOW - (5 - i) * 1000 }),
    )

    // Act
    const lines = activeLines(orders, NOW, { ...CFG, maxLines: 3 })

    // Assert
    expect(lines.map((l) => l.orderId)).toEqual(['o-4', 'o-3', 'o-2'])
  })

  test('is deterministic for orders sharing a timestamp', () => {
    const orders = [order({ id: 'b' }), order({ id: 'a' }), order({ id: 'c' })]

    const once = activeLines(orders, NOW, { ...CFG, maxLines: 2 })
    const twice = activeLines([...orders].reverse(), NOW, { ...CFG, maxLines: 2 })

    expect(once).toEqual(twice)
  })
})
