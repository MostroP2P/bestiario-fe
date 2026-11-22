import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/preact'
import { CurrencyVolume } from '~/components/CurrencyVolume'
import { StringsProvider } from '~/i18n/context'
import { en } from '~/i18n/en'
import type { FiatRow } from '~/model/metrics'
import type { Metric } from '~/nostr/documents'
import { formatMetric } from '~/model/format'

afterEach(cleanup)

function row(code: string, figures: Record<string, Omit<Metric, 'name'>>): FiatRow {
  return {
    code,
    figures: new Map(
      Object.entries(figures).map(([figure, metric]) => [
        figure,
        { ...metric, name: `volume.fiat.${code}.${figure}` },
      ]),
    ),
  }
}

const count = (value: number) => ({
  kind: 'observed' as const,
  unit: 'count' as const,
  value,
})
const sats = (value: number) => ({
  kind: 'observed' as const,
  unit: 'sats' as const,
  value,
})

const COP = row('COP', {
  orders: count(386),
  completed: count(386),
  total: { kind: 'observed', unit: 'fiat', value: { amount: 1_000_000, code: 'COP' } },
})
const BTC = row('BTC', {
  orders: count(5),
  completed: count(5),
  sats: sats(3_184_650),
  total: sats(3_171_900),
  ticket_p50: sats(501_000),
  ticket_p90: sats(1_000_000),
})
const RBTC = row('RBTC', { orders: count(1), completed: count(1), sats: sats(10_000) })

function draw(rows: readonly FiatRow[], loading = false) {
  return render(
    <StringsProvider value={en}>
      <CurrencyVolume rows={rows} loading={loading} />
    </StringsProvider>,
  )
}

const tables = () => screen.getAllByRole('table')

describe('CurrencyVolume', () => {
  test('keeps swaps out of the fiat table', () => {
    draw([BTC, COP])

    const [fiat] = tables()
    expect(
      within(fiat!)
        .getAllByRole('rowheader')
        .map((c) => c.textContent),
    ).toEqual(['COP'])
  })

  test('lists each swap rail apart, with its figures in sats', () => {
    draw([BTC, COP, RBTC])

    const swaps = screen.getByRole('table', { name: en.swaps.caption })
    const rails = within(swaps)
      .getAllByRole('rowheader')
      .map((c) => c.textContent)
    expect(rails).toEqual([
      `${en.swaps.rails.onchain} BTC`,
      `${en.swaps.rails.rootstock} RBTC`,
    ])
    expect(swaps.textContent).toContain(formatMetric(BTC.figures.get('sats')).text)
    expect(swaps.textContent).toContain(formatMetric(BTC.figures.get('ticket_p50')).text)
    expect(formatMetric(BTC.figures.get('sats')).text).toMatch(/ sats$/)
    expect(swaps.textContent).not.toContain('BTC BTC')
  })

  test('says how many completed orders were swaps, so the two tables add up', () => {
    draw([BTC, COP, RBTC])

    expect(screen.getByText(en.swaps.note('6'))).toBeTruthy()
  })

  test('does not invent a count a rail never published', () => {
    const uncounted = row('LBTC', { sats: sats(1_000) })
    draw([BTC, uncounted])

    expect(screen.getByText(en.swaps.noteUncounted)).toBeTruthy()
  })

  test('draws no swaps block when nothing was a swap', () => {
    draw([COP])

    expect(tables()).toHaveLength(1)
    expect(screen.queryByText(en.swaps.heading)).toBeNull()
  })

  test('draws only the swaps when every row is a swap, as a reader narrowed to BTC', () => {
    draw([BTC])

    expect(tables()).toHaveLength(1)
    expect(screen.queryByText(en.fiat.empty)).toBeNull()
    expect(screen.getByRole('table', { name: en.swaps.caption })).toBeTruthy()
  })

  test('says the window is empty when there is nothing at all', () => {
    draw([])

    expect(screen.getByText(en.fiat.empty)).toBeTruthy()
  })

  test('holds the skeleton while loading and draws no swaps block yet', () => {
    draw([BTC, COP], true)

    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText(en.swaps.heading)).toBeNull()
  })
})
