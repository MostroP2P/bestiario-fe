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

  test('a settled order keeps its line for an hour', () => {
    expect(MAP.graceMs).toBe(60 * 60 * 1000)
  })

  test('draws a trade in course, and not an order nobody has taken', () => {
    expect(MAP.liveStatuses).toContain('in-progress')
    expect(MAP.liveStatuses).not.toContain('pending')
  })

  test('keeps a completed order for its grace period and nothing that failed', () => {
    expect(MAP.settlingStatuses).toContain('success')
    for (const failed of ['canceled', 'expired', 'canceled-by-admin']) {
      expect([...MAP.liveStatuses, ...MAP.settlingStatuses]).not.toContain(failed)
    }
  })

  test('lets a trade in course go quiet for longer than it can last', () => {
    expect(MAP.liveWindowMs).toBeGreaterThan(MAP.graceMs)
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
