import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render } from '@testing-library/preact'
import { SwapTag } from '~/components/SwapTag'
import { StringsProvider } from '~/i18n/context'
import { en } from '~/i18n/en'

afterEach(cleanup)

function draw(code: string) {
  return render(
    <StringsProvider value={en}>
      <SwapTag code={code} />
    </StringsProvider>,
  )
}

describe('SwapTag', () => {
  test('marks a swap code in words and names its rail', () => {
    const { container } = draw('LBTC')

    expect(container.textContent).toContain(en.swaps.tag)
    expect(container.textContent).toContain(en.swaps.rails.liquid)
  })

  test('marks nothing beside a currency or a stablecoin', () => {
    for (const code of ['COP', 'USDT']) {
      const { container } = draw(code)
      expect(container.textContent, code).toBe('')
      cleanup()
    }
  })
})
