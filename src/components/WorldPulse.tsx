import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { Feature, Geometry } from 'geojson'
import { createProjection } from '~/map/projection'
import { PALETTE } from '~/map/palette'
import { toPathData } from '~/map/geometry'
import { buildScene, type Scene, type SceneArc } from '~/map/scene'
import type { Line } from '~/model/live-lines'
import type { LonLat } from '~/model/random-point'

/**
 * The world map: one line per active order, from the country of its currency
 * to the Mostro instance trading it.
 *
 * The scene is computed in `map/scene.ts` and rendered here declaratively.
 * Only the travelling dots are driven imperatively, because pushing several
 * hundred circle positions through the virtual DOM sixty times a second is
 * work with nothing to show for it. Everything a reader can inspect — where
 * a line goes, how many there are, what phase it is in — is in the markup.
 */

export type WorldPulseProps = {
  readonly lines: readonly Line[]
  readonly land: readonly Feature<Geometry>[]
  readonly currencyAt: (code: string) => LonLat | null
  readonly instanceAt: (pubkey: string) => LonLat | null
  readonly instanceLabel: (pubkey: string) => string
  readonly height?: number
}

/** Seconds for a traveller to cross its line and come back. */
const ROUND_TRIP_S = 5.2

function useMeasuredWidth(ref: { current: HTMLElement | null }): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref])

  return width
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}

/** What the map says about itself to a reader who cannot see it. */
export function describeScene(scene: Scene): string {
  if (scene.arcs.length === 0) return 'No order flow to show.'

  const live = scene.arcs.filter((a) => a.phase === 'live').length
  const settling = scene.arcs.length - live
  const parts = [
    `${scene.arcs.length} order flows between ${scene.currencies.length} currencies and ${scene.instances.length} Mostro instances`,
    `${live} in progress`,
    `${settling} recently completed`,
  ]
  if (scene.unplaced.currencies > 0) {
    parts.push(`${scene.unplaced.currencies} currencies could not be placed on the map`)
  }
  if (scene.unplaced.instances > 0) {
    parts.push(`${scene.unplaced.instances} instances could not be placed on the map`)
  }
  return parts.join('; ') + '.'
}

function arcStyle(arc: SceneArc) {
  return arc.phase === 'live'
    ? { stroke: PALETTE.arcLive, opacity: 0.42, width: 1.1 }
    : { stroke: PALETTE.arcSettling, opacity: 0.24, width: 0.9 }
}

