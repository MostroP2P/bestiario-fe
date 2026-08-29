import { createContext } from 'preact'
import { useContext } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { detectStrings } from './index'
import type { Strings } from './strings'

/**
 * The reader's language, for the tree.
 *
 * Detected once, from the browser, and never changed under them: a page that
 * re-renders in another language while being read is worse than one that
 * picked wrong. A context rather than a module constant so a test can render
 * any locale without touching globals.
 */
const StringsContext = createContext<Strings>(detectStrings())

export function StringsProvider(props: {
  readonly value: Strings
  readonly children: ComponentChildren
}) {
  return (
    <StringsContext.Provider value={props.value}>
      {props.children}
    </StringsContext.Provider>
  )
}

export function useStrings(): Strings {
  return useContext(StringsContext)
}
