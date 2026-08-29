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
  }, [strings])

  return (
    <StringsProvider value={strings}>
      <Dashboard />
    </StringsProvider>
  )
}
