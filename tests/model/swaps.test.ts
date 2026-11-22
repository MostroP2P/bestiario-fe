import { describe, expect, test } from 'vitest'
import { splitSwaps, swapCount, swapRail } from '~/model/swaps'
import type { FiatRow } from '~/model/metrics'
import type { Metric } from '~/nostr/documents'

function row(code: string, completed?: number): FiatRow {
  const figures = new Map<string, Metric>()
  if (completed !== undefined) {
    figures.set('completed', {
      name: `volume.fiat.${code}.completed`,
      kind: 'observed',
      unit: 'count',
      value: completed,
    })
  }
  return { code, figures }
}

describe('swapRail', () => {
  test('names the rail of each BTC-pegged code, in any casing', () => {
    expect(swapRail('BTC')).toBe('onchain')
    expect(swapRail('LBTC')).toBe('liquid')
    expect(swapRail('RBTC')).toBe('rootstock')
    expect(swapRail('rbtc')).toBe('rootstock')
  })

  test('is null for fiat and for stablecoins, which are priced as fiat', () => {
    for (const code of ['USD', 'COP', 'USDT', 'USDC', 'DOC']) {
      expect(swapRail(code), code).toBeNull()
    }
  })
})

describe('splitSwaps', () => {
  test('takes the swap rows out of the currencies and keeps both in order', () => {
    // Arrange
    const rows = [row('BTC'), row('COP'), row('RBTC'), row('USDT')]

    // Act
    const { fiat, swaps } = splitSwaps(rows)

    // Assert
    expect(fiat.map((r) => r.code)).toEqual(['COP', 'USDT'])
    expect(swaps.map((r) => r.code)).toEqual(['BTC', 'RBTC'])
  })

  test('leaves the currencies alone when nothing was a swap', () => {
    const rows = [row('ARS'), row('EUR')]

    expect(splitSwaps(rows)).toEqual({ fiat: rows, swaps: [] })
  })
})

describe('swapCount', () => {
  test('adds the completed swaps across rails', () => {
    expect(swapCount([row('BTC', 5), row('LBTC', 2)])).toBe(7)
  })

  test('is absent when a rail did not publish its count, rather than a short sum', () => {
    expect(swapCount([row('BTC', 5), row('RBTC')])).toBeNull()
  })

  test('is absent over no rails', () => {
    expect(swapCount([])).toBeNull()
  })
})
