import { describe, expect, test } from 'vitest'
import { DEFAULT_FIAT_SORT, nextSort, sortFiatRows } from '~/model/sort-fiat'
import type { FiatRow } from '~/model/metrics'
import type { Metric, MetricValue } from '~/nostr/documents'

/**
 * Ordering the per-currency table.
 *
 * The rules a reader depends on: the busiest market opens the table, a figure
 * nobody published never outranks one that was, and the order is total — two
 * rows that tie still land in the same place on every render.
 */

function metric(name: string, value: MetricValue): Metric {
  return { name, kind: 'observed', unit: 'count', value }
}

function row(code: string, figures: Record<string, MetricValue | undefined>): FiatRow {
  const map = new Map<string, Metric>()
  for (const [figure, value] of Object.entries(figures)) {
    if (value === undefined) continue
    map.set(figure, metric(`volume.fiat.${code}.${figure}`, value))
  }
  return { code, figures: map }
}

const ARS = row('ARS', { orders: 4, total: { amount: 318_400, code: 'ARS' } })
const MXN = row('MXN', { orders: 7, total: { amount: 12_150, code: 'MXN' } })
const USD = row('USD', { orders: 7, total: { amount: 151, code: 'USD' } })
const PEN = row('PEN', { orders: 1, total: { amount: 500, code: 'PEN' } })
const rows = [ARS, MXN, PEN, USD]

const codes = (sorted: readonly FiatRow[]) => sorted.map((r) => r.code)

describe('the default order', () => {
  test('opens with the market carrying the most orders', () => {
    // Arrange / Act
    const sorted = sortFiatRows(rows, DEFAULT_FIAT_SORT)

    // Assert — orders is the one column comparable across currencies.
    expect(codes(sorted)).toEqual(['MXN', 'USD', 'ARS', 'PEN'])
  })

  test('breaks a tie by code, so the order never shuffles between renders', () => {
    // MXN and USD both published 7 orders.
    expect(codes(sortFiatRows(rows, DEFAULT_FIAT_SORT)).slice(0, 2)).toEqual([
      'MXN',
      'USD',
    ])
    expect(
      codes(sortFiatRows([...rows].reverse(), DEFAULT_FIAT_SORT)).slice(0, 2),
    ).toEqual(['MXN', 'USD'])
  })

  test('leaves the rows it was handed untouched', () => {
    const given = [...rows]
    sortFiatRows(given, DEFAULT_FIAT_SORT)
    expect(codes(given)).toEqual(['ARS', 'MXN', 'PEN', 'USD'])
  })
})

describe('sorting by a column', () => {
  test('ranks a figure column from largest to smallest when descending', () => {
    expect(codes(sortFiatRows(rows, { key: 'total', direction: 'desc' }))).toEqual([
      'ARS',
      'MXN',
      'PEN',
      'USD',
    ])
  })

  test('ranks it from smallest to largest when ascending', () => {
    expect(codes(sortFiatRows(rows, { key: 'total', direction: 'asc' }))).toEqual([
      'USD',
      'PEN',
      'MXN',
      'ARS',
    ])
  })

  test('sorts the currency column by its code', () => {
    expect(codes(sortFiatRows(rows, { key: 'code', direction: 'asc' }))).toEqual([
      'ARS',
      'MXN',
      'PEN',
      'USD',
    ])
    expect(codes(sortFiatRows(rows, { key: 'code', direction: 'desc' }))).toEqual([
      'USD',
      'PEN',
      'MXN',
      'ARS',
    ])
  })
})

describe('a figure the publisher did not give', () => {
  const silent = row('BRL', { orders: undefined })
  const nulled = row('COP', { orders: null })
  const some = [ARS, silent, nulled, PEN]

  test('sinks to the bottom when the column is descending', () => {
    expect(codes(sortFiatRows(some, { key: 'orders', direction: 'desc' }))).toEqual([
      'ARS',
      'PEN',
      'BRL',
      'COP',
    ])
  })

  test('stays at the bottom when the column is ascending, since absence is not a low value', () => {
    expect(codes(sortFiatRows(some, { key: 'orders', direction: 'asc' }))).toEqual([
      'PEN',
      'ARS',
      'BRL',
      'COP',
    ])
  })

  test('treats a figure that is not a number as unrankable rather than as zero', () => {
    const worded = row('CLP', { orders: 'many' })
    expect(
      codes(sortFiatRows([worded, PEN], { key: 'orders', direction: 'desc' })),
    ).toEqual(['PEN', 'CLP'])
  })

  test('refuses to rank a value that is not finite, which no comparison orders', () => {
    const broken = row('CLP', { orders: Number.NaN })
    expect(
      codes(sortFiatRows([broken, PEN], { key: 'orders', direction: 'desc' })),
    ).toEqual(['PEN', 'CLP'])
  })
})

describe('what a click on a heading does', () => {
  test('opens a newly chosen figure column at its largest value', () => {
    expect(nextSort({ key: 'orders', direction: 'desc' }, 'total')).toEqual({
      key: 'total',
      direction: 'desc',
    })
  })

  test('opens the currency column at A, where an alphabet starts', () => {
    expect(nextSort({ key: 'orders', direction: 'desc' }, 'code')).toEqual({
      key: 'code',
      direction: 'asc',
    })
  })

  test('flips the column already sorted', () => {
    expect(nextSort({ key: 'total', direction: 'desc' }, 'total')).toEqual({
      key: 'total',
      direction: 'asc',
    })
    expect(nextSort({ key: 'total', direction: 'asc' }, 'total')).toEqual({
      key: 'total',
      direction: 'desc',
    })
  })
})
