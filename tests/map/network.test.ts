import { describe, expect, test } from 'vitest'
import { networkLines, tradedCurrencies } from '~/map/network'

const A = 'a'.repeat(64)
const B = 'b'.repeat(64)

const instances = [
  {
    pubkey: A,
    currencies: [
      { code: 'ARS', created: 13, completed: 0, openNow: 3 },
      { code: 'USD', created: 2, completed: 0, openNow: 0 },
    ],
  },
  { pubkey: B, currencies: [{ code: 'ARS', created: 4, completed: 0, openNow: 1 }] },
]

describe('networkLines', () => {
  test('draws a line from every currency to the instance trading it', () => {
    // Act
    const lines = networkLines(instances)

    // Assert — every pair the publisher signed a figure for, and no other.
    const pairs = new Set(lines.map((line) => `${line.fiat}->${line.instancePubkey}`))
    expect(pairs).toEqual(new Set([`ARS->${A}`, `USD->${A}`, `ARS->${B}`]))
  })

  test('gives a busier pair more lines than a quieter one', () => {
    const lines = networkLines(instances)
    const count = (fiat: string, pubkey: string) =>
      lines.filter((l) => l.fiat === fiat && l.instancePubkey === pubkey).length

    expect(count('ARS', A)).toBeGreaterThan(count('USD', A))
  })

  test('never leaves a traded pair without a line', () => {
    // One order out of hundreds is still a trade the network made.
    const lines = networkLines([
      {
        pubkey: A,
        currencies: [{ code: 'ARS', created: 500, completed: 0, openNow: 0 }],
      },
      { pubkey: B, currencies: [{ code: 'ETB', created: 1, completed: 0, openNow: 0 }] },
    ])

    expect(lines.some((line) => line.fiat === 'ETB')).toBe(true)
  })

  test('draws nothing for a pair with no orders', () => {
    const lines = networkLines([
      { pubkey: A, currencies: [{ code: 'ARS', created: 0, completed: 0, openNow: 0 }] },
    ])

    expect(lines).toEqual([])
  })

  test('is deterministic however the documents arrived', () => {
    const forwards = networkLines(instances)
    const backwards = networkLines([...instances].reverse())

    expect(forwards).toEqual(backwards)
  })

  test('gives every line an id of its own', () => {
    const lines = networkLines(instances)

    expect(new Set(lines.map((l) => l.orderId)).size).toBe(lines.length)
  })

  test('draws nothing for a network with no instances', () => {
    expect(networkLines([])).toEqual([])
  })
})

describe('tradedCurrencies', () => {
  test('sums a currency across the instances trading it', () => {
    expect(tradedCurrencies(instances)).toEqual([
      { code: 'ARS', weight: 17 },
      { code: 'USD', weight: 2 },
    ])
  })

  test('is empty when nothing traded', () => {
    expect(tradedCurrencies([])).toEqual([])
  })
})
