import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { FiatTable } from '~/components/FiatTable'
import { StringsProvider } from '~/i18n/context'
import { en } from '~/i18n/en'
import type { FiatRow } from '~/model/metrics'
import type { Metric, MetricValue } from '~/nostr/documents'

afterEach(cleanup)

function row(code: string, orders: number, total: MetricValue): FiatRow {
  const figures = new Map<string, Metric>([
    [
      'orders',
      {
        name: `volume.fiat.${code}.orders`,
        kind: 'observed',
        unit: 'count',
        value: orders,
      },
    ],
    [
      'total',
      { name: `volume.fiat.${code}.total`, kind: 'observed', unit: 'fiat', value: total },
    ],
  ])
  return { code, figures }
}

// Alphabetical on the way in, which is what the table must not settle for.
const ROWS: readonly FiatRow[] = [
  row('ARS', 4, { amount: 318_400, code: 'ARS' }),
  row('MXN', 7, { amount: 12_150, code: 'MXN' }),
  row('PEN', 1, { amount: 500, code: 'PEN' }),
  row('USD', 6, { amount: 151, code: 'USD' }),
]

function draw(rows: readonly FiatRow[] = ROWS, loading = false) {
  return render(
    <StringsProvider value={en}>
      <FiatTable rows={rows} loading={loading} />
    </StringsProvider>,
  )
}

/** The currency codes down the first column, in the order the table drew them. */
function codes() {
  return screen.getAllByRole('rowheader').map((cell) => cell.textContent ?? '')
}

function heading(name: string) {
  return screen.getByRole('button', { name: `Sort by ${name}` })
}

describe('the volume-by-currency table', () => {
  test('opens on the busiest market rather than on the alphabet', () => {
    // Arrange / Act
    draw()

    // Assert
    expect(codes()).toEqual(['MXN', 'USD', 'ARS', 'PEN'])
  })

  test('says which column it is ordered by, and which way', () => {
    draw()

    const ordered = screen
      .getAllByRole('columnheader')
      .find((cell) => cell.getAttribute('aria-sort') !== 'none')
    expect(ordered?.textContent).toContain('orders')
    expect(ordered?.getAttribute('aria-sort')).toBe('descending')
  })

  test('reorders by the column whose heading is pressed, largest first', () => {
    draw()

    fireEvent.click(heading('volume'))

    expect(codes()).toEqual(['ARS', 'MXN', 'PEN', 'USD'])
  })

  test('flips that column when its heading is pressed again', () => {
    draw()

    fireEvent.click(heading('volume'))
    fireEvent.click(heading('volume'))

    expect(codes()).toEqual(['USD', 'PEN', 'MXN', 'ARS'])
    expect(screen.getAllByRole('columnheader')[1]?.getAttribute('aria-sort')).toBe(
      'ascending',
    )
  })

  test('sorts the currency column alphabetically', () => {
    draw()

    fireEvent.click(heading('currency'))

    expect(codes()).toEqual(['ARS', 'MXN', 'PEN', 'USD'])
  })

  test('keeps a heading reachable as a button, not as a click target only', () => {
    draw()

    // Every column heads a control; none is a bare label a keyboard cannot reach.
    expect(screen.getAllByRole('button')).toHaveLength(6)
  })

  test('shows skeleton rows rather than an order while the figures are in flight', () => {
    draw(ROWS, true)

    expect(screen.queryByRole('table')).toBeNull()
  })

  test('says the window is empty rather than drawing an empty order', () => {
    draw([])

    expect(screen.getByText(en.fiat.empty)).toBeTruthy()
  })
})
