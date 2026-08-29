/**
 * Reading a report's metrics.
 *
 * A window payload is a flat list of records, and the site looks figures up
 * by name. The one place a metric *name* is parsed rather than matched is the
 * `volume.fiat.<CODE>.<figure>` family — a currency is a first-class column
 * in the table, not a suffix in a string — and the grammar for it lives here,
 * with its own tests, because a name pattern is a contract the daemon can
 * change.
 */
import type { Metric, Payload } from '~/nostr/documents'
import { isSeries } from '~/nostr/documents'

export function metricsOf(payload: Payload | undefined): readonly Metric[] {
  if (!payload || isSeries(payload)) return []
  return payload.metrics
}

export function lookup(metrics: readonly Metric[], name: string): Metric | undefined {
  return metrics.find((metric) => metric.name === name)
}

/** Figures published per currency, grouped by code. */
export type FiatRow = {
  readonly code: string
  readonly figures: ReadonlyMap<string, Metric>
}

const FIAT_NAME = /^volume\.fiat\.([A-Z]{3})\.(.+)$/

/**
 * `volume.fiat.<CODE>.<figure>` grouped into one row per currency, ordered by
 * the code so the table is stable. A name that does not fit the pattern is
 * ignored rather than guessed at.
 */
export function fiatRows(metrics: readonly Metric[]): FiatRow[] {
  const rows = new Map<string, Map<string, Metric>>()
  for (const metric of metrics) {
    const match = FIAT_NAME.exec(metric.name)
    if (!match) continue
    // Both groups are `+`-quantified, so a match has them.
    const code = match[1]!
    const figure = match[2]!
    const row = rows.get(code) ?? new Map<string, Metric>()
    row.set(figure, metric)
    rows.set(code, row)
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, figures]) => ({ code, figures }))
}

/**
 * `<prefix><label>.<figure>` grouped into one block per label, in the
 * publisher's order.
 *
 * The key is a display *label* — `Mostro (82fa8cb9)`, spaces, parentheses
 * and emoji included — so a name is split from the *right*, on its last dot,
 * and never from the left: `mostro.network (abc).volume_sats` has to survive
 * it. Two families are written this way, `instances.` and `compare.`, and
 * both read the grammar from here.
 */
export function labelledBlocks(
  metrics: readonly Metric[],
  prefix: string,
): Map<string, Map<string, Metric>> {
  const blocks = new Map<string, Map<string, Metric>>()
  for (const metric of metrics) {
    if (!metric.name.startsWith(prefix)) continue
    const rest = metric.name.slice(prefix.length)
    const dot = rest.lastIndexOf('.')
    if (dot <= 0 || dot === rest.length - 1) continue
    const label = rest.slice(0, dot)
    const block = blocks.get(label) ?? new Map<string, Metric>()
    block.set(rest.slice(dot + 1), metric)
    blocks.set(label, block)
  }
  return blocks
}

/** A currency code as the documents write one: three uppercase letters. */
const CODE = /^[A-Z]{3}$/

/**
 * The currency blocks of a family — `orders.ARS.completed`,
 * `orders.EUR.created` — one per code, with the figures as they were
 * published so an absent one stays absent.
 *
 * Told apart from the family's own figures by the shape of the segment and
 * not by position: `orders.completed` is the whole window's and opens no
 * block, `orders.completion_rate` is not a code either, and a publisher who
 * adds a figure to the block needs no change here.
 */
export function codeBlocks(
  metrics: readonly Metric[],
  prefix: string,
): { code: string; figures: ReadonlyMap<string, Metric> }[] {
  return [...labelledBlocks(metrics, prefix).entries()]
    .filter(([code]) => CODE.test(code))
    .map(([code, figures]) => ({ code, figures }))
}

/**
 * An indexed family — `disputes.open.1.id`, `disputes.open.1.age` — rebuilt
 * into one record per entry, in the publisher's order.
 */
export function indexedFamily(
  metrics: readonly Metric[],
  prefix: string,
): { index: number; figures: Map<string, Metric> }[] {
  const pattern = new RegExp(`^${prefix.replace(/\./g, '\\.')}\\.(\\d+)\\.(.+)$`)
  const entries = new Map<number, Map<string, Metric>>()
  for (const metric of metrics) {
    const match = pattern.exec(metric.name)
    if (!match) continue
    const index = Number(match[1])
    const figure = match[2]!
    const record = entries.get(index) ?? new Map<string, Metric>()
    record.set(figure, metric)
    entries.set(index, record)
  }
  return [...entries.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, figures]) => ({ index, figures }))
}
