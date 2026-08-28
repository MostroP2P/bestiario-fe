/**
 * Everything the map draws, computed from the lines and nothing else.
 *
 * Pure: given the same active lines and the same projection, the same scene.
 * The component renders this and animates along it; it decides nothing. That
 * is what makes "five ARS orders are five lines" a property this file can be
 * tested for rather than something to squint at in a browser.
 *
 * Lines that cannot be placed are not silently dropped — they are counted, so
 * the panel can say what it is not showing. SPEC 2: absence renders as
 * absence, never as nothing at all.
 */
import { arcPoints, bowPoints, type Point, type Projection } from './geometry'
import type { Line, LinePhase } from '~/model/live-lines'
import type { LonLat } from '~/model/random-point'

const SAMPLES = 48

/**
 * How far a route bows, as a fraction of the straight distance between its
 * ends.
 *
 * Every route bows, including a lone one. A great circle projected onto a
 * flat map is a straight line often enough — between two places at similar
 * latitudes, or over a short hop — and a straight line across a world map
 * reads as a diagram rather than as a route. The arc is the visual language
 * of a path over a globe, and a map that only sometimes uses it looks broken
 * rather than varied.
 */
const BOW_RATIO = 0.17

/** A short hop still curves: proportion alone would leave it flat. */
const MIN_BOW = 16

/**
 * A ceiling on the bow, as a fraction of the map's height.
 *
 * Proportion alone sends a route that crosses the world hundreds of pixels
 * off its chord, out past the sphere and off the panel. A route that leaves
 * the globe stops reading as a route over it.
 */
export const MAX_BOW_OF_HEIGHT = 0.3

/**
 * How far a fan spreads either side of its route's own curve, as a fraction
 * of that curve.
 *
 * Multiplicative and not additive: an additive spread wider than the base bow
 * pushes an inner line back through zero and out the other side, and a line
 * with no bow is the straight line this whole scheme exists to avoid.
 */
const FAN_SPREAD = 0.55

export type SceneArc = {
  readonly orderId: string
  readonly fiat: string
  readonly instancePubkey: string
  readonly phase: LinePhase
  readonly points: Point[]
}

export type Scene = {
  readonly arcs: SceneArc[]
  /**
   * `lines` is how many arcs rest on the currency; `weight` is what the
   * network published about it — orders in the window — and is what sizes
   * the node. The two differ whenever a currency is traded but the map
   * cannot draw the instance trading it, which is the state of the wire
   * until bestiario publishes `instances`.
   */
  readonly currencies: { code: string; xy: Point; lines: number; weight: number }[]
  readonly instances: { pubkey: string; label: string; xy: Point; lines: number }[]
  /** How many distinct places the map could not honestly draw. */
  readonly unplaced: { currencies: number; instances: number }
}

export type SceneInput = {
  readonly lines: readonly Line[]
  /**
   * Currencies to draw whether or not a line reaches them, with what the
   * network published about each. A currency with orders and no drawable
   * counterparty is still a market, and leaving it off the map would
   * understate the network rather than admit what is missing.
   */
  readonly currencies?: readonly { readonly code: string; readonly weight: number }[]
  readonly currencyAt: (code: string) => LonLat | null
  readonly instanceAt: (pubkey: string) => LonLat | null
  readonly instanceLabel: (pubkey: string) => string
  readonly project: Projection
  readonly samples?: number
  /** The tallest bow any route may take, so none leaves the sphere. */
  readonly maxBow?: number
}

/**
 * How far a route of this straight-line length bows at its midpoint, capped
 * so a long one stays on the globe it is drawn over.
 */
export function bowFor(chord: number, maxBow: number = Infinity): number {
  return Math.min(Math.max(MIN_BOW, chord * BOW_RATIO), Math.max(MIN_BOW, maxBow))
}

/**
 * The bow of each line in a fan of `count`, spread around `base`.
 *
 * Every one of them curves, and they curve by visibly different amounts, so
 * five orders on a route read as five lines rather than as one thick one —
 * and none of them comes out straight.
 */
export function bowSet(count: number, base: number): number[] {
  if (count <= 0) return []
  const centre = (count - 1) / 2
  const step = centre === 0 ? 0 : FAN_SPREAD / centre
  return Array.from({ length: count }, (_, i) => base * (1 + (i - centre) * step))
}

export function buildScene(input: SceneInput): Scene {
  const samples = input.samples ?? SAMPLES

  // Grouped by route first: a fan is a property of the route, not of an order.
  const byRoute = new Map<string, Line[]>()
  for (const line of input.lines) {
    const key = `${line.fiat} ${line.instancePubkey}`
    const group = byRoute.get(key)
    if (group) group.push(line)
    else byRoute.set(key, [line])
  }

  const currencyXy = new Map<string, Point>()
  const instanceXy = new Map<string, Point>()
  const currencyLines = new Map<string, number>()
  const instanceLines = new Map<string, number>()
  const unplacedCurrencies = new Set<string>()
  const unplacedInstances = new Set<string>()
  const arcs: SceneArc[] = []

  for (const group of byRoute.values()) {
    const { fiat, instancePubkey } = group[0]!

    const from = input.currencyAt(fiat)
    if (!from) unplacedCurrencies.add(fiat)
    const to = input.instanceAt(instancePubkey)
    if (!to) unplacedInstances.add(instancePubkey)
    if (!from || !to) continue

    const spine = arcPoints(from, to, input.project, samples)
    if (!spine) continue

    // Every route curves, and a fan curves around that curve rather than
    // around the chord — so no line in a fan comes out straight either.
    const first = spine[0]!
    const last = spine[spine.length - 1]!
    const base = bowFor(
      Math.hypot(last[0] - first[0], last[1] - first[1]),
      input.maxBow ?? Infinity,
    )
    const bows = bowSet(group.length, base)

    group.forEach((line, i) => {
      arcs.push({
        orderId: line.orderId,
        fiat: line.fiat,
        instancePubkey: line.instancePubkey,
        phase: line.phase,
        points: bowPoints(spine, bows[i] ?? base),
      })
    })

    currencyXy.set(fiat, spine[0]!)
    instanceXy.set(instancePubkey, spine[spine.length - 1]!)
    currencyLines.set(fiat, (currencyLines.get(fiat) ?? 0) + group.length)
    instanceLines.set(
      instancePubkey,
      (instanceLines.get(instancePubkey) ?? 0) + group.length,
    )
  }

  // Currencies with published activity but no drawable line still belong on
  // the map; their point comes from the same projection.
  const weights = new Map((input.currencies ?? []).map((c) => [c.code, c.weight]))
  for (const { code } of input.currencies ?? []) {
    if (currencyXy.has(code)) continue
    const at = input.currencyAt(code)
    if (!at) {
      unplacedCurrencies.add(code)
      continue
    }
    const xy = input.project(at)
    if (xy) currencyXy.set(code, xy)
    else unplacedCurrencies.add(code)
  }

  return {
    arcs,
    currencies: [...currencyXy].map(([code, xy]) => ({
      code,
      xy,
      lines: currencyLines.get(code) ?? 0,
      weight: weights.get(code) ?? currencyLines.get(code) ?? 0,
    })),
    instances: [...instanceXy].map(([pubkey, xy]) => ({
      pubkey,
      label: input.instanceLabel(pubkey),
      xy,
      lines: instanceLines.get(pubkey) ?? 0,
    })),
    unplaced: {
      currencies: unplacedCurrencies.size,
      instances: unplacedInstances.size,
    },
  }
}
