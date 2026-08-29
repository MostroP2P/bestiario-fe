import { describe, expect, test } from 'vitest'
import { currencyMatrix, heatLevel } from '~/model/matrix'
import type { InstanceRow } from '~/model/instances'

/**
 * The cross of artboard 2a: one row per instance, one column per currency,
 * the orders each pair *completed*. Nothing here is summed from elsewhere —
 * the figures are the ones the scoped `orders:<window>:i:<pubkey>` documents
 * published, so the grid and the map read from the same source.
 *
 * The created counts are kept in the fixtures on purpose: a market can be
 * created in and never settle, and the grid must not draw it.
 */

function instance(pubkey: string, name: string): InstanceRow {
  return { label: name, pubkey, name, created: 0, figures: new Map() }
}

const ALPHA = 'a'.repeat(64)
const BETA = 'b'.repeat(64)
const GAMMA = 'c'.repeat(64)

describe('currencyMatrix', () => {
  test('crosses every instance that published a breakdown with every code traded', () => {
    // Arrange
    const instances = [instance(ALPHA, 'Alpha'), instance(BETA, 'Beta')]
    const trades = [
      {
        pubkey: ALPHA,
        currencies: [
          { code: 'ARS', created: 9, completed: 4, openNow: 1 },
          { code: 'EUR', created: 3, completed: 1, openNow: 0 },
        ],
      },
      {
        pubkey: BETA,
        currencies: [{ code: 'BRL', created: 5, completed: 2, openNow: 0 }],
      },
    ]

    // Act
    const matrix = currencyMatrix(instances, trades)

    // Assert
    expect(matrix.columns).toEqual(['ARS', 'BRL', 'EUR'])
    expect(matrix.rows.map((row) => row.name)).toEqual(['Alpha', 'Beta'])
    expect(matrix.rows[0]?.cells).toEqual([4, 0, 1])
    expect(matrix.rows[1]?.cells).toEqual([0, 2, 0])
    expect(matrix.peak).toBe(4)
  })

  test('leaves out a currency the network created orders in but never completed', () => {
    // Arrange: CLP was quoted in and never settled — the noise the grid drops.
    const instances = [instance(ALPHA, 'Alpha'), instance(BETA, 'Beta')]
    const trades = [
      {
        pubkey: ALPHA,
        currencies: [
          { code: 'ARS', created: 4, completed: 2, openNow: 0 },
          { code: 'CLP', created: 7, completed: 0, openNow: 3 },
        ],
      },
      {
        pubkey: BETA,
        currencies: [{ code: 'CLP', created: 2, completed: 0, openNow: 0 }],
      },
    ]

    // Act
    const matrix = currencyMatrix(instances, trades)

    // Assert
    expect(matrix.columns).toEqual(['ARS'])
    expect(matrix.rows[0]?.cells).toEqual([2])
    expect(matrix.rows[1]?.cells).toEqual([0])
  })

  test('is empty when nothing settled anywhere, rather than a grid of dots', () => {
    // Arrange / Act
    const matrix = currencyMatrix(
      [instance(ALPHA, 'Alpha')],
      [
        {
          pubkey: ALPHA,
          currencies: [{ code: 'ARS', created: 6, completed: 0, openNow: 2 }],
        },
      ],
    )

    // Assert
    expect(matrix.columns).toEqual([])
    expect(matrix.rows).toEqual([])
    expect(matrix.peak).toBe(0)
  })

  test('orders the columns by what the network completed most, then by code', () => {
    // Arrange
    const instances = [instance(ALPHA, 'Alpha'), instance(BETA, 'Beta')]
    const trades = [
      {
        pubkey: ALPHA,
        currencies: [
          { code: 'ARS', created: 2, completed: 1, openNow: 0 },
          { code: 'USD', created: 4, completed: 3, openNow: 0 },
        ],
      },
      {
        pubkey: BETA,
        currencies: [
          { code: 'ARS', created: 8, completed: 5, openNow: 0 },
          { code: 'BRL', created: 6, completed: 3, openNow: 0 },
        ],
      },
    ]

    // Act
    const matrix = currencyMatrix(instances, trades)

    // Assert: ARS 6, then BRL and USD tie at 3 and the code breaks it.
    expect(matrix.columns).toEqual(['ARS', 'BRL', 'USD'])
  })

  test('leaves out the instance that published no breakdown rather than a row of zeros', () => {
    // Arrange: Gamma is in the instances document and has no scoped one.
    const instances = [instance(ALPHA, 'Alpha'), instance(GAMMA, 'Gamma')]
    const trades = [
      {
        pubkey: ALPHA,
        currencies: [{ code: 'ARS', created: 3, completed: 2, openNow: 0 }],
      },
    ]

    // Act
    const matrix = currencyMatrix(instances, trades)

    // Assert
    expect(matrix.rows.map((row) => row.pubkey)).toEqual([ALPHA])
  })

  test('is empty, not zero, when no instance published a breakdown', () => {
    // Arrange / Act
    const matrix = currencyMatrix([instance(ALPHA, 'Alpha')], [])

    // Assert
    expect(matrix.rows).toEqual([])
    expect(matrix.columns).toEqual([])
    expect(matrix.peak).toBe(0)
  })

  test('ignores a breakdown from an instance the instances document does not name', () => {
    // An unnamed pubkey cannot be labelled, and a row headed by a hash is a
    // claim about an instance this client cannot name.
    const matrix = currencyMatrix(
      [instance(ALPHA, 'Alpha')],
      [
        {
          pubkey: BETA,
          currencies: [{ code: 'ARS', created: 12, completed: 9, openNow: 0 }],
        },
      ],
    )

    expect(matrix.rows).toEqual([])
    expect(matrix.columns).toEqual([])
  })
})

describe('heatLevel', () => {
  test('gives nothing its own level, so an empty pair is never shaded', () => {
    expect(heatLevel(0, 10)).toBe(0)
  })

  test('scales a count against the grid’s own peak', () => {
    expect(heatLevel(10, 10)).toBe(4)
    expect(heatLevel(6, 10)).toBe(3)
    expect(heatLevel(3, 10)).toBe(2)
    expect(heatLevel(1, 10)).toBe(1)
  })

  test('never disappears a count into the empty level', () => {
    // One order against a peak of a thousand is still an order.
    expect(heatLevel(1, 1_000)).toBe(1)
  })

  test('treats an empty grid as empty rather than dividing by zero', () => {
    expect(heatLevel(0, 0)).toBe(0)
  })
})
