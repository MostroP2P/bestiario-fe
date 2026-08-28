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
    // Structure, not the market of the day: these fixtures are regenerated
    // from the live relays and the figures move with the archive.
    expect(volume.length).toBeGreaterThan(5)
    expect(volume.every((metric) => typeof metric.name === 'string')).toBe(true)
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
    const sats = lookup(volume, 'volume.sats')

    expect(sats?.unit).toBe('sats')
    expect(typeof sats?.value).toBe('number')
  })

  test('is undefined for a name nothing published', () => {
    expect(lookup(volume, 'volume.nonexistent')).toBeUndefined()
  })
})

describe('fiatRows', () => {
  test('groups the currencies the network actually traded', () => {
    // Arrange — read the expected set out of the document itself, so this
    // asserts the grouping and never a snapshot of the market.
    const expected = [
      ...new Set(
        volume
          .map((metric) => /^volume\.fiat\.([A-Z]{3})\./.exec(metric.name)?.[1])
          .filter((code): code is string => code !== undefined),
      ),
    ].sort()

    // Act
    const rows = fiatRows(volume)

    // Assert
    expect(rows.map((row) => row.code)).toEqual(expected)
    expect(expected.length).toBeGreaterThan(0)
  })

  test('keeps each currency figures under their own names', () => {
    const row = fiatRows(volume)[0]!

    expect([...row.figures.keys()].sort()).toEqual([
      'orders',
      'ticket_avg',
      'ticket_p50',
      'ticket_p90',
      'total',
    ])
    expect(typeof row.figures.get('orders')?.value).toBe('number')
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
    // `volume.in.USD.*` is inferred and is a different family; every row
    // here comes from `volume.fiat.*`, which is observed.
    for (const row of fiatRows(volume)) {
      expect(row.figures.get('total')?.kind, row.code).toBe('observed')
    }
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
