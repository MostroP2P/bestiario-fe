import { describe, expect, test } from 'vitest'
import { buildGrid, heatLevel } from '~/model/matrix'
import type { Line } from '~/model/live-lines'

function line(instancePubkey: string, fiat: string, orderId: string): Line {
  return { orderId, fiat, instancePubkey, phase: 'live', updatedAt: 0 }
}

describe('buildGrid', () => {
  test('counts the lines on each instance and currency pair', () => {
    // Arrange
    const lines = [
      line('k1', 'ARS', 'a'),
      line('k1', 'ARS', 'b'),
      line('k1', 'VES', 'c'),
      line('k2', 'VES', 'd'),
    ]

    // Act
    const grid = buildGrid(lines, ['k1', 'k2'], ['ARS', 'VES'])

    // Assert
    expect(grid.counts).toEqual([
      [2, 1],
      [0, 1],
    ])
    expect(grid.peak).toBe(2)
  })

  test('is all zeroes when nothing is trading', () => {
    const grid = buildGrid([], ['k1'], ['ARS'])

    expect(grid.counts).toEqual([[0]])
    expect(grid.peak).toBe(0)
  })

  test('ignores a pair outside the requested rows and columns', () => {
    const grid = buildGrid([line('k9', 'XXX', 'a')], ['k1'], ['ARS'])

    expect(grid.counts).toEqual([[0]])
  })
})

describe('heatLevel', () => {
  test('is nothing for no lines', () => {
    expect(heatLevel(0, 10)).toBe(0)
  })

  test('is nothing when there is no peak to scale against', () => {
    expect(heatLevel(0, 0)).toBe(0)
  })

  test('reaches the top at the peak', () => {
    expect(heatLevel(10, 10)).toBe(4)
  })

  test('never renders a real line as an empty cell', () => {
    expect(heatLevel(1, 100)).toBe(1)
  })

  test('climbs with the count', () => {
    const levels = [1, 3, 6, 9, 12].map((c) => heatLevel(c, 12))

    expect(levels).toEqual([...levels].sort((a, b) => a - b))
  })
})
