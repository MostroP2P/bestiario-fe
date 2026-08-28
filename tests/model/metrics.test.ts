import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { fiatRows, indexedFamily, lookup, metricsOf } from '~/model/metrics'
import type { Envelope, Metric } from '~/nostr/documents'

function payloadOf(file: string) {
  const event = JSON.parse(readFileSync(`tests/fixtures/snapshot/${file}`, 'utf8')) as {
    content: string
  }
  return (JSON.parse(event.content) as Envelope).payload
}

const volume = metricsOf(payloadOf('volume-all.json'))
const disputes = metricsOf(payloadOf('disputes-all.json'))
const series = metricsOf(payloadOf('series-volume-daily-2026-08.json'))

describe('metricsOf', () => {
  test('reads a window payload', () => {
    expect(volume.length).toBeGreaterThan(50)
  })

  test('reads nothing from a series, which has columns and not metrics', () => {
    expect(series).toEqual([])
  })

  test('reads nothing from a payload that is not there', () => {
    expect(metricsOf(undefined)).toEqual([])
  })
})

describe('lookup', () => {
  test('finds a figure by name', () => {
    expect(lookup(volume, 'volume.sats')?.value).toBe(7378280)
  })

  test('is undefined for a name nothing published', () => {
    expect(lookup(volume, 'volume.nonexistent')).toBeUndefined()
  })
})

describe('fiatRows', () => {
  test('groups the currencies the network actually traded', () => {
    // Arrange / Act
    const rows = fiatRows(volume)

    // Assert — every code in the live archive, in order.
    expect(rows.map((row) => row.code)).toEqual([
      'ARS',
      'BRL',
      'COP',
      'CUP',
      'EUR',
      'MXN',
      'USD',
      'VES',
    ])
  })

  test('keeps each currency figures under their own names', () => {
    const ars = fiatRows(volume).find((row) => row.code === 'ARS')!

    expect([...ars.figures.keys()].sort()).toEqual([
      'orders',
      'ticket_avg',
      'ticket_p50',
      'ticket_p90',
      'total',
    ])
    expect(ars.figures.get('orders')?.value).toBe(9)
  })

  test('ignores a name that does not fit the pattern rather than guessing', () => {
    const odd: Metric[] = [
      { name: 'volume.fiat.lowercase.total', kind: 'observed', unit: 'count', value: 1 },
      { name: 'volume.fiat.ARS', kind: 'observed', unit: 'count', value: 1 },
      { name: 'volume.sats', kind: 'observed', unit: 'sats', value: 1 },
    ]

    expect(fiatRows(odd)).toEqual([])
  })

  test('does not mistake the reference currency for a traded one', () => {
    // `volume.in.USD.*` is inferred and is a different family.
    const rows = fiatRows(volume)
    const usd = rows.find((row) => row.code === 'USD')!

    expect(usd.figures.get('total')?.kind).toBe('observed')
  })
})

describe('indexedFamily', () => {
  test('rebuilds the open dispute book into one record per entry', () => {
    const open = indexedFamily(disputes, 'disputes.open')

    expect(open.length).toBeGreaterThan(10)
    expect(open[0]?.index).toBe(1)
    expect(open[0]?.figures.get('id')?.unit).toBe('text')
    expect(open[0]?.figures.get('age')?.unit).toBe('seconds')
  })

  test('orders by the publisher index and not by string', () => {
    const open = indexedFamily(disputes, 'disputes.open')
    const indices = open.map((entry) => entry.index)

    expect(indices).toEqual([...indices].sort((a, b) => a - b))
  })

  test('is empty for a family nothing published', () => {
    expect(indexedFamily(disputes, 'disputes.closed')).toEqual([])
  })
})
