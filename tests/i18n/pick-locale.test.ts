import { describe, expect, test } from 'vitest'
import { DEFAULT_LOCALE, LOCALES, pickLocale, stringsFor } from '~/i18n'

const AVAILABLE = ['en', 'es', 'pt', 'fr', 'it']

describe('pickLocale', () => {
  test('gives a reader the language they asked for', () => {
    expect(pickLocale(['es'], AVAILABLE)).toBe('es')
    expect(pickLocale(['fr'], AVAILABLE)).toBe('fr')
    expect(pickLocale(['it'], AVAILABLE)).toBe('it')
    expect(pickLocale(['pt'], AVAILABLE)).toBe('pt')
  })

  test('reaches the language through a region', () => {
    // Arrange / Act / Assert
    expect(pickLocale(['pt-BR'], AVAILABLE)).toBe('pt')
    expect(pickLocale(['es-AR'], AVAILABLE)).toBe('es')
    expect(pickLocale(['fr-CA'], AVAILABLE)).toBe('fr')
    expect(pickLocale(['en-GB'], AVAILABLE)).toBe('en')
  })

  test('reaches it through a non-region subtag too', () => {
    expect(pickLocale(['es-419'], AVAILABLE)).toBe('es')
    expect(pickLocale(['zh-Hans-CN'], AVAILABLE)).toBe(DEFAULT_LOCALE)
  })

  test('ignores case, which a browser is not obliged to normalise', () => {
    expect(pickLocale(['PT-br'], AVAILABLE)).toBe('pt')
  })

  test('takes the readers order, not the sites', () => {
    // A browser asking for French first wants French, even though both are
    // available; taking the first *available* would overrule the reader.
    expect(pickLocale(['fr', 'es'], AVAILABLE)).toBe('fr')
    expect(pickLocale(['es', 'fr'], AVAILABLE)).toBe('es')
  })

  test('skips a language it does not speak and keeps looking', () => {
    expect(pickLocale(['de', 'ja', 'it'], AVAILABLE)).toBe('it')
  })

  test('falls back to English for a reader it cannot serve', () => {
    expect(pickLocale(['de'], AVAILABLE)).toBe(DEFAULT_LOCALE)
    expect(pickLocale(['ja-JP', 'ko'], AVAILABLE)).toBe(DEFAULT_LOCALE)
  })

  test('falls back when the browser says nothing at all', () => {
    expect(pickLocale([], AVAILABLE)).toBe(DEFAULT_LOCALE)
  })

  test('survives a browser that reports rubbish', () => {
    expect(pickLocale(['', '-', 'x'.repeat(50)], AVAILABLE)).toBe(DEFAULT_LOCALE)
  })

  test('defaults its available set to what the site actually speaks', () => {
    expect(pickLocale(['it'])).toBe('it')
    expect(pickLocale(['de'])).toBe(DEFAULT_LOCALE)
  })
})

describe('the catalogue', () => {
  test('speaks the five languages the site promises', () => {
    expect(Object.keys(LOCALES).sort()).toEqual(['en', 'es', 'fr', 'it', 'pt'])
  })

  test('English is the default', () => {
    expect(DEFAULT_LOCALE).toBe('en')
    expect(LOCALES[DEFAULT_LOCALE]?.locale).toBe('en')
  })

  test('every locale names itself and its own tag', () => {
    for (const [tag, strings] of Object.entries(LOCALES)) {
      expect(strings.locale, tag).toBe(tag)
      expect(strings.name.length, tag).toBeGreaterThan(0)
    }
  })

  test('falls back rather than failing on a locale it does not have', () => {
    expect(stringsFor('de').locale).toBe('en')
  })
})
