/**
 * Which language the reader gets.
 *
 * English is the default and the only one guaranteed complete; the rest are
 * translations of it, and the type in `strings.ts` is what stops one going
 * stale silently.
 *
 * The choice is the browser's, not the site's: `navigator.languages` is
 * already the reader's stated order of preference, and asking again with a
 * picker would be asking a question they have answered. A reader whose
 * languages this site does not speak gets English rather than nothing.
 */
import { en } from './en'
import { es } from './es'
import { pt } from './pt'
import { fr } from './fr'
import { it } from './it'
import type { Strings } from './strings'

export type { Strings } from './strings'

/** Every locale this site speaks, English first. */
export const LOCALES: Readonly<Record<string, Strings>> = { en, es, pt, fr, it }

export const DEFAULT_LOCALE = 'en'

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

/** The strings for a locale, falling back rather than failing. */
export function stringsFor(locale: string): Strings {
  return LOCALES[locale] ?? en
}

/** The strings this reader gets, chosen from their browser. */
export function detectStrings(): Strings {
  return stringsFor(pickLocale(preferredLanguages()))
}
