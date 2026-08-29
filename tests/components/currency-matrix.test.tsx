import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen } from '@testing-library/preact'
import { CurrencyMatrix } from '~/components/CurrencyMatrix'
import { StringsProvider } from '~/i18n/context'
import { en } from '~/i18n/en'
import { es } from '~/i18n/es'
import type { Strings } from '~/i18n'
import type { Matrix } from '~/model/matrix'

afterEach(cleanup)

/** Explicit, so a test never depends on the runner's own locale. */
function draw(matrix: Matrix, loading = false, strings: Strings = en) {
  return render(
    <StringsProvider value={strings}>
      <CurrencyMatrix matrix={matrix} loading={loading} />
    </StringsProvider>,
  )
}

const MATRIX: Matrix = {
  columns: ['ARS', 'BRL', 'EUR'],
  rows: [
    { pubkey: 'a'.repeat(64), name: 'Mostro', cells: [8, 2, 0] },
    { pubkey: 'b'.repeat(64), name: 'Nostro', cells: [1, 0, 4] },
  ],
  peak: 8,
}

describe('CurrencyMatrix', () => {
  test('heads every column with its currency and every row with its instance', () => {
    // Arrange / Act
    draw(MATRIX)

    // Assert
    for (const code of MATRIX.columns) {
      expect(screen.getByRole('columnheader', { name: code })).toBeTruthy()
    }
    expect(screen.getByRole('rowheader', { name: 'Mostro' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'Nostro' })).toBeTruthy()
  })

  test('puts the figure in the cell, so the shade is never the only carrier', () => {
    // Colour alone fails WCAG 1.4.1: every count is legible as a number too.
    const { container } = draw(MATRIX)

    const cells = [...container.querySelectorAll('tbody td')].map((td) =>
      td.textContent?.trim(),
    )
    // An empty pair carries the artboard's dot and the word behind it.
    expect(cells).toEqual(['8', '2', '·no orders', '1', '·no orders', '4'])
  })

  test('shades each cell against the grid’s own peak', () => {
    const { container } = draw(MATRIX)

    const levels = [...container.querySelectorAll('tbody td')].map((td) =>
      td.getAttribute('data-level'),
    )
    // 8 is the peak, 4 is half of it, 2 a quarter, 1 the least; 0 is empty.
    expect(levels).toEqual(['4', '1', '0', '1', '0', '2'])
  })

  test('says a pair has no orders rather than showing a bare glyph', () => {
    // The dot the artboard draws is decorative; the word is what is read.
    const { container } = draw(MATRIX)

    const empty = container.querySelectorAll('td[data-level="0"]')
    expect(empty.length).toBe(2)
    expect(empty[0]?.querySelector('[aria-hidden="true"]')?.textContent).toBe('·')
    expect(empty[0]?.querySelector('.b-visually-hidden')?.textContent).toBe('no orders')
  })

  test('names each cell for a pointer and for the keyboard alike', () => {
    const { container } = draw(MATRIX)

    expect(container.querySelector('tbody td')?.getAttribute('title')).toBe(
      'Mostro · ARS: 8',
    )
  })

  test('is a scrollable region a keyboard can reach and a screen reader can name', () => {
    const { container } = draw(MATRIX)

    const region = container.querySelector('.b-matrix')
    expect(region?.getAttribute('tabindex')).toBe('0')
    expect(region?.getAttribute('aria-label')).toBe(en.matrix.caption)
  })

  test('says nothing was published rather than drawing an empty grid', () => {
    draw({ columns: [], rows: [], peak: 0 })

    expect(screen.getByText(en.matrix.empty)).toBeTruthy()
    expect(screen.queryByRole('table')).toBeNull()
  })

  test('holds the space with skeletons while the documents are in flight', () => {
    const { container } = draw({ columns: [], rows: [], peak: 0 }, true)

    expect(container.querySelectorAll('.b-skeleton').length).toBeGreaterThan(0)
    // A placeholder is never a figure, and a screen reader is not read one.
    expect(container.querySelector('.b-matrix')?.getAttribute('aria-hidden')).toBe('true')
  })

  test('speaks the language the page is rendered in', () => {
    draw({ columns: [], rows: [], peak: 0 }, false, es)

    expect(screen.getByText(es.matrix.empty)).toBeTruthy()
  })
})
