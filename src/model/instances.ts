/**
 * Reading the instance documents.
 *
 * `instances:<window>` carries one block per Mostro instance the archive
 * knows, and `orders:<window>:i:<pubkey>` carries that instance's orders
 * broken down by the currencies it traded. Together they are the only thing
 * published that says *which instance trades which currency* — the cross the
 * map is drawn from.
 *
 * Two shapes here bite a careless reader, and NOSTR-CLIENT documents both.
 *
 * The key inside a metric name is a display *label* — `Mostro (82fa8cb9)`,
 * spaces, parentheses and emoji included — and not a pubkey. So a name is
 * split from the right, on its last dot, and never from the left: a label may
 * contain dots, and `mostro.network (abc).created` has to survive it. The
 * pubkey to address the instance by is a row of the block, not its key.
 *
 * A currency block sits under the same prefix as the instance's own totals:
 * `orders.created` is the instance's, `orders.ARS.created` is one currency's.
 * They are told apart by the shape of the segment, not by position.
 */
import type { Metric } from '~/nostr/documents'

/** Splits `instances.<label>.<figure>` from the right. */
function splitLast(name: string, prefix: string): { key: string; figure: string } | null {
  if (!name.startsWith(prefix)) return null
  const rest = name.slice(prefix.length)
  const dot = rest.lastIndexOf('.')
  if (dot <= 0 || dot === rest.length - 1) return null
  return { key: rest.slice(0, dot), figure: rest.slice(dot + 1) }
}

export type InstanceRow = {
  /** The label the publisher keys the block by. Not an address. */
  readonly label: string
  /** 64 lowercase hex, and the only thing an address may be built from. */
  readonly pubkey: string
  /** What the instance calls itself, which is where a flag would be. */
  readonly name: string
  /** Orders it created in the window. */
  readonly created: number
  readonly figures: ReadonlyMap<string, Metric>
}

const PUBKEY = /^[0-9a-f]{64}$/

/**
 * One row per instance, in the publisher's order.
 *
 * A block whose `pubkey` is absent or malformed is dropped: it cannot be
 * addressed, so nothing can be fetched for it and nothing about it can be
 * checked. Silently drawing it would be drawing a claim about an instance
 * this client cannot name.
 */
export function instanceRows(metrics: readonly Metric[]): InstanceRow[] {
  const blocks = new Map<string, Map<string, Metric>>()
  for (const metric of metrics) {
    const split = splitLast(metric.name, 'instances.')
    if (!split) continue
    const block = blocks.get(split.key) ?? new Map<string, Metric>()
    block.set(split.figure, metric)
    blocks.set(split.key, block)
  }

  const rows: InstanceRow[] = []
  for (const [label, figures] of blocks) {
    const pubkey = figures.get('pubkey')?.value
    if (typeof pubkey !== 'string' || !PUBKEY.test(pubkey)) continue
    const name = figures.get('name')?.value
    const created = figures.get('created')?.value
    rows.push({
      label,
      pubkey,
      name: typeof name === 'string' ? name : label,
      created: typeof created === 'number' ? created : 0,
      figures,
    })
  }
  return rows
}

export type CurrencyOrders = {
  readonly code: string
  readonly created: number
  readonly openNow: number
}

/** A currency code as the documents write one: three uppercase letters. */
const CODE = /^[A-Z]{3}$/

/**
 * The currencies one instance traded, from its scoped orders document.
 *
 * `orders.created` is the instance's own total and is not a currency; only a
 * segment shaped like a code opens a block. A code with no orders in the
 * window has no block at all, which is absence and not a zero.
 */
export function currencyOrders(metrics: readonly Metric[]): CurrencyOrders[] {
  const blocks = new Map<string, Map<string, Metric>>()
  for (const metric of metrics) {
    if (!metric.name.startsWith('orders.')) continue
    const rest = metric.name.slice('orders.'.length)
    const dot = rest.indexOf('.')
    if (dot <= 0) continue
    const code = rest.slice(0, dot)
    if (!CODE.test(code)) continue
    const figure = rest.slice(dot + 1)
    const block = blocks.get(code) ?? new Map<string, Metric>()
    block.set(figure, metric)
    blocks.set(code, block)
  }

  const numberOf = (block: Map<string, Metric>, figure: string): number => {
    const value = block.get(figure)?.value
    return typeof value === 'number' ? value : 0
  }

  return [...blocks.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, block]) => ({
      code,
      created: numberOf(block, 'created'),
      openNow: numberOf(block, 'open_now'),
    }))
}
