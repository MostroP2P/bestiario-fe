/**
 * The language the reader chose, kept between visits.
 *
 * Detection answers the first visit well and the wrong one badly: a shared
 * machine, a browser installed in a language its user does not read, a
 * traveller's borrowed laptop. A choice is the reader's correction of that
 * guess, so it outlives the tab — and only their own browser ever sees it,
 * which is the only storage this site is willing to keep.
 */
import { LOCALES } from './catalogue'

export const LOCALE_STORAGE_KEY = 'bestiario.locale'

/** Whether this site actually speaks a tag, before it is trusted anywhere. */
function isSpoken(tag: string | null): tag is string {
  return typeof tag === 'string' && Object.hasOwn(LOCALES, tag)
}

/**
 * The stored choice, or `null` when there is none to honour.
 *
 * A key left by an older build, hand-edited, or read in a browser that
 * refuses storage all mean the same thing here: nothing was chosen, so
 * detection decides. Storage is never allowed to break the page.
 */
export function storedLocale(): string | null {
  try {
    const stored = globalThis.localStorage?.getItem(LOCALE_STORAGE_KEY) ?? null
    return isSpoken(stored) ? stored : null
  } catch {
    return null
  }
}

/** Remember a choice, if it is one this site can keep. */
export function rememberLocale(locale: string): void {
  if (!isSpoken(locale)) return
  try {
    globalThis.localStorage?.setItem(LOCALE_STORAGE_KEY, locale)
  } catch {
    // A private window, or storage switched off. The choice still applies to
    // this visit; it just will not survive it.
  }
}
