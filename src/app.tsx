import { useCallback, useEffect, useMemo, useState } from 'preact/hooks'
import { Dashboard } from '~/views/Dashboard'
import { StringsProvider } from '~/i18n/context'
import { initialLocale, stringsFor } from '~/i18n'
import { rememberLocale } from '~/i18n/preference'

/**
 * The reader's language: their browser's answer on the first visit, their own
 * from the moment they say otherwise.
 *
 * A choice is remembered before it is applied, so the next visit opens where
 * this one ended rather than back at the guess.
 *
 * `<html lang>` is set to match, because it is what a screen reader reads the
 * page's words with, and English words announced in Spanish are worse than
 * either language alone.
 */
export function App() {
  const [locale, setLocale] = useState(() => initialLocale())
  const strings = useMemo(() => stringsFor(locale), [locale])

  const choose = useCallback((chosen: string) => {
    rememberLocale(chosen)
    setLocale(chosen)
  }, [])

  useEffect(() => {
    document.documentElement.lang = strings.locale
    // The tab and anything that quotes this page: index.html ships English,
    // and a Spanish page under an English title contradicts itself.
    document.title = strings.document.title
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', strings.document.description)
  }, [strings])

  return (
    <StringsProvider value={strings} setLocale={choose}>
      <Dashboard />
    </StringsProvider>
  )
}
