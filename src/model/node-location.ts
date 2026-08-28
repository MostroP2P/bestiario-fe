/**
 * Where a Mostro instance is, inferred from what it calls itself.
 *
 * Instances publish no coordinates. What they do publish, in their kind 0
 * metadata, is a name, and those names carry a place often enough to be worth
 * reading: a flag emoji, a country, sometimes only a region. This module
 * turns that name into a claim about location, and — this is the point —
 * refuses to make one when the name supports none. `unknown` is a real
 * answer, not a failure to try harder.
 *
 * The order is by strength of evidence: a flag is explicit, a country name is
 * strong, a region is weak, and nothing is nothing.
 */
import { ALPHA2_TO_NUMERIC } from './iso-table'
import { REGION_ALIASES, type RegionId } from './regions'
import { REGION_TLDS, VANITY_CCTLDS } from './tlds'

/** How the claim was arrived at, strongest first: flag, name, domain suffix. */
export type Via = 'flag' | 'name' | 'tld'

export type Placement =
  | { kind: 'country'; alpha2: string; via: Via }
  | { kind: 'region'; region: RegionId; via: Via }
  | { kind: 'unknown' }

const UNKNOWN: Placement = { kind: 'unknown' }

/** Regional indicator symbols: U+1F1E6 (A) through U+1F1FF (Z). */
const INDICATOR_A = 0x1f1e6
const INDICATOR_Z = 0x1f1ff

/** Lowercase, accent-stripped, so `Perú` and `peru` are the same needle. */
function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * True when `needle` appears in `haystack` as a whole word. Both are already
 * folded, so the alphabet is ASCII and the boundary test is a simple one:
 * `chad` must not match inside `chadwick`.
 */
function containsWord(haystack: string, needle: string): boolean {
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(needle)}(?![a-z0-9])`).test(haystack)
}

/**
 * The alpha-2 code of the first flag emoji in `text`, or null.
 *
 * A pair of regional indicators is only a flag if the code it spells is a
 * country this atlas can draw — `🇦🇦` spells nothing, and `🇲🇨` spells Monaco,
 * which has no polygon at 110m. Both are `null`, because a point placed for
 * either would be invented rather than located.
 */
function flagCountry(text: string): string | null {
  // The string iterator yields whole code points, so a surrogate pair arrives
  // as one character and `codePointAt(0)` on it is always defined.
  let pending: number | null = null
  for (const ch of text) {
    const cp = ch.codePointAt(0)!
    if (cp < INDICATOR_A || cp > INDICATOR_Z) {
      pending = null
      continue
    }
    if (pending === null) {
      pending = cp
      continue
    }
    const alpha2 = indicatorLetter(pending) + indicatorLetter(cp)
    // A pair that spells no drawable country is not a flag; keep scanning.
    pending = null
    if (alpha2 in ALPHA2_TO_NUMERIC) return alpha2
  }
  return null
}

function indicatorLetter(codePoint: number): string {
  return String.fromCharCode(65 + codePoint - INDICATOR_A)
}

/**
 * Folded country name → alpha-2, in Spanish and English, longest name first.
 *
 * Built once, from the runtime's own ICU data rather than a table this repo
 * would have to maintain, and restricted to countries the atlas can draw.
 * Longest-first is what stops `Dominica` from claiming a name that reads
 * `República Dominicana`.
 */
let countryIndex: [string, string][] | null = null

/**
 * Resolves a country's name in a locale, or undefined when this runtime
 * cannot. A build of Node or a browser with reduced ICU data answers for
 * fewer locales than a full one, and `Intl.DisplayNames` signals that by
 * throwing or by handing back the code it was given. Either way the name is
 * unusable and the country is simply not matchable by name — which is why
 * this is a parameter: it is the one part of the index that can fail, and a
 * test can make it fail on demand.
 */
export type NameResolver = (locale: string, alpha2: string) => string | undefined

/** Exported so the failing paths below can be driven directly. */
export const intlResolver: NameResolver = (locale, alpha2) => {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'region' }).of(alpha2)
    return name === alpha2 ? undefined : name
  } catch {
    return undefined
  }
}

/** Exported for the test that drives a failing resolver; callers want `resolvePlacement`. */
export function buildCountryIndex(resolve: NameResolver): [string, string][] {
  const seen = new Map<string, string>()
  for (const locale of ['es', 'en']) {
    for (const alpha2 of Object.keys(ALPHA2_TO_NUMERIC)) {
      const name = resolve(locale, alpha2)
      if (name === undefined) continue
      const folded = fold(name)
      if (!seen.has(folded)) seen.set(folded, alpha2)
    }
  }
  return [...seen.entries()].sort(([a], [b]) => b.length - a.length)
}

function countryNames(): [string, string][] {
  countryIndex ??= buildCountryIndex(intlResolver)
  return countryIndex
}

const regionIndex: [string, RegionId][] = Object.entries(REGION_ALIASES)
  .flatMap(([region, aliases]) =>
    aliases.map((alias) => [fold(alias), region as RegionId] as [string, RegionId]),
  )
  .sort(([a], [b]) => b.length - a.length)

/**
 * Every domain-looking suffix in `folded`, in the order they appear. A suffix
 * is the last label of a dotted token — `relay.mostro.mx` yields `mx` — and a
 * bare word yields nothing, because `mostro br` is not a domain.
 */
function domainSuffixes(folded: string): string[] {
  const suffixes: string[] = []
  const pattern = /(?<![a-z0-9-])[a-z0-9-]+(?:\.[a-z0-9-]+)*\.([a-z]{2,})(?![a-z0-9-])/g
  for (const match of folded.matchAll(pattern)) {
    const suffix = match[1]
    if (suffix !== undefined) suffixes.push(suffix)
  }
  return suffixes
}

/** A place claimed by a domain suffix, or null. See `tlds.ts` for the bias. */
function suffixPlacement(folded: string): Placement | null {
  for (const suffix of domainSuffixes(folded)) {
    const region = REGION_TLDS[suffix]
    if (region !== undefined) return { kind: 'region', region, via: 'tld' }
    if (suffix.length !== 2) continue
    if (VANITY_CCTLDS.has(suffix)) continue
    const alpha2 = suffix.toUpperCase()
    if (alpha2 in ALPHA2_TO_NUMERIC) return { kind: 'country', alpha2, via: 'tld' }
  }
  return null
}

/** The strongest location claim `displayName` supports, or `unknown`. */
export function resolvePlacement(displayName: string): Placement {
  if (!displayName) return UNKNOWN

  const flag = flagCountry(displayName)
  if (flag) return { kind: 'country', alpha2: flag, via: 'flag' }

  const folded = fold(displayName)

  for (const [name, alpha2] of countryNames()) {
    if (containsWord(folded, name)) return { kind: 'country', alpha2, via: 'name' }
  }

  // A suffix is more specific than a region someone wrote out, and less
  // deliberate than a country they did.
  const bySuffix = suffixPlacement(folded)
  if (bySuffix) return bySuffix

  for (const [alias, region] of regionIndex) {
    if (containsWord(folded, alias)) return { kind: 'region', region, via: 'name' }
  }

  return UNKNOWN
}
