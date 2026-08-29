/**
 * Figures, as pixels.
 *
 * Formatted by unit and never by name (SPEC 9), so a new metric of a known
 * unit needs no code here. Numbers go through `Intl.NumberFormat` in the
 * reader's locale; the canonicalisation of SPEC 5 never touches a formatter,
 * and no formatter ever touches a hash.
 *
 * Absence is an em dash with a label saying *which* absence it is — nothing
 * to report, or outside what the archive covers — and never a zero.
 */
import type { Fiat, Metric, MetricValue, Unit } from '~/nostr/documents'

export const ABSENT = '—'

/**
 * Which absence a dash stands for. A kind and not a sentence: this module
 * formats figures and knows no language, and the words for these live with
 * every other user-facing string.
 */
export type Absence = 'noData' | 'notMeasured' | 'notPublished'

export type Formatted = {
  readonly text: string
  /** Null when the figure is present; otherwise which absence it is. */
  readonly absence: Absence | null
}

function absent(absence: Absence): Formatted {
  return { text: ABSENT, absence }
}

function plain(text: string): Formatted {
  return { text, absence: null }
}

/** How this language abbreviates a duration. Set alongside the number locale. */
export type DurationUnits = {
  readonly days: string
  readonly hours: string
  readonly minutes: string
  readonly seconds: string
}

let units: DurationUnits = { days: 'd', hours: 'h', minutes: 'm', seconds: 's' }

/** Numbers follow the language the page is rendered in, not the browser's. */
let numberLocale: string | undefined
let integers = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
let oneDecimal = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/**
 * Format numbers for `locale` from here on.
 *
 * A page rendered in English for a reader whose browser is Spanish would
 * otherwise print English words around Spanish thousands separators.
 */
export function useNumberLocale(locale: string, durationUnits?: DurationUnits): void {
  if (durationUnits) units = durationUnits
  if (locale === numberLocale) return
  numberLocale = locale
  integers = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 })
  oneDecimal = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
}

function isFiat(value: MetricValue): value is Fiat {
  return typeof value === 'object' && value !== null && 'amount' in value
}

/** A duration a person reads: `4 h 12 m`, `3 m 04 s`, `41 s`. */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const days = Math.floor(total / 86_400)
  const hours = Math.floor((total % 86_400) / 3_600)
  const minutes = Math.floor((total % 3_600) / 60)
  const secs = total % 60

  if (days > 0)
    return `${days} ${units.days} ${String(hours).padStart(2, '0')} ${units.hours}`
  if (hours > 0)
    return `${hours} ${units.hours} ${String(minutes).padStart(2, '0')} ${units.minutes}`
  if (minutes > 0)
    return `${minutes} ${units.minutes} ${String(secs).padStart(2, '0')} ${units.seconds}`
  return `${secs} ${units.seconds}`
}

/** A figure, by its unit. */
export function formatValue(value: MetricValue, unit: Unit): Formatted {
  // The unit is asked first: `missing` is a figure the publisher could not
  // measure and says why, which is a different absence from a figure that
  // is simply null. SPEC 9 asks for the difference to reach the reader.
  if (unit === 'missing') return absent('notMeasured')
  if (value === null) return absent('noData')

  switch (unit) {
    case 'count':
      return typeof value === 'number' ? plain(integers.format(value)) : absent('noData')
    case 'sats':
      // Never silently converted to BTC: a figure in sats is in sats.
      return typeof value === 'number'
        ? plain(`${integers.format(value)} sats`)
        : absent('noData')
    case 'ratio':
      return typeof value === 'number'
        ? plain(`${oneDecimal.format(value * 100)} %`)
        : absent('noData')
    case 'seconds':
      return typeof value === 'number' ? plain(formatDuration(value)) : absent('noData')
    case 'fiat':
      return isFiat(value)
        ? plain(`${integers.format(value.amount)} ${value.code}`)
        : typeof value === 'number'
          ? plain(integers.format(value))
          : absent('noData')
    case 'text':
    case 'date':
      return typeof value === 'string' ? plain(value) : absent('noData')
  }
}

/** A plain count, grouped for the page's language. */
export function formatCount(value: number): string {
  return integers.format(value)
}

export function formatMetric(metric: Metric | undefined): Formatted {
  if (!metric) return absent('notPublished')
  return formatValue(metric.value, metric.unit)
}

/** How old the data is, from a signed `created_at` in seconds. */
export function formatAge(createdAtSeconds: number, nowMs: number): string {
  return formatDuration(Math.max(0, nowMs / 1000 - createdAtSeconds))
}
