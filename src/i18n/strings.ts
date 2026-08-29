/**
 * Every user-facing string, as a type.
 *
 * SPEC 13 asked for this from the start: one module, so a translation is a
 * file and not a refactor. The type is the contract — a locale that forgets a
 * string does not compile — and English is the source of truth every other
 * file is a translation of.
 *
 * Anything a figure needs interpolated into it is a function, so a language
 * can put the number where its grammar wants it rather than where English
 * does.
 */
import type { Span } from '~/nostr/address'

/**
 * `one` when there is one of a thing, `many` otherwise.
 *
 * Every count a locale interpolates goes through this. "1 currencies not
 * placed on the map" is the sort of thing a screen reader makes unmissable,
 * and the English source carried it before any translation did.
 */
export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many
}

export type Strings = {
  readonly locale: string
  /** What the language calls itself, for the picker and for `lang`. */
  readonly name: string

  /** The tab, and what a link to this page says when it is shared. */
  readonly document: {
    readonly title: string
    readonly description: string
  }

  /**
   * Duration units, as the abbreviations a reader of this language expects.
   * French says `j` for a day and Italian `g`; `d` would be a foreign word
   * abbreviated.
   */
  readonly units: {
    readonly days: string
    readonly hours: string
    readonly minutes: string
    readonly seconds: string
  }

  readonly brand: {
    readonly tagline: string
  }

  readonly header: {
    readonly windowNav: string
    /** Labels the language picker, for a reader who cannot see its icon. */
    readonly language: string
    readonly windows: Readonly<Record<Span, string>>
    readonly network: string
    readonly verified: string
    readonly connecting: string
  }

  readonly rail: {
    readonly publisher: string
    readonly publisherNote: string
    readonly relays: string
    readonly archive: string
    readonly from: string
    readonly until: string
    readonly documents: string
    readonly archiveNote: string
    readonly snapshot: string
    readonly age: string
    readonly version: string
  }

  readonly map: {
    readonly heading: string
    readonly caption: string
    readonly loadingGeometry: string
    readonly noGeometry: (reason: string) => string
    readonly activeMarkets: string
    readonly unplaced: (count: number) => string
    /** Shown while the per-instance orders documents are not published. */
    readonly illustrativeRoutes: string
    /** Shown when some instances name no country. */
    readonly approximateInstances: (approximate: number, total: number) => string
    readonly describe: {
      readonly empty: string
      readonly flows: (arcs: number, currencies: number, instances: number) => string
      readonly live: (count: number) => string
      readonly settling: (count: number) => string
      readonly unplacedCurrencies: (count: number) => string
      readonly unplacedInstances: (count: number) => string
    }
  }

  readonly kpi: {
    readonly orders: (window: string) => string
    readonly ordersSub: (completed: string, rate: string) => string
    readonly volume: (window: string) => string
    readonly volumeSub: (p50: string) => string
    readonly disputes: (window: string) => string
    readonly disputesSub: (resolved: string, rate: string) => string
    readonly rightNow: string
    readonly rightNowSub: (pending: string) => string
  }

  readonly fiat: {
    readonly heading: string
    readonly caption: string
    readonly currency: string
    readonly volume: string
    readonly orders: string
    readonly ticketAvg: string
    readonly p50: string
    readonly p90: string
    readonly empty: string
  }

  readonly pairs: {
    readonly ordersHeading: string
    readonly canceled: string
    readonly abandonmentRate: string
    readonly ticketAvg: string
    readonly largest: string
    readonly disputesHeading: string
    readonly disputeRate: string
    readonly resolutionMedian: string
    readonly devFees: string
    readonly coverage: string
    readonly impliedVolume: string
    readonly referenceVolume: string
  }

  readonly notMeasurable: {
    readonly heading: string
    readonly items: readonly { readonly title: string; readonly why: string }[]
  }

  readonly disputes: {
    readonly heading: string
    readonly listLabel: string
    readonly empty: string
    readonly asOf: (when: string) => string
  }

  readonly absence: {
    /** A figure the publisher reported as null. */
    readonly noData: string
    /** A figure the publisher could not measure, and said so. */
    readonly notMeasured: string
    /** A figure nothing published at all. */
    readonly notPublished: string
  }

  readonly inferred: {
    readonly mark: string
    readonly label: string
    readonly labelWith: (error: string) => string
  }

  readonly loading: {
    readonly announcement: (what: string) => string
    readonly figures: string
  }

  readonly fatal: {
    readonly heading: string
    readonly timeout: string
    readonly unverified: (reason: string) => string
    readonly note: string
  }

  readonly footnote: (relays: number) => string
}
