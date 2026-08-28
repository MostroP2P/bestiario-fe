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
const SPACING = 9

export type SceneArc = {
  readonly orderId: string
  readonly fiat: string
  readonly instancePubkey: string
  readonly phase: LinePhase
  readonly points: Point[]
}

export type Scene = {
  readonly arcs: SceneArc[]
  readonly currencies: { code: string; xy: Point; lines: number }[]
  readonly instances: { pubkey: string; label: string; xy: Point; lines: number }[]
  /** How many distinct places the map could not honestly draw. */
  readonly unplaced: { currencies: number; instances: number }
}

export type SceneInput = {
  readonly lines: readonly Line[]
  readonly currencyAt: (code: string) => LonLat | null
  readonly instanceAt: (pubkey: string) => LonLat | null
  readonly instanceLabel: (pubkey: string) => string
  readonly project: Projection
  readonly samples?: number
  readonly spacing?: number
}

/**
 * Bow amounts that fan `count` lines symmetrically around their route, so the
 * fifth order on a route is visibly the fifth and not a redraw of the first.
 */
export function fanOffsets(count: number, spacing: number): number[] {
  const centre = (count - 1) / 2
  return Array.from({ length: count }, (_, i) => (i - centre) * spacing)
}

export function buildScene(input: SceneInput): Scene {
  const samples = input.samples ?? SAMPLES
  const spacing = input.spacing ?? SPACING

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

    const offsets = fanOffsets(group.length, spacing)
    group.forEach((line, i) => {
      arcs.push({
        orderId: line.orderId,
        fiat: line.fiat,
        instancePubkey: line.instancePubkey,
        phase: line.phase,
        points: bowPoints(spine, offsets[i] ?? 0),
      })
    })

    currencyXy.set(fiat, spine[0]!)
    instanceXy.set(instancePubkey, spine[spine.length - 1]!)
    currencyLines.set(fiat, (currencyLines.get(fiat) ?? 0) + group.length)
    instanceLines.set(instancePubkey, (instanceLines.get(instancePubkey) ?? 0) + group.length)
  }

  return {
    arcs,
    currencies: [...currencyXy].map(([code, xy]) => ({
      code,
      xy,
      lines: currencyLines.get(code) ?? 0,
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
