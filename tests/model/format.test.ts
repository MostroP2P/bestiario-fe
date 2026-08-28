import { describe, expect, test } from 'vitest'
import { ABSENT, formatAge, formatDuration, formatMetric, formatValue } from '~/model/format'
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
    expect(formatted.absent).toBe(true)
  })

  test('a missing figure says it was not measured, not that it is zero', () => {
    const formatted = formatValue(null, 'missing')

    expect(formatted.label).toBe('no medido')
  })

  test('an absent figure carries a label a screen reader can say', () => {
    expect(formatValue(null, 'count').label).not.toBe(ABSENT)
  })
})

describe('formatMetric', () => {
  test('says a figure was never published, which is not the same as null', () => {
    expect(formatMetric(undefined).label).toBe('no publicado')
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
    expect(formatValue('twelve', 'count').absent).toBe(true)
  })

  test('sats that are not a number', () => {
    expect(formatValue('lots', 'sats').absent).toBe(true)
  })

  test('a ratio that is not a number', () => {
    expect(formatValue('half', 'ratio').absent).toBe(true)
  })

  test('seconds that are not a number', () => {
    expect(formatValue('ages', 'seconds').absent).toBe(true)
  })

  test('a fiat figure that is neither an object nor a number', () => {
    expect(formatValue('pesos', 'fiat').absent).toBe(true)
  })

  test('text that is not a string', () => {
    expect(formatValue(42, 'text').absent).toBe(true)
  })

  test('a date that is not a string', () => {
    expect(formatValue(42, 'date').absent).toBe(true)
  })
})
