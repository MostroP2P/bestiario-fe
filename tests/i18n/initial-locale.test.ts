import { afterEach, describe, expect, test, vi } from 'vitest'
import { initialLocale } from '~/i18n'
import { LOCALE_STORAGE_KEY } from '~/i18n/preference'

/** What `navigator.languages` says, for one test. */
function browserSpeaks(...languages: readonly string[]) {
  vi.spyOn(globalThis.navigator, 'languages', 'get').mockReturnValue(languages)
}

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('the language the page opens in', () => {
  test('is the browsers, for a reader who has never chosen', () => {
    browserSpeaks('fr-CA', 'en')

    expect(initialLocale()).toBe('fr')
  })

  test('is the one the reader chose, over the one their browser asks for', () => {
    // The whole point of the picker: a choice outranks a detection, and
    // outranks it on every later visit too.
    browserSpeaks('fr-CA', 'en')
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es')

    expect(initialLocale()).toBe('es')
  })

  test('falls back to the browser when the stored choice is unusable', () => {
    browserSpeaks('it-IT')
    localStorage.setItem(LOCALE_STORAGE_KEY, 'de')

    expect(initialLocale()).toBe('it')
  })

  test('is English when neither says anything this site speaks', () => {
    browserSpeaks('ja-JP')

    expect(initialLocale()).toBe('en')
  })
})
