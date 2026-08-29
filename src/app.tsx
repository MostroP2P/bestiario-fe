import { useEffect, useMemo } from 'preact/hooks'
import { Dashboard } from '~/views/Dashboard'
import { StringsProvider } from '~/i18n/context'
import { detectStrings } from '~/i18n'

/**
 * The reader's language is decided once, here, from their browser.
 *
 * `<html lang>` is set to match, because it is what a screen reader reads the
 * page's words with, and English words announced in Spanish are worse than
 * either language alone.
 */
export function App() {
  const strings = useMemo(() => detectStrings(), [])

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
    <StringsProvider value={strings}>
      <Dashboard />
    </StringsProvider>
  )
}
