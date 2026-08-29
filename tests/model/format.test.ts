import { describe, expect, test } from 'vitest'
import {
  ABSENT,
  formatAge,
  formatDuration,
  formatMetric,
  formatSum,
  formatValue,
} from '~/model/format'
import type { Metric } from '~/nostr/documents'

describe('formatValue · by unit', () => {
  test('a count is an integer', () => {
    expect(formatValue(1482093, 'count').text).toMatch(/1.482.093|1,482,093/)
  })

  test('sats keep their unit and are never turned into BTC', () => {
    const formatted = formatValue(7378280, 'sats')

    expect(formatted.text).toContain('sats')
    expect(formatted.text).not.toContain('BTC')
  })

  test('a ratio is a percentage to one decimal', () => {
    expect(formatValue(0.2459016393442623, 'ratio').text).toMatch(/^24[.,]6 %$/)
  })

  test('a fiat figure carries its code', () => {
    expect(formatValue({ amount: 422550, code: 'ARS' }, 'fiat').text).toContain('ARS')
  })

  test('a bare fiat cell formats without a code, which it does not carry', () => {
    expect(formatValue(114400, 'fiat').text).not.toContain('undefined')
  })

  test('text is verbatim', () => {
    expect(formatValue('2f762ab3-becd', 'text').text).toBe('2f762ab3-becd')
  })
})

describe('formatValue · absence', () => {
  test('null is an em dash and never a zero', () => {
    const formatted = formatValue(null, 'sats')

    expect(formatted.text).toBe(ABSENT)
    expect(formatted.text).not.toBe('0')
    expect(formatted.absence).toBe('noData')
  })

  test('a missing figure says it was not measured, not that it is zero', () => {
    const formatted = formatValue(null, 'missing')

    expect(formatted.absence).toBe('notMeasured')
  })

  test('says which absence it is, so a reader can be told', () => {
    // A kind and not a sentence: this module knows no language.
    expect(formatValue(null, 'count').absence).toBe('noData')
  })
})

describe('formatMetric', () => {
  test('says a figure was never published, which is not the same as null', () => {
    expect(formatMetric(undefined).absence).toBe('notPublished')
  })

  test('formats a real metric by its own unit', () => {
    const metric: Metric = {
      name: 'volume.sats',
      kind: 'observed',
      unit: 'sats',
      value: 7378280,
    }

    expect(formatMetric(metric).text).toContain('sats')
  })
})

describe('formatDuration', () => {
  test('reads seconds under a minute', () => {
    expect(formatDuration(41)).toBe('41 s')
  })

  test('reads minutes and seconds', () => {
    expect(formatDuration(184)).toBe('3 m 04 s')
  })

  test('reads hours and minutes', () => {
    expect(formatDuration(15120)).toBe('4 h 12 m')
  })

  test('reads days and hours', () => {
    expect(formatDuration(18476950)).toMatch(/^213 d \d\d h$/)
  })

  test('never reads negative', () => {
    expect(formatDuration(-10)).toBe('0 s')
  })
})

describe('formatAge', () => {
  test('measures from the signed created_at and not from a published claim', () => {
    const createdAt = 1_700_000_000

    expect(formatAge(createdAt, (createdAt + 7200) * 1000)).toBe('2 h 00 m')
  })

  test('never reads negative when a publisher clock runs ahead', () => {
    const createdAt = 1_700_000_000

    expect(formatAge(createdAt, (createdAt - 60) * 1000)).toBe('0 s')
  })
})

describe('formatValue · a document that does not fit its own unit', () => {
  // A malformed document must render as absence, never crash a panel.
  test('a count that is not a number', () => {
    expect(formatValue('twelve', 'count').absence).not.toBeNull()
  })

  test('sats that are not a number', () => {
    expect(formatValue('lots', 'sats').absence).not.toBeNull()
  })

  test('a ratio that is not a number', () => {
    expect(formatValue('half', 'ratio').absence).not.toBeNull()
  })

  test('seconds that are not a number', () => {
    expect(formatValue('ages', 'seconds').absence).not.toBeNull()
  })

  test('a fiat figure that is neither an object nor a number', () => {
    expect(formatValue('pesos', 'fiat').absence).not.toBeNull()
  })

  test('text that is not a string', () => {
    expect(formatValue(42, 'text').absence).not.toBeNull()
  })

  test('a date that is not a string', () => {
    expect(formatValue(42, 'date').absence).not.toBeNull()
  })
})

describe('formatSum · a denominator the publisher signed for, added', () => {
  const count = (name: string, value: number | null): Metric => ({
    name,
    kind: 'observed',
    unit: 'count',
    value,
  })

  test('adds two published counts', () => {
    // Arrange
    const completed = count('orders.completed', 24)
    const canceled = count('orders.canceled', 67)

    // Act
    const sum = formatSum([completed, canceled])

    // Assert — 91, the orders that reached an end.
    expect(sum.absence).toBeNull()
    expect(sum.text).toMatch(/^91$/)
  })

  test('states the absence rather than a partial sum when one side is unpublished', () => {
    expect(formatSum([count('orders.completed', 24), undefined]).text).toBe(ABSENT)
    expect(formatSum([count('orders.completed', 24), undefined]).absence).toBe(
      'notPublished',
    )
  })

  test('states the absence rather than a partial sum when one side is null', () => {
    const sum = formatSum([count('orders.completed', 24), count('orders.canceled', null)])
    expect(sum.text).toBe(ABSENT)
    expect(sum.absence).toBe('noData')
  })

  test('keeps a figure the publisher could not measure a different absence', () => {
    const missing: Metric = {
      name: 'orders.canceled',
      kind: 'observed',
      unit: 'missing',
      value: null,
    }
    expect(formatSum([count('orders.completed', 24), missing]).absence).toBe(
      'notMeasured',
    )
  })

  test('refuses to add a count whose value is not a number', () => {
    const wrong: Metric = {
      name: 'orders.canceled',
      kind: 'observed',
      unit: 'count',
      value: 'sixty-seven',
    } as unknown as Metric
    expect(formatSum([count('orders.completed', 24), wrong]).absence).toBe('noData')
  })

  test('refuses to add anything that is not a count', () => {
    const rate: Metric = {
      name: 'orders.completion_rate',
      kind: 'observed',
      unit: 'ratio',
      value: 0.26,
    }
    expect(formatSum([count('orders.completed', 24), rate]).absence).not.toBeNull()
  })
})
