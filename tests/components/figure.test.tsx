import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render } from '@testing-library/preact'
import { Figure } from '~/components/Figure'
import type { Metric } from '~/nostr/documents'

afterEach(cleanup)

const observed: Metric = {
  name: 'dev_fees.total_sats',
  kind: 'observed',
  unit: 'sats',
  value: 223730,
}

const inferred: Metric = {
  name: 'dev_fees.implied_volume',
  kind: 'inferred',
  unit: 'sats',
  value: 34113944,
  error: 'assumes a 0.30 dev fee share; see SPEC §5',
}

describe('Figure · observed', () => {
  test('shows the figure plainly', () => {
    const { container } = render(<Figure metric={observed} />)

    expect(container.textContent).toContain('sats')
  })

  test('carries no inferred marker', () => {
    const { container } = render(<Figure metric={observed} />)

    expect(container.querySelector('.b-inferred-mark')).toBeNull()
  })
})

describe('Figure · inferred', () => {
  test('is distinguished by a marker and not by a colour alone', () => {
    // WCAG 1.4.1: colour alone is not a distinction.
    const { container } = render(<Figure metric={inferred} />)

    expect(container.querySelector('.b-inferred-mark')?.textContent).toContain('inf')
  })

  test('puts the assumption in the accessible name', () => {
    const { container } = render(<Figure metric={inferred} />)

    expect(container.querySelector('.b-inferred-mark')?.getAttribute('aria-label')).toBe(
      'Cifra inferida. assumes a 0.30 dev fee share; see SPEC §5',
    )
  })

  test('is reachable by keyboard, not only under a pointer', () => {
    const { container } = render(<Figure metric={inferred} />)

    expect(container.querySelector('.b-inferred-mark')?.getAttribute('tabindex')).toBe(
      '0',
    )
  })

  test('describes the figure with the error text it renders', () => {
    const { container } = render(<Figure metric={inferred} />)
    const mark = container.querySelector('.b-inferred-mark')!
    const describedBy = mark.getAttribute('aria-describedby')

    expect(describedBy).toBeTruthy()
    expect(container.querySelector(`#${describedBy!}`)?.textContent).toBe(inferred.error)
  })

  test('still marks an inferred figure that carries no error text', () => {
    const withoutError: Metric = {
      name: inferred.name,
      kind: 'inferred',
      unit: inferred.unit,
      value: inferred.value,
    }
    const { container } = render(<Figure metric={withoutError} />)
    const mark = container.querySelector('.b-inferred-mark')!

    expect(mark.getAttribute('aria-label')).toBe('Cifra inferida')
    expect(mark.getAttribute('aria-describedby')).toBeNull()
  })

  test('gives each figure its own tooltip id, so two on a page do not collide', () => {
    const { container } = render(
      <div>
        <Figure metric={inferred} />
        <Figure metric={inferred} />
      </div>,
    )
    const ids = [...container.querySelectorAll('.b-inferred-mark')].map((m) =>
      m.getAttribute('aria-describedby'),
    )

    expect(new Set(ids).size).toBe(2)
  })
})

describe('Figure · absence', () => {
  test('draws an em dash and never a zero', () => {
    const missing: Metric = {
      name: 'volume.in.USD.total',
      kind: 'inferred',
      unit: 'missing',
      value: null,
      error: 'no rate used',
    }
    const { container } = render(<Figure metric={missing} />)

    expect(container.textContent).toContain('—')
    expect(container.textContent).not.toContain('0')
  })

  test('says which absence it is, for a reader who cannot see the dash', () => {
    const { container } = render(<Figure metric={undefined} />)

    expect(container.querySelector('.b-visually-hidden')?.textContent).toBe(
      'no publicado',
    )
  })

  test('hides the dash itself from the accessible tree, having labelled it', () => {
    const { container } = render(<Figure metric={undefined} />)

    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe('—')
  })
})
