/**
 * Domain suffixes, and the ones that lie.
 *
 * A Mostro instance is usually named after its host — `satoshi.br`, `nodo.mx`
 * — and that suffix is decent evidence of where it is. It is also the weakest
 * kind of evidence this module accepts, because a country-code suffix says
 * where a registration was bought, not where a node runs.
 *
 * The bias is deliberate and follows SPEC 2: on this map a wrong placement is
 * worse than no placement, so a suffix registered mostly for its letters is
 * excluded outright rather than guessed at. Missing a genuine `mostro.it`
 * costs one unplaced node; honouring `mostro.io` puts a Venezuelan trading
 * desk in the Indian Ocean and says nothing about it.
 */
import type { RegionId } from './regions'

/**
 * ccTLDs whose registrations are dominated by what the letters spell rather
 * than by the country that owns them. Excluding one is a decision to place no
 * node rather than a possibly wrong one.
 */
export const VANITY_CCTLDS: ReadonlySet<string> = new Set([
  // Tech and startup vanity
  'io',
  'ai',
  'sh',
  'co',
  'cc',
  'to',
  'is',
  'so',
  'im',
  // Words and abbreviations
  'me',
  'tv',
  'fm',
  'am',
  'at',
  'be',
  'in',
  'it',
  'la',
  'st',
  'nu',
  'gs',
  'gg',
  'mn',
  'ws',
  'si',
  'sc',
  'tl',
  'vc',
  'je',
  'ms',
  're',
  'gl',
  'pw',
  'ac',
  // URL shorteners
  'ly',
  // Former free-registration farms, still heavily non-geographic
  'tk',
  'ml',
  'ga',
  'cf',
])

/** Suffixes that name a region rather than a country. */
export const REGION_TLDS: Readonly<Record<string, RegionId>> = {
  lat: 'latam',
  eu: 'europe',
  asia: 'asia',
  africa: 'africa',
}
