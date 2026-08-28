/**
 * The `d` grammar of NOSTR-PUBLICATION §3, as a type.
 *
 * A client constructs these; a typo must be a miss and never a fuzzy match.
 * Parsing and printing are inverses, and are tested as such over the whole
 * generated grammar.
 *
 * `scope` is carried from the start and left unpopulated, so the day the
 * daemon publishes `:i:<pubkey>` documents this is a value and not a
 * refactor.
 */

export const REPORTS = [
  'summary',
  'orders',
  'volume',
  'market',
  'disputes',
  'dev-fees',
  'instances',
  'compare',
] as const
export type Report = (typeof REPORTS)[number]

export const WINDOWS = ['24h', '7d', '30d', '90d', 'all'] as const
export type Span = (typeof WINDOWS)[number]

export const RESOLUTIONS = ['daily', 'weekly', 'monthly'] as const
export type Resolution = (typeof RESOLUTIONS)[number]

export type Scope = { readonly instance: string } | { readonly network: string }

export type Address =
  | { readonly kind: 'index' }
  | { readonly kind: 'window'; report: Report; window: Span; scope?: Scope }
  | {
      readonly kind: 'series'
      report: Report
      resolution: Resolution
      bucket: string
      scope?: Scope
    }

const DAILY_BUCKET = /^\d{4}-(0[1-9]|1[0-2])$/
const MONTHLY_BUCKET = /^\d{4}$/

function printScope(scope: Scope | undefined): string {
  if (!scope) return ''
  return 'instance' in scope ? `:i:${scope.instance}` : `:n:${scope.network}`
}

export function printAddress(address: Address): string {
  if (address.kind === 'index') return 'index'
  if (address.kind === 'window') {
    return `${address.report}:${address.window}${printScope(address.scope)}`
  }
  return `series:${address.report}:${address.resolution}:${address.bucket}${printScope(address.scope)}`
}

function isReport(text: string): text is Report {
  return (REPORTS as readonly string[]).includes(text)
}

function isWindow(text: string): text is Span {
  return (WINDOWS as readonly string[]).includes(text)
}

function isResolution(text: string): text is Resolution {
  return (RESOLUTIONS as readonly string[]).includes(text)
}

/** A bucket is `YYYY-MM` for daily and weekly, `YYYY` for monthly. */
function bucketFits(resolution: Resolution, bucket: string): boolean {
  return resolution === 'monthly' ? MONTHLY_BUCKET.test(bucket) : DAILY_BUCKET.test(bucket)
}

function parseScope(parts: readonly string[]): Scope | null | undefined {
  if (parts.length === 0) return undefined
  if (parts.length !== 2) return null
  // Both present: the length was just checked.
  const marker = parts[0]!
  const value = parts[1]!
  if (marker === 'i') return /^[0-9a-f]{64}$/.test(value) ? { instance: value } : null
  if (marker === 'n' && value.length > 0) return { network: value }
  return null
}

/** The address `text` names, or null. Lowercase and exact. */
export function parseAddress(text: string): Address | null {
  if (text !== text.toLowerCase()) return null
  if (text === 'index') return { kind: 'index' }

  const parts = text.split(':')

  if (parts[0] === 'series') {
    const [, report, resolution, bucket, ...rest] = parts
    if (!report || !resolution || !bucket) return null
    if (!isReport(report) || !isResolution(resolution)) return null
    if (!bucketFits(resolution, bucket)) return null
    const scope = parseScope(rest)
    if (scope === null) return null
    return scope === undefined
      ? { kind: 'series', report, resolution, bucket }
      : { kind: 'series', report, resolution, bucket, scope }
  }

  const [report, window, ...rest] = parts
  if (!report || !window) return null
  if (!isReport(report) || !isWindow(window)) return null
  const scope = parseScope(rest)
  if (scope === null) return null
  return scope === undefined
    ? { kind: 'window', report, window }
    : { kind: 'window', report, window, scope }
}

/** Shorthand for the address a route asks for. */
export function windowAddress(report: Report, window: Span): string {
  return printAddress({ kind: 'window', report, window })
}
