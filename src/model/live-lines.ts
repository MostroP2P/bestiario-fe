/**
 * Which order flows belong on the world map right now.
 *
 * One line per order, from the country of the order's fiat currency to the
 * Mostro instance operating it. A line's lifetime is not the order's: an
 * order that settles keeps its line for a grace period, so a network that
 * completes quickly still reads as a network doing something. That period is
 * the knob in `config.ts` — ten minutes at today's volume, a minute at ten
 * times it — and nothing else in the renderer knows about time.
 *
 * Pure: same orders and same clock, same lines. The animation reads this; it
 * never decides it.
 */

export type LiveOrder = {
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
  readonly liveStatuses: readonly string[]
  readonly settlingStatuses: readonly string[]
  readonly maxLines: number
}

function phaseOf(order: LiveOrder, nowMs: number, cfg: LineConfig): LinePhase | null {
  if (cfg.liveStatuses.includes(order.status)) return 'live'
  if (!cfg.settlingStatuses.includes(order.status)) return null
  // Exclusive: at exactly graceMs the line is gone. A clock skewed into the
  // future yields a negative age, which is inside any positive grace period —
  // the publisher's clock is not this site's problem to correct.
  return nowMs - order.updatedAt < cfg.graceMs ? 'settling' : null
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
  for (const order of orders) {
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
