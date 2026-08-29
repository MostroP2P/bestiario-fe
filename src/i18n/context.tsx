import { createContext } from 'preact'
import { useContext } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { detectStrings } from './index'
import type { Strings } from './strings'

/**
 * The reader's language, for the tree.
 *
 * Chosen once when the page opens — from their stored choice, else from
 * their browser — and changed afterwards only when the reader asks for it
 * themselves, never under them. A context rather than a module constant so a
 * test can render any locale without touching globals.
 */
const StringsContext = createContext<Strings>(detectStrings())

/**
 * How anything in the tree asks for another language. The default does
 * nothing, so a test may render a subtree without wiring one up.
 */
const SetLocaleContext = createContext<(locale: string) => void>(() => {})

export function StringsProvider(props: {
  readonly value: Strings
  readonly setLocale?: (locale: string) => void
  readonly children: ComponentChildren
}) {
  return (
    <StringsContext.Provider value={props.value}>
      <SetLocaleContext.Provider value={props.setLocale ?? noop}>
        {props.children}
      </SetLocaleContext.Provider>
    </StringsContext.Provider>
  )
}

function noop() {}

export function useStrings(): Strings {
  return useContext(StringsContext)
}

/** Ask for the page in another language. */
export function useSetLocale(): (locale: string) => void {
  return useContext(SetLocaleContext)
}
