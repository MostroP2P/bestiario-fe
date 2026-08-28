import { describe, expect, test } from 'vitest'
import { layoutLabels, type Label } from '~/map/labels'

function label(key: string, x: number, y: number, text = 'ARS'): Label {
  return { key, x, y, text }
}

describe('layoutLabels', () => {
  test('leaves labels that do not collide exactly where they were', () => {
    // Arrange
    const labels = [label('a', 0, 0), label('b', 0, 100), label('c', 500, 0)]

    // Act
    const laid = layoutLabels(labels)

    // Assert
    expect(laid).toEqual(labels)
  })

  test('pushes a colliding label down until it clears', () => {
    const laid = layoutLabels([label('a', 0, 0), label('b', 0, 2)], 10)

    expect(laid.map((l) => l.y)).toEqual([0, 10])
  })

  test('leaves a label alone when it only collides vertically', () => {
    // Far enough to the right that the two never share horizontal space.
    const laid = layoutLabels([label('a', 0, 0), label('b', 400, 2)], 10)

    expect(laid.map((l) => l.y)).toEqual([0, 2])
  })

  test('cascades, so pushing past one label does not land on the next', () => {
    const laid = layoutLabels(
      [label('a', 0, 0), label('b', 0, 1), label('c', 0, 2)],
      10,
    )

    expect(laid.map((l) => l.y)).toEqual([0, 10, 20])
  })

  test('keeps every label rather than dropping the ones in the way', () => {
    const labels = Array.from({ length: 8 }, (_, i) => label(`k${i}`, 0, i))

    expect(layoutLabels(labels)).toHaveLength(8)
  })

  test('never moves a label sideways, so it stays beside its node', () => {
    const laid = layoutLabels([label('a', 0, 0), label('b', 0, 1)], 10)

    expect(laid.map((l) => l.x)).toEqual([0, 0])
  })

  test('returns labels in the order it was given them', () => {
    const laid = layoutLabels([label('z', 0, 50), label('a', 0, 0)], 10)

    expect(laid.map((l) => l.key)).toEqual(['z', 'a'])
  })

  test('accounts for how wide a label is, not just where it starts', () => {
    // A long name reaches far enough right to collide with a distant short one.
    const laid = layoutLabels(
      [label('long', 0, 0, 'mostro.network'), label('short', 60, 2, 'ARS')],
      10,
    )

    expect(laid[1]!.y).toBe(10)
  })

  test('is stable for labels sharing a position', () => {
    const labels = [label('b', 0, 0), label('a', 0, 0)]

    expect(layoutLabels(labels, 10)).toEqual(layoutLabels([...labels].reverse(), 10).reverse())
  })

  test('handles an empty map', () => {
    expect(layoutLabels([])).toEqual([])
  })
})
