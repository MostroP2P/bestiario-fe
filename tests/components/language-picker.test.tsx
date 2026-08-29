import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/preact'
import { LanguagePicker } from '~/components/LanguagePicker'
import { StringsProvider } from '~/i18n/context'
import { LOCALES } from '~/i18n'
import { en } from '~/i18n/en'
import { es } from '~/i18n/es'
import type { Strings } from '~/i18n'

afterEach(cleanup)

function draw(strings: Strings = en, setLocale = vi.fn()) {
  render(
    <StringsProvider value={strings} setLocale={setLocale}>
      <LanguagePicker />
    </StringsProvider>,
  )
  return { setLocale, control: screen.getByLabelText(strings.header.language) }
}

describe('the language picker', () => {
  test('offers every language this site speaks', () => {
    // Arrange / Act
    draw()

    // Assert
    const options = screen.getAllByRole('option')
    expect(options.map((option) => (option as HTMLOptionElement).value).sort()).toEqual(
      Object.keys(LOCALES).sort(),
    )
  })

  test('names each language in that language, not in the readers', () => {
    // A reader who lands on the wrong language has to find their own in a
    // list they cannot read otherwise.
    draw()

    for (const strings of Object.values(LOCALES)) {
      const option = screen.getByRole('option', { name: strings.name })
      expect(option).toHaveProperty('lang', strings.locale)
    }
  })

  test('shows the language the page is currently in', () => {
    const { control } = draw(es)

    expect((control as HTMLSelectElement).value).toBe('es')
  })

  test('is labelled in the language the page is in', () => {
    draw(es)

    expect(screen.getByLabelText(es.header.language)).toBeTruthy()
  })

  test('asks for the language the reader picked', () => {
    // Arrange
    const { control, setLocale } = draw()

    // Act
    fireEvent.change(control, { target: { value: 'fr' } })

    // Assert
    expect(setLocale).toHaveBeenCalledWith('fr')
  })

  test('asks for nothing when the reader picks the language they are in', () => {
    const { control, setLocale } = draw()

    fireEvent.change(control, { target: { value: 'en' } })

    expect(setLocale).not.toHaveBeenCalled()
  })
})
