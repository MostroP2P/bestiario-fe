/**
 * Every language this site speaks.
 *
 * Its own module so that the pieces which only need to know *whether* a tag
 * is spoken — the stored preference, the picker — can ask without importing
 * the detection that imports them back.
 */
import { en } from './en'
import { es } from './es'
import { pt } from './pt'
import { fr } from './fr'
import { it } from './it'
import type { Strings } from './strings'

/** Every locale this site speaks, English first. */
export const LOCALES: Readonly<Record<string, Strings>> = { en, es, pt, fr, it }

export const DEFAULT_LOCALE = 'en'

/** The strings for a locale, falling back rather than failing. */
export function stringsFor(locale: string): Strings {
  return LOCALES[locale] ?? en
}
