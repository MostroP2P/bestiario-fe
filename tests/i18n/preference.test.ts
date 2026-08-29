import { afterEach, describe, expect, test, vi } from 'vitest'
import { LOCALE_STORAGE_KEY, rememberLocale, storedLocale } from '~/i18n/preference'

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('the language a reader chose', () => {
  test('is nothing at all until they choose one', () => {
    expect(storedLocale()).toBeNull()
  })

  test('comes back the way it went in', () => {
    // Arrange / Act
    rememberLocale('es')

    // Assert
    expect(storedLocale()).toBe('es')
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('es')
  })

  test('is replaced, not accumulated, when they choose again', () => {
    rememberLocale('es')
    rememberLocale('fr')

    expect(storedLocale()).toBe('fr')
  })

  test('is ignored when it names a language this site does not speak', () => {
    // A stale key from an older build, or a hand-edited one: English is a
    // better answer than a crash or a page of undefined.
    localStorage.setItem(LOCALE_STORAGE_KEY, 'de')

    expect(storedLocale()).toBeNull()
  })

  test('is ignored when it is rubbish', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, '{"not":"a tag"}')

    expect(storedLocale()).toBeNull()
  })

  test('refuses to store a language this site does not speak', () => {
    rememberLocale('de')

    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBeNull()
  })

  test('survives a browser that refuses storage', () => {
    // Private windows and cookie-blocking settings throw on access rather
    // than returning null. A reader in one still gets a working page.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })

    expect(storedLocale()).toBeNull()
    expect(() => rememberLocale('es')).not.toThrow()
  })
})
