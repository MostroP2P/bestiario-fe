/**
 * What bestiario publishes, as types.
 *
 * Two payload shapes (NOSTR-PUBLICATION §6.1, §6.2) inside one envelope. The
 * envelope describes the run — which publication computed this, when, how
 * many times the figures have moved — and `payload` is the answer. Only
 * `payload` is hashed, which is what makes a closed partition cacheable.
 */

/** The units a figure can carry. `missing` is absence with a reason. */
export type Unit =
  | 'count'
  | 'sats'
  | 'seconds'
  | 'ratio'
  | 'fiat'
  | 'text'
  | 'missing'
  | 'date'

/** SPEC 5: observed is measured, inferred rests on an assumption. */
export type MetricKind = 'observed' | 'inferred'

export type Fiat = { readonly amount: number; readonly code: string }

export type MetricValue = number | string | Fiat | null

export type Metric = {
  readonly name: string
  readonly kind: MetricKind
  readonly unit: Unit
  readonly value: MetricValue
  /** Why a figure is inferred, or why it is missing. */
  readonly error?: string
}

export type Range = { readonly from: string; readonly until: string }

export type WindowPayload = {
  readonly range: Range
  readonly metrics: readonly Metric[]
}

export type Column = {
  readonly name: string
  readonly kind?: MetricKind
  readonly unit: Unit
  readonly error?: string
}

/** A row cell: a number, a date, or absence. Never a `{amount, code}` object. */
export type Cell = number | string | null

export type SeriesPayload = {
  readonly period: Range
  readonly resolution: string
  readonly columns: readonly Column[]
  readonly rows: readonly (readonly Cell[])[]
}

export type Payload = WindowPayload | SeriesPayload

export function isSeries(payload: Payload): payload is SeriesPayload {
  return 'columns' in payload
}

export type Envelope = {
  readonly schema_version: number
  readonly snapshot_id: string
  readonly generated_at: string
  readonly revision: number
  readonly restated_at?: string
  readonly restated_because?: string
  readonly payload: Payload
}

/** One line of the index's `documents[]` (§5). */
export type IndexEntry = {
  readonly d: string
  readonly hash: string
  readonly revision: number
  readonly updated_at: string
  readonly restated_at?: string
  readonly restated_because?: string
}

export type IndexDoc = {
  readonly schema_version: number
  readonly snapshot_id: string
  readonly generated_at: string
  readonly publisher: { readonly name: string; readonly version: string }
  /** The archive's real extent. A period outside it is not zero (§6.3). */
  readonly coverage: { readonly first_event_at: string; readonly last_event_at: string }
  readonly resolutions: Readonly<Record<string, { from: string; until: string }>>
  readonly documents: readonly IndexEntry[]
}
