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

export type Formatted = {
  readonly text: string
  /** What a screen reader says. Differs from `text` exactly for absence. */
  readonly label: string
  readonly absent: boolean
}

function absent(label: string): Formatted {
  return { text: ABSENT, label, absent: true }
}

function plain(text: string): Formatted {
  return { text, label: text, absent: false }
}

const integers = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 })
const oneDecimal = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

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

  if (days > 0) return `${days} d ${String(hours).padStart(2, '0')} h`
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} m`
  if (minutes > 0) return `${minutes} m ${String(secs).padStart(2, '0')} s`
  return `${secs} s`
}

/** A figure, by its unit. */
export function formatValue(value: MetricValue, unit: Unit): Formatted {
  // The unit is asked first: `missing` is a figure the publisher could not
  // measure and says why, which is a different absence from a figure that
  // is simply null. SPEC 9 asks for the difference to reach the reader.
  if (unit === 'missing') return absent('no medido')
  if (value === null) return absent('sin dato')

  switch (unit) {
    case 'count':
      return typeof value === 'number' ? plain(integers.format(value)) : absent('sin dato')
    case 'sats':
      // Never silently converted to BTC: a figure in sats is in sats.
      return typeof value === 'number'
        ? plain(`${integers.format(value)} sats`)
        : absent('sin dato')
    case 'ratio':
      return typeof value === 'number'
        ? plain(`${oneDecimal.format(value * 100)} %`)
        : absent('sin dato')
    case 'seconds':
      return typeof value === 'number' ? plain(formatDuration(value)) : absent('sin dato')
    case 'fiat':
      return isFiat(value)
        ? plain(`${integers.format(value.amount)} ${value.code}`)
        : typeof value === 'number'
          ? plain(integers.format(value))
          : absent('sin dato')
    case 'text':
    case 'date':
      return typeof value === 'string' ? plain(value) : absent('sin dato')
  }
}

export function formatMetric(metric: Metric | undefined): Formatted {
  if (!metric) return absent('no publicado')
  return formatValue(metric.value, metric.unit)
}

/** How old the data is, from a signed `created_at` in seconds. */
export function formatAge(createdAtSeconds: number, nowMs: number): string {
  return formatDuration(Math.max(0, nowMs / 1000 - createdAtSeconds))
}
