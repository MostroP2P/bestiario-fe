/**
 * Reproducing the bytes bestiario hashed.
 *
 * NOSTR-PUBLICATION §5 says `hash` is the SHA-256 of a document's `payload`,
 * and §10 step 5 has the client check it. But the daemon computes that hash
 * over a *different serialisation* than the one it puts on the wire:
 * `hash_of` serialises the Rust struct, so keys come out in declaration
 * order, while the envelope carries `serde_json::to_value`, whose maps are
 * BTreeMaps and come out alphabetically sorted at every level.
 *
 * Hashing the bytes as received therefore verifies nothing: measured against
 * the live publisher, 0 of 32. Re-serialised in declaration order, 32 of 32.
 *
 * This module is the only place that may produce those bytes, and the only
 * thing that can prove it right is the bytes the daemon actually produced —
 * which is why its test runs over the real fixtures and asserts 32 of 32 and
 * not "most". It is also the module that disappears the day the daemon
 * serialises the envelope from the typed struct, at which point this becomes
 * `JSON.stringify` of what was received and the fixtures prove the collapse
 * was safe.
 */
import {
  isSeries,
  type Cell,
  type Column,
  type Fiat,
  type Metric,
  type MetricValue,
  type Payload,
  type Range,
  type Unit,
} from './documents'

/** Units whose Rust type is `f64` and which therefore always carry a point. */
const FLOAT_UNITS: ReadonlySet<Unit> = new Set<Unit>(['ratio', 'fiat'])

/**
 * A float the way `serde_json` renders one: shortest round-trip, always with
 * a decimal point. `1.0` is `1.0` and not `1`; `0.0` is `0.0`.
 *
 * JavaScript's `String` gives the same shortest digits and drops the `.0`, so
 * it is appended when the output carries no `.`, `e` or `E`. Negative zero is
 * the one value `String` loses outright — it prints `0` — and Rust prints
 * `-0.0`, so it is spelled out.
 */
export function renderFloat(value: number): string {
  if (Object.is(value, -0)) return '-0.0'
  const text = String(value)
  return /[.eE]/.test(text) ? text : `${text}.0`
}

/** An integer: `count`, `sats` and `seconds` are Rust `i64`. */
function renderInt(value: number): string {
  return String(value)
}

function renderString(value: string): string {
  // Byte-identical to serde_json for the character classes these documents
  // carry: ASCII, plus UTF-8 that both emit raw.
  return JSON.stringify(value)
}

function isFiat(value: MetricValue): value is Fiat {
  return (
    typeof value === 'object' && value !== null && 'amount' in value && 'code' in value
  )
}

/** A metric's value. `fiat` is an object here; in a row it is a bare float. */
function renderValue(value: MetricValue, unit: Unit): string {
  if (value === null) return 'null'
  if (typeof value === 'string') return renderString(value)
  if (isFiat(value)) {
    return `{"amount":${renderFloat(value.amount)},"code":${renderString(value.code)}}`
  }
  return FLOAT_UNITS.has(unit) ? renderFloat(value) : renderInt(value)
}

/**
 * A row cell. A `fiat` cell is a bare float and not an `{amount, code}`
 * object: `cell()` in the daemon writes the amount alone. The two shapes
 * share a unit name, and treating them alike is what made three of the
 * thirty-two fail a first reconstruction.
 */
function renderCell(cell: Cell, unit: Unit): string {
  if (cell === null) return 'null'
  if (typeof cell === 'string') return renderString(cell)
  return FLOAT_UNITS.has(unit) ? renderFloat(cell) : renderInt(cell)
}

/** `Range`: `from`, `until`. */
function renderRange(range: Range): string {
  return `{"from":${renderString(range.from)},"until":${renderString(range.until)}}`
}

/** `Metric`: `name`, `kind`, `unit`, `value`, and `error` only when present. */
function renderMetric(metric: Metric): string {
  const head =
    `{"name":${renderString(metric.name)}` +
    `,"kind":${renderString(metric.kind)}` +
    `,"unit":${renderString(metric.unit)}` +
    `,"value":${renderValue(metric.value, metric.unit)}`
  const tail = metric.error === undefined ? '' : `,"error":${renderString(metric.error)}`
  return `${head}${tail}}`
}

/** `Column`: `name`, `kind` when present, `unit`, `error` when present. */
function renderColumn(column: Column): string {
  const kind = column.kind === undefined ? '' : `,"kind":${renderString(column.kind)}`
  const error = column.error === undefined ? '' : `,"error":${renderString(column.error)}`
  return `{"name":${renderString(column.name)}${kind},"unit":${renderString(column.unit)}${error}}`
}

function list(parts: readonly string[]): string {
  return `[${parts.join(',')}]`
}

/**
 * The payload as bestiario hashed it. The one exported function here, and no
 * other module may hash.
 */
export function canonicalPayload(payload: Payload): string {
  if (isSeries(payload)) {
    const columns = list(payload.columns.map(renderColumn))
    const rows = list(
      payload.rows.map((row) =>
        list(row.map((cell, i) => renderCell(cell, payload.columns[i]?.unit ?? 'count'))),
      ),
    )
    return (
      `{"period":${renderRange(payload.period)}` +
      `,"resolution":${renderString(payload.resolution)}` +
      `,"columns":${columns}` +
      `,"rows":${rows}}`
    )
  }

  return `{"range":${renderRange(payload.range)},"metrics":${list(payload.metrics.map(renderMetric))}}`
}
