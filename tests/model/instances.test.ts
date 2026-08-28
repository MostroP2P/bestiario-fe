import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { currencyOrders, instanceRows } from '~/model/instances'
import { metricsOf } from '~/model/metrics'
import type { Envelope, Metric } from '~/nostr/documents'

const PUBKEY = '82fa8cb978b43c79b2156585bac2c011176a21d2aead6d9f7c575c005be88390'

function payloadOf(file: string) {
  const event = JSON.parse(readFileSync(`tests/fixtures/snapshot/${file}`, 'utf8')) as {
    content: string
  }
  return (JSON.parse(event.content) as Envelope).payload
}

function text(name: string, value: string): Metric {
  return { name, kind: 'observed', unit: 'text', value }
}

function count(name: string, value: number): Metric {
  return { name, kind: 'observed', unit: 'count', value }
}

describe('instanceRows · the live document', () => {
  const rows = instanceRows(metricsOf(payloadOf('instances-all.json')))

  test('reads the instances the archive knows', () => {
    expect(rows.length).toBeGreaterThan(0)
  })

  test('reads the pubkey from its row and not from the label', () => {
    // The label is `Mostro (82fa8cb9)`: a display string, not an address.
    expect(rows[0]?.pubkey).toBe(PUBKEY)
    expect(rows[0]?.label).not.toBe(PUBKEY)
  })

  test('reads what the instance calls itself', () => {
    expect(rows[0]?.name).toBe('Mostro')
  })

  test('reads how many orders it created', () => {
    expect(rows[0]?.created).toBeGreaterThan(0)
  })
})

describe('instanceRows · names that would break a careless parser', () => {
  test('keeps a label that contains dots', () => {
    // Split from the right: `mostro.network (ab)` is a label, not a path.
    const metrics = [
      text('instances.mostro.network (ab12).pubkey', PUBKEY),
      text('instances.mostro.network (ab12).name', 'mostro.network'),
      count('instances.mostro.network (ab12).created', 7),
    ]

    const rows = instanceRows(metrics)

    expect(rows).toHaveLength(1)
    expect(rows[0]?.label).toBe('mostro.network (ab12)')
    expect(rows[0]?.name).toBe('mostro.network')
    expect(rows[0]?.created).toBe(7)
  })

  test('keeps a label with spaces, parentheses and an emoji', () => {
    const metrics = [
      text('instances.Mostro 🇦🇷 (82fa8cb9).pubkey', PUBKEY),
      text('instances.Mostro 🇦🇷 (82fa8cb9).name', 'Mostro 🇦🇷'),
    ]

    expect(instanceRows(metrics)[0]?.name).toBe('Mostro 🇦🇷')
  })

  test('drops a block with no pubkey, which nothing can address', () => {
    const metrics = [text('instances.Ghost (00).name', 'Ghost')]

    expect(instanceRows(metrics)).toEqual([])
  })

  test('drops a block whose pubkey is not 64 lowercase hex', () => {
    // A prefix is a collision waiting to be found.
    const metrics = [
      text('instances.Short (ab).pubkey', 'abcd'),
      text('instances.Upper (AB).pubkey', PUBKEY.toUpperCase()),
    ]

    expect(instanceRows(metrics)).toEqual([])
  })

  test('falls back to the label when the block names no name', () => {
    const metrics = [text('instances.Unnamed (ab12).pubkey', PUBKEY)]

    expect(instanceRows(metrics)[0]?.name).toBe('Unnamed (ab12)')
  })

  test('ignores metrics from another family', () => {
    expect(instanceRows([count('orders.created', 5)])).toEqual([])
  })
})

describe('currencyOrders', () => {
  test('reads one block per currency the instance traded', () => {
    // Arrange — the shape PR #74 publishes.
    const metrics = [
      count('orders.created', 16),
      count('orders.ARS.created', 13),
      count('orders.ARS.open_now', 3),
      count('orders.USD.created', 2),
    ]

    // Act
    const rows = currencyOrders(metrics)

    // Assert
    expect(rows).toEqual([
      { code: 'ARS', created: 13, openNow: 3 },
      { code: 'USD', created: 2, openNow: 0 },
    ])
  })

  test('does not mistake the instance total for a currency', () => {
    expect(currencyOrders([count('orders.created', 16)])).toEqual([])
  })

  test('does not mistake a lowercase or long segment for a code', () => {
    const metrics = [
      count('orders.completion_rate', 1),
      count('orders.ars.created', 1),
      count('orders.ARSX.created', 1),
    ]

    expect(currencyOrders(metrics)).toEqual([])
  })

  test('orders the currencies, so the map is stable', () => {
    const metrics = [
      count('orders.VES.created', 1),
      count('orders.ARS.created', 1),
      count('orders.COP.created', 1),
    ]

    expect(currencyOrders(metrics).map((r) => r.code)).toEqual(['ARS', 'COP', 'VES'])
  })

  test('is empty for an instance that traded nothing', () => {
    expect(currencyOrders([])).toEqual([])
  })
})

describe('instanceRows · malformed names', () => {
  test('ignores a name with nothing after the prefix', () => {
    expect(instanceRows([text('instances.', 'x')])).toEqual([])
  })

  test('ignores a name with no figure after the label', () => {
    // `instances.Mostro.` names a block and no figure.
    expect(instanceRows([text('instances.Mostro.', 'x')])).toEqual([])
  })

  test('ignores a name with no dot to split on', () => {
    expect(instanceRows([text('instances.Mostro', 'x')])).toEqual([])
  })
})

describe('currencyOrders · malformed names', () => {
  test('ignores a name with no segment after orders', () => {
    expect(currencyOrders([count('orders.', 1)])).toEqual([])
  })

  test('ignores a bare figure with no currency segment', () => {
    expect(currencyOrders([count('orders.created', 1)])).toEqual([])
  })

  test('ignores a metric from another family entirely', () => {
    // A scoped document carries only `orders.*`, but nothing stops a future
    // one carrying more, and a stray family must not become a currency.
    expect(currencyOrders([count('volume.fiat.ARS.orders', 9)])).toEqual([])
  })
})
