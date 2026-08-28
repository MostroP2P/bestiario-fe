import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  parseAddress,
  printAddress,
  RESOLUTIONS,
  REPORTS,
  WINDOWS,
  type Address,
} from '~/nostr/address'

const INSTANCE = 'a'.repeat(64)

describe('printAddress and parseAddress are inverses', () => {
  test('over every window address the grammar generates', () => {
    // Arrange / Act / Assert
    for (const report of REPORTS) {
      for (const window of WINDOWS) {
        const address: Address = { kind: 'window', report, window }
        expect(parseAddress(printAddress(address))).toEqual(address)
      }
    }
  })

  test('over every series address the grammar generates', () => {
    for (const report of REPORTS) {
      for (const resolution of RESOLUTIONS) {
        const bucket = resolution === 'monthly' ? '2026' : '2026-08'
        const address: Address = { kind: 'series', report, resolution, bucket }
        expect(parseAddress(printAddress(address))).toEqual(address)
      }
    }
  })

  test('over the index', () => {
    expect(parseAddress('index')).toEqual({ kind: 'index' })
    expect(printAddress({ kind: 'index' })).toBe('index')
  })

  test('over a scoped address, which nothing publishes yet', () => {
    const address: Address = {
      kind: 'window',
      report: 'orders',
      window: '30d',
      scope: { instance: INSTANCE },
    }

    expect(printAddress(address)).toBe(`orders:30d:i:${INSTANCE}`)
    expect(parseAddress(printAddress(address))).toEqual(address)
  })

  test('over a network scope', () => {
    const address: Address = {
      kind: 'window',
      report: 'volume',
      window: 'all',
      scope: { network: 'mainnet' },
    }

    expect(parseAddress(printAddress(address))).toEqual(address)
  })
})

describe('parseAddress rejects', () => {
  test('a report it does not know', () => {
    expect(parseAddress('orderz:30d')).toBeNull()
  })

  test('a window it does not know', () => {
    expect(parseAddress('orders:31d')).toBeNull()
  })

  test('anything with a capital letter, rather than folding it', () => {
    // A typo must be a miss, never a fuzzy match.
    expect(parseAddress('Orders:30d')).toBeNull()
    expect(parseAddress('orders:30D')).toBeNull()
  })

  test('a daily bucket that is not a month', () => {
    expect(parseAddress('series:orders:daily:2026')).toBeNull()
    expect(parseAddress('series:orders:daily:2026-13')).toBeNull()
    expect(parseAddress('series:orders:daily:2026-00')).toBeNull()
  })

  test('a monthly bucket that is not a year', () => {
    expect(parseAddress('series:orders:monthly:2026-08')).toBeNull()
  })

  test('a resolution it does not know', () => {
    expect(parseAddress('series:orders:hourly:2026-08')).toBeNull()
  })

  test('an instance scope that is not a full pubkey', () => {
    // A prefix is a collision waiting to be found.
    expect(parseAddress('orders:30d:i:abcd')).toBeNull()
    expect(parseAddress(`orders:30d:i:${'A'.repeat(64)}`)).toBeNull()
  })

  test('a scope marker it does not know', () => {
    expect(parseAddress('orders:30d:x:mainnet')).toBeNull()
  })

  test('a truncated address', () => {
    expect(parseAddress('orders')).toBeNull()
    expect(parseAddress('series:orders:daily')).toBeNull()
    expect(parseAddress('')).toBeNull()
  })
})

describe('the addresses the publisher actually uses', () => {
  const manifest = JSON.parse(
    readFileSync('tests/fixtures/snapshot/manifest.json', 'utf8'),
  ) as { documents: string[] }

  test('every one of them parses', () => {
    for (const d of manifest.documents) {
      expect(parseAddress(d), d).not.toBeNull()
    }
  })

  test('and prints back to itself', () => {
    for (const d of manifest.documents) {
      expect(printAddress(parseAddress(d)!)).toBe(d)
    }
  })
})

describe('a scoped series address, which nothing publishes yet', () => {
  test('round-trips', () => {
    const address: Address = {
      kind: 'series',
      report: 'orders',
      resolution: 'monthly',
      bucket: '2026',
      scope: { instance: INSTANCE },
    }

    expect(printAddress(address)).toBe(`series:orders:monthly:2026:i:${INSTANCE}`)
    expect(parseAddress(printAddress(address))).toEqual(address)
  })

  test('rejects a series scope that is malformed', () => {
    expect(parseAddress('series:orders:monthly:2026:i')).toBeNull()
  })
})

describe('parseAddress rejects an empty scope value', () => {
  test('an instance scope with nothing after the marker', () => {
    expect(parseAddress('orders:30d:i:')).toBeNull()
  })

  test('a network scope with nothing after the marker', () => {
    expect(parseAddress('orders:30d:n:')).toBeNull()
  })
})
