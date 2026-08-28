import { describe, expect, test } from 'vitest'
import { BACKOFF, MAP, TIMEOUTS } from '~/config'

describe('map configuration', () => {
  test('live and settling statuses are disjoint', () => {
    // Arrange
    const live = new Set<string>(MAP.liveStatuses)

    // Act
    const overlap = MAP.settlingStatuses.filter((s) => live.has(s))

    // Assert — a status in both sets would make the grace period unreachable.
    expect(overlap).toEqual([])
  })

  test('grace period is a positive duration', () => {
    expect(MAP.graceMs).toBeGreaterThan(0)
  })

  test('caps the number of lines drawn at once', () => {
    expect(MAP.maxLines).toBeGreaterThan(0)
  })
})

describe('timeouts', () => {
  test('the staleness alarm is later than the warning', () => {
    expect(TIMEOUTS.stalenessAlarm).toBeGreaterThan(TIMEOUTS.stalenessWarning)
  })

  test('backoff is capped above its initial delay', () => {
    expect(BACKOFF.maxMs).toBeGreaterThan(BACKOFF.initialMs)
  })
})