export function WorldPulse(props: WorldPulseProps) {
  const height = props.height ?? 408
  const holder = useRef<HTMLDivElement | null>(null)
  const width = useMeasuredWidth(holder)
  const reducedMotion = usePrefersReducedMotion()
  const travellers = useRef<(SVGCircleElement | null)[]>([])

  const projection = useMemo(
    () => (width > 0 ? createProjection(width, height) : null),
    [width, height],
  )

  const scene = useMemo<Scene>(() => {
    if (!projection) {
      return { arcs: [], currencies: [], instances: [], unplaced: { currencies: 0, instances: 0 } }
    }
    return buildScene({
      lines: props.lines,
      currencyAt: props.currencyAt,
      instanceAt: props.instanceAt,
      instanceLabel: props.instanceLabel,
      project: projection.project,
    })
  }, [projection, props.lines, props.currencyAt, props.instanceAt, props.instanceLabel])

  // The travelling dots. They ping-pong: out along the line and back, which is
  // what a negotiation between two parties looks like and what a one-way
  // stream of particles does not.
  useEffect(() => {
    if (reducedMotion || scene.arcs.length === 0) return
    let frame = 0
    const started = performance.now()

    const tick = (now: number) => {
      const elapsed = (now - started) / 1000
      scene.arcs.forEach((arc, i) => {
        const dot = travellers.current[i]
        if (!dot) return
        // A phase offset per line, so a fan of five reads as five travellers
        // rather than as one thick one.
        const cycle = ((elapsed + i * 0.37) % ROUND_TRIP_S) / ROUND_TRIP_S
        const t = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2
        const index = t * (arc.points.length - 1)
        const low = Math.floor(index)
        const high = Math.min(low + 1, arc.points.length - 1)
        const f = index - low
        const a = arc.points[low]
        const b = arc.points[high]
        if (!a || !b) return
        dot.setAttribute('cx', String(a[0] + (b[0] - a[0]) * f))
        dot.setAttribute('cy', String(a[1] + (b[1] - a[1]) * f))
        dot.setAttribute('opacity', (Math.sin(t * Math.PI) * 0.85 + 0.15).toFixed(2))
      })
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [scene, reducedMotion])

  travellers.current = []

  return (
    <div
      ref={holder}
      style={{ position: 'relative', width: '100%', height: `${height}px`, background: PALETTE.background }}
    >
      {projection && (
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={describeScene(scene)}
          style={{ position: 'absolute', inset: 0, display: 'block' }}
        >
          <defs>
            <radialGradient id="wp-glow-currency">
              <stop offset="0%" stop-color={PALETTE.currency} stop-opacity="0.5" />
              <stop offset="100%" stop-color={PALETTE.currency} stop-opacity="0" />
            </radialGradient>
            <radialGradient id="wp-glow-instance">
              <stop offset="0%" stop-color={PALETTE.instance} stop-opacity="0.42" />
              <stop offset="100%" stop-color={PALETTE.instance} stop-opacity="0" />
            </radialGradient>
          </defs>

          <path d={projection.sphere} fill={PALETTE.sphere} stroke={PALETTE.sphereStroke} stroke-width="1" />
          <path d={projection.graticule} fill="none" stroke={PALETTE.graticule} stroke-width="0.6" />
          <g>
            {props.land.map((feature, i) => (
              <path
                key={i}
                d={projection.pathFor(feature)}
                fill={PALETTE.land}
                stroke={PALETTE.landStroke}
                stroke-width="0.8"
              />
            ))}
          </g>

          <g>
            {scene.arcs.map((arc) => {
              const style = arcStyle(arc)
              return (
                <path
                  key={arc.orderId}
                  d={toPathData(arc.points)}
                  fill="none"
                  stroke={style.stroke}
                  stroke-width={style.width}
                  stroke-opacity={style.opacity}
                  stroke-dasharray={arc.phase === 'settling' ? '3 4' : undefined}
                />
              )
            })}
          </g>

          <g>
            {scene.instances.map((instance) => {
              const r = 2.6 + Math.sqrt(instance.lines) * 1.4
              return (
                <g key={instance.pubkey}>
                  <circle cx={instance.xy[0]} cy={instance.xy[1]} r={r * 4.5} fill="url(#wp-glow-instance)" />
                  <rect
                    x={instance.xy[0] - r}
                    y={instance.xy[1] - r}
                    width={r * 2}
                    height={r * 2}
                    fill={PALETTE.instance}
                    transform={`rotate(45 ${instance.xy[0]} ${instance.xy[1]})`}
                  />
                  <text
                    x={instance.xy[0] + r + 5}
                    y={instance.xy[1] + 3}
                    fill={PALETTE.label}
                    font-size="8.5"
                    letter-spacing="0.06em"
                    style={{ fontFamily: "'Martian Mono', ui-monospace, monospace" }}
                  >
                    {instance.label}
                  </text>
                </g>
              )
            })}
          </g>

          <g>
            {scene.currencies.map((currency) => {
              const r = 2.2 + Math.sqrt(currency.lines) * 1.5
              return (
                <g key={currency.code}>
                  <circle cx={currency.xy[0]} cy={currency.xy[1]} r={r * 5} fill="url(#wp-glow-currency)" />
                  <circle
                    cx={currency.xy[0]}
                    cy={currency.xy[1]}
                    r={r}
                    fill="none"
                    stroke={PALETTE.currency}
                    stroke-width="1"
                    stroke-opacity="0.5"
                  />
                  <circle cx={currency.xy[0]} cy={currency.xy[1]} r={r * 0.45} fill={PALETTE.currency} />
                  <text
                    x={currency.xy[0] + r + 5}
                    y={currency.xy[1] + 3}
                    fill={PALETTE.label}
                    font-size="8.5"
                    letter-spacing="0.06em"
                    style={{ fontFamily: "'Martian Mono', ui-monospace, monospace" }}
                  >
                    {currency.code}
                  </text>
                </g>
              )
            })}
          </g>

          {!reducedMotion && (
            <g>
              {scene.arcs.map((arc, i) => (
                <circle
                  key={arc.orderId}
                  ref={(el) => {
                    travellers.current[i] = el
                  }}
                  r={arc.phase === 'live' ? 1.9 : 1.4}
                  fill={arc.phase === 'live' ? PALETTE.traveller : PALETTE.arcSettling}
                  cx={arc.points[0]?.[0] ?? 0}
                  cy={arc.points[0]?.[1] ?? 0}
                  opacity="0.15"
                />
              ))}
            </g>
          )}
        </svg>
      )}
    </div>
  )
}
