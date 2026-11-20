import { describe, expect, test } from 'vitest'
import { duration } from '~/model/timing'
import type { Metric } from '~/nostr/documents'

/**
 * The SPEC §6.4 durations bestiario signs in `orders:<w>` — and the names it
 * signs them under, which are a contract with the daemon.
 */

const observed = (
  name: string,
  unit: Metric['unit'],
  value: Metric['value'],
): Metric => ({
  name,
  kind: 'observed',
  unit,
  value,
})

describe('duration', () => {
  test('reads the median, the p90 and the sample count of one stage', () => {
    // Arrange
    const metrics = [
      observed('orders.completed', 'count', 1204),
      observed('timing.time_to_complete_samples', 'count', 20),
      observed('timing.time_to_complete_p50', 'seconds', 486),
      observed('timing.time_to_complete_p90', 'seconds', 1630),
      observed('timing.full_cycle_p50', 'seconds', 45_000),
    ]

    // Act
    const completion = duration(metrics, 'time_to_complete')

    // Assert — that stage's three figures and no other stage's.
    expect(completion.p50?.value).toBe(486)
    expect(completion.p90?.value).toBe(1630)
    expect(completion.samples?.value).toBe(20)
  })

  test('carries an empty sample through as the publisher signed it', () => {
    // A window with nothing measured is `0` samples and missing
    // percentiles — never a zero duration, which would read as instant.
    const metrics = [
      observed('timing.time_to_complete_samples', 'count', 0),
      observed('timing.time_to_complete_p50', 'missing', null),
      observed('timing.time_to_complete_p90', 'missing', null),
    ]

    const completion = duration(metrics, 'time_to_complete')

    expect(completion.samples?.value).toBe(0)
    expect(completion.p50).toEqual(
      observed('timing.time_to_complete_p50', 'missing', null),
    )
    expect(completion.p90?.value).toBeNull()
  })

  test('is absent in every figure when the document predates them', () => {
    // A snapshot from before bestiario published durations has none of the
    // records, and nothing here may stand in for them.
    const completion = duration(
      [observed('orders.completed', 'count', 12)],
      'time_to_complete',
    )

    expect(completion).toEqual({ p50: undefined, p90: undefined, samples: undefined })
  })
})
