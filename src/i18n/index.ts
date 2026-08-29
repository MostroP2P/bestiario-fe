/**
 * Which language the reader gets.
 *
 * English is the default and the only one guaranteed complete; the rest are
 * translations of it, and the type in `strings.ts` is what stops one going
 * stale silently.
 *
 * The first answer is the browser's: `navigator.languages` is already the
 * reader's stated order of preference, so the page opens in their language
 * without being asked. But a browser is a guess about a person — a shared
 * machine, a laptop installed in a language its owner does not read — so the
 * guess is always correctable, and a correction outranks it from then on
 * (`preference.ts`). A reader whose languages this site does not speak gets
 * English rather than nothing.
 */
import { DEFAULT_LOCALE, LOCALES, stringsFor } from './catalogue'
import { storedLocale } from './preference'
import type { Strings } from './strings'

export type { Strings } from './strings'
export { DEFAULT_LOCALE, LOCALES, stringsFor } from './catalogue'

/**
 * The first of `preferred` this site speaks, or the default.
 *
 * A tag is matched whole first and then by its base language, so `pt-BR`
 * reaches Portuguese and `es-419` reaches Spanish. Order is the reader's:
 * a browser asking for `["fr", "es"]` wants French even though both are
 * here, and taking the first *available* rather than the first *preferred*
 * would quietly overrule them.
 */
export function pickLocale(
  preferred: readonly string[],
  available: readonly string[] = Object.keys(LOCALES),
  fallback: string = DEFAULT_LOCALE,
): string {
  const speaks = new Set(available.map((tag) => tag.toLowerCase()))
  for (const tag of preferred) {
    if (typeof tag !== 'string' || tag.length === 0) continue
    const lower = tag.toLowerCase()
    if (speaks.has(lower)) return lower
    const base = lower.split('-')[0]
    if (base && speaks.has(base)) return base
  }
  return fallback
}

/** What the browser says the reader prefers, in order. */
export function preferredLanguages(): readonly string[] {
  const nav: Navigator | undefined = globalThis.navigator
  if (!nav) return []
  const languages: readonly string[] | undefined = nav.languages
  if (languages && languages.length > 0) return languages
  return nav.language ? [nav.language] : []
}

/**
 * The locale the page opens in: the reader's own choice when they have made
 * one, and their browser's preference when they have not.
 */
export function initialLocale(): string {
  return storedLocale() ?? pickLocale(preferredLanguages())
}

/** The strings this reader opens the page in. */
export function detectStrings(): Strings {
  return stringsFor(initialLocale())
}
