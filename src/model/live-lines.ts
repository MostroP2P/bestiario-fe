/**
 * Which order flows belong on the world map right now.
 *
 * One line per order, from the country of the order's fiat currency to the
 * Mostro instance operating it, read from that instance's own order events
 * (kind 38383). A line's lifetime is not the order's: an order that settles
 * keeps its line for a grace period, so a network that completes quickly
 * still reads as a network doing something. That period is the knob in
 * `config.ts` — five minutes at today's volume, a minute at ten times it —
 * and nothing else in the renderer knows about time.
 *
 * A live order is only live while its instance has spoken of it recently:
 * an instance that goes quiet would otherwise hold a line up forever.
 *
 * Pure: same orders and same clock, same lines. The animation reads this; it
 * never decides it.
 */

import { keyOf, supersedes } from './open-disputes'

export type LiveOrder = {
  /** The Nostr event id, which NIP-01 breaks a timestamp tie on. */
  readonly eventId: string
  /** The order's `d` tag — its identity across status changes. */
  readonly id: string
  /** ISO 4217 code from the order's `f` tag, e.g. `ARS`. */
  readonly fiat: string
  /** The order's `s` tag. */
  readonly status: string
  /** The Mostro instance that signed the event. */
  readonly instancePubkey: string
  /** Milliseconds since epoch, from the event's signed `created_at`. */
  readonly updatedAt: number
}

/** A line's lifetime: `live` while the order is, `settling` during the grace period. */
export type LinePhase = 'live' | 'settling'

export type Line = {
  readonly orderId: string
  readonly fiat: string
  readonly instancePubkey: string
  readonly phase: LinePhase
  readonly updatedAt: number
}

export type LineConfig = {
  readonly graceMs: number
  /** How long a live status holds without its instance repeating it. */
  readonly liveWindowMs: number
  readonly liveStatuses: readonly string[]
  readonly settlingStatuses: readonly string[]
  readonly maxLines: number
}

function phaseOf(order: LiveOrder, nowMs: number, cfg: LineConfig): LinePhase | null {
  // Exclusive at both bounds: at exactly the limit the line is gone. A clock
  // skewed into the future yields a negative age, which is inside any
  // positive period — an instance's clock is not this site's to correct.
  const age = nowMs - order.updatedAt
  if (cfg.liveStatuses.includes(order.status)) {
    return age < cfg.liveWindowMs ? 'live' : null
  }
  if (cfg.settlingStatuses.includes(order.status)) {
    return age < cfg.graceMs ? 'settling' : null
  }
  return null
}

/**
 * Each order at its newest revision. 38383 is addressable, so a relay serving
 * an older status alongside the current one is normal and must never bring
 * back an order its instance has since canceled.
 */
function newestPerOrder(orders: readonly LiveOrder[]): LiveOrder[] {
  const newest = new Map<string, LiveOrder>()
  for (const order of orders) {
    const held = newest.get(keyOf(order))
    if (!held || supersedes(order, held)) newest.set(keyOf(order), order)
  }
  return [...newest.values()]
}

/**
 * The lines to draw, newest first, capped at `cfg.maxLines` so a spike
 * degrades into a sample rather than into a stalled tab. Ties on `updatedAt`
 * break on `id`, so the same input always yields the same map.
 */
export function activeLines(
  orders: readonly LiveOrder[],
  nowMs: number,
  cfg: LineConfig,
): Line[] {
  const lines: Line[] = []
  for (const order of newestPerOrder(orders)) {
    const phase = phaseOf(order, nowMs, cfg)
    if (phase === null) continue
    lines.push({
      orderId: order.id,
      fiat: order.fiat,
      instancePubkey: order.instancePubkey,
      phase,
      updatedAt: order.updatedAt,
    })
  }

  lines.sort((a, b) => b.updatedAt - a.updatedAt || a.orderId.localeCompare(b.orderId))
  return lines.slice(0, cfg.maxLines)
}

/**
 * The currencies with a line, each weighed by its lines, before the drawing
 * cap: the cap samples what is drawn, never which markets are counted.
 */
export function activeMarkets(
  orders: readonly LiveOrder[],
  nowMs: number,
  cfg: LineConfig,
): { code: string; weight: number }[] {
  const lines = new Map<string, number>()
  for (const line of activeLines(orders, nowMs, { ...cfg, maxLines: Infinity })) {
    lines.set(line.fiat, (lines.get(line.fiat) ?? 0) + 1)
  }
  return [...lines.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, weight]) => ({ code, weight }))
}
