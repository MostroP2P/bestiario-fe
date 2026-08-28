import { describe, expect, test } from 'vitest'
import { selectLabels, type Label } from '~/map/labels'

function label(key: string, x: number, y: number, text = 'ARS'): Label {
  return { key, x, y, text }
}

describe('selectLabels', () => {
  test('keeps every label when none of them collide', () => {
    // Arrange
    const labels = [label('a', 0, 0), label('b', 0, 100), label('c', 500, 0)]

    // Act
    const kept = selectLabels(labels)

    // Assert
    expect([...kept].sort()).toEqual(['a', 'b', 'c'])
  })

  test('drops the second of two labels on top of each other', () => {
    const kept = selectLabels([label('a', 0, 0), label('b', 0, 2)])

    expect([...kept]).toEqual(['a'])
  })

  test('keeps priority order, so the busiest node keeps its label', () => {
    // The caller sorts by importance; the first one through wins.
    const kept = selectLabels([label('busy', 0, 2), label('quiet', 0, 0)])

    expect([...kept]).toEqual(['busy'])
  })

  test('keeps two labels that share a row but not a column', () => {
    const kept = selectLabels([label('a', 0, 0), label('b', 400, 2)])

    expect([...kept].sort()).toEqual(['a', 'b'])
  })

  test('keeps two labels in the same column but far apart', () => {
    const kept = selectLabels([label('a', 0, 0), label('b', 0, 40)])

    expect([...kept].sort()).toEqual(['a', 'b'])
  })

  test('accounts for how wide a label is, not just where it starts', () => {
    // A long name reaches right far enough to cover a short one beside it.
    const kept = selectLabels([
      label('long', 0, 0, 'mostro.network'),
      label('short', 60, 2, 'ARS'),
    ])

    expect([...kept]).toEqual(['long'])
  })

  test('keeps a third label that clears both of the first two', () => {
    const kept = selectLabels([label('a', 0, 0), label('b', 0, 2), label('c', 0, 40)])

    expect([...kept].sort()).toEqual(['a', 'c'])
  })

  test('handles a map with nothing on it', () => {
    expect(selectLabels([])).toEqual(new Set())
  })
})

describe('selectLabels · markers', () => {
  test('drops a label that would sit on another node marker', () => {
    // Arrange - a marker squarely where the label would be drawn.
    const labels = [label('a', 0, 0, 'andes.pe')]
    const markers = [{ key: 'other', x: 20, y: 0, r: 8 }]

    // Act
    const kept = selectLabels(labels, markers)

    // Assert
    expect([...kept]).toEqual([])
  })

  test('lets a label sit beside its own marker, which is where it belongs', () => {
    const labels = [label('a', 0, 0, 'ARS')]
    const markers = [{ key: 'a', x: 2, y: 0, r: 8 }]

    expect([...selectLabels(labels, markers)]).toEqual(['a'])
  })

  test('keeps a label whose marker is nowhere near it', () => {
    const labels = [label('a', 0, 0, 'ARS')]
    const markers = [{ key: 'other', x: 400, y: 400, r: 8 }]

    expect([...selectLabels(labels, markers)]).toEqual(['a'])
  })

  test('separates two labels that would otherwise read as one string', () => {
    // "COP" ends exactly where "VES" begins: adjacent, not overlapping, and
    // unreadable all the same.
    const cop = label('cop', 0, 0, 'COP')
    const ves = label('ves', 3 * 5.9, 0, 'VES')

    expect([...selectLabels([cop, ves])]).toEqual(['cop'])
  })
})
