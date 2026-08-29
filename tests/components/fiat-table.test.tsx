import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { FiatTable } from '~/components/FiatTable'
import { StringsProvider } from '~/i18n/context'
import { en } from '~/i18n/en'
import type { FiatRow } from '~/model/metrics'
import type { Metric, MetricValue } from '~/nostr/documents'
import { formatMetric } from '~/model/format'

afterEach(cleanup)

function row(code: string, orders: number, total: MetricValue, sats?: number): FiatRow {
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
  if (sats !== undefined) {
    figures.set('sats', {
      name: `volume.fiat.${code}.sats`,
      kind: 'observed',
      unit: 'sats',
      value: sats,
    })
  }
  return { code, figures }
}

// Alphabetical on the way in, which is what the table must not settle for.
const ROWS: readonly FiatRow[] = [
  row('ARS', 4, { amount: 318_400, code: 'ARS' }, 900_000),
  row('MXN', 7, { amount: 12_150, code: 'MXN' }, 400_000),
  row('PEN', 1, { amount: 500, code: 'PEN' }, 50_000),
  row('USD', 6, { amount: 151, code: 'USD' }, 2_000_000),
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
    expect(screen.getAllByRole('button')).toHaveLength(7)
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

describe('the sats column', () => {
  test('shows what each currency moved in the unit they all share', () => {
    // Arrange / Act
    draw()

    // Assert — beside the amount in the row's own currency, not instead.
    const printed = (unit: Metric['unit'], value: MetricValue) =>
      formatMetric({ name: 'x', kind: 'observed', unit, value }).text
    const ars = screen
      .getAllByRole('row')
      .find((row) => row.textContent?.startsWith('ARS'))!
    expect(ars.textContent).toContain(printed('fiat', { amount: 318_400, code: 'ARS' }))
    expect(ars.textContent).toContain(printed('sats', 900_000))
  })

  test('ranks the market by it, which the fiat amounts cannot do', () => {
    // Arrange — USD moves the most sats and the fewest of its own units.
    draw()

    // Act
    fireEvent.click(heading(en.fiat.sats))

    // Assert
    expect(codes()).toEqual(['USD', 'ARS', 'MXN', 'PEN'])
  })

  test('an archive that publishes no sats yet says so rather than a zero', () => {
    // Arrange — the figure the daemon has not deployed.
    draw([row('ARS', 4, { amount: 318_400, code: 'ARS' })])

    // Assert
    const ars = screen.getAllByRole('row')[1]!
    expect(ars.textContent).toContain('—')
    expect(ars.textContent).toContain(en.absence.notPublished)
    expect(ars.textContent).not.toContain('0 sats')
  })
})
