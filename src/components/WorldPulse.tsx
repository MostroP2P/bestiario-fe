import { useEffect, useMemo, useRef } from 'preact/hooks'
import type { Feature, Geometry } from 'geojson'
import { PALETTE } from '~/map/palette'
import { toPathData } from '~/map/geometry'
import type { MapProjection } from '~/map/projection'
import { layoutLabels, type Label } from '~/map/labels'
import type { Scene, SceneArc } from '~/map/scene'

/**
 * The map itself: land, and one line per active order.
 *
 * A pure renderer. It is handed a scene and draws it; what belongs on the map
 * is decided in `map/scene.ts` and by the view above, so the panel's own
 * headline counts cannot disagree with what is on screen.
 *
 * Only the travelling dots are driven imperatively — pushing several hundred
 * circle positions through the virtual DOM sixty times a second is work with
 * nothing to show for it. Everything a reader can inspect is in the markup.
 */

export type WorldPulseProps = {
  readonly scene: Scene
  readonly land: readonly Feature<Geometry>[]
  readonly projection: MapProjection
  readonly width: number
  readonly height: number
  readonly reducedMotion: boolean
}

/** Seconds for a traveller to cross its line and come back. */
const ROUND_TRIP_S = 5.2

/** What the map says about itself to a reader who cannot see it. */
export function describeScene(scene: Scene): string {
  if (scene.arcs.length === 0) return 'Sin flujo de órdenes que mostrar.'

  const live = scene.arcs.filter((a) => a.phase === 'live').length
  const parts = [
    `${scene.arcs.length} órdenes activas entre ${scene.currencies.length} monedas y ${scene.instances.length} instancias de Mostro`,
    `${live} en curso`,
    `${scene.arcs.length - live} recién completadas`,
  ]
  if (scene.unplaced.currencies > 0) {
    parts.push(`${scene.unplaced.currencies} monedas sin ubicar en el mapa`)
  }
  if (scene.unplaced.instances > 0) {
    parts.push(`${scene.unplaced.instances} instancias sin ubicar en el mapa`)
  }
  return parts.join('; ') + '.'
}

function arcStyle(arc: SceneArc) {
  return arc.phase === 'live'
    ? { stroke: PALETTE.arcLive, opacity: 0.42, width: 1.1, dash: undefined }
    : { stroke: PALETTE.arcSettling, opacity: 0.24, width: 0.9, dash: '3 4' }
}

/** Node radius grows with the lines resting on it, from the design's scale. */
function radiusFor(lines: number, base: number, factor: number): number {
  return base + Math.sqrt(lines) * factor
}

export function WorldPulse(props: WorldPulseProps) {
  const { scene, projection, reducedMotion } = props
  const travellers = useRef<(SVGCircleElement | null)[]>([])

  const nodes = useMemo(() => {
    const instances = scene.instances.map((i) => ({
      ...i,
      key: `i:${i.pubkey}`,
      r: radiusFor(i.lines, 2.6, 1.4),
    }))
    const currencies = scene.currencies.map((c) => ({
      ...c,
      key: `c:${c.code}`,
      r: radiusFor(c.lines, 2.2, 1.5),
    }))
    const labels: Label[] = [
      ...instances.map((n) => ({ key: n.key, x: n.xy[0] + n.r + 5, y: n.xy[1] + 3, text: n.label })),
      ...currencies.map((n) => ({ key: n.key, x: n.xy[0] + n.r + 5, y: n.xy[1] + 3, text: n.code })),
    ]
    const placed = new Map(layoutLabels(labels).map((l) => [l.key, l]))
    return { instances, currencies, labelFor: (key: string) => placed.get(key) }
  }, [scene])

  // The travellers ping-pong: out along the line and back. A Mostro trade is a
  // negotiation between two parties, not a transfer in one direction, and a
  // one-way stream of particles would say the wrong thing about it.
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
    <svg
      width={props.width}
      height={props.height}
      viewBox={`0 0 ${props.width} ${props.height}`}
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

      <path
        d={projection.sphere}
        fill={PALETTE.sphere}
        stroke={PALETTE.sphereStroke}
        stroke-width="1"
      />
      <path d={projection.graticule} fill="none" stroke={PALETTE.graticule} stroke-width="0.6" />
      <g data-layer="land">
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

      <g data-layer="arcs">
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
              stroke-dasharray={style.dash}
            />
          )
        })}
      </g>

      <g data-layer="instances">
        {nodes.instances.map((instance) => {
          const r = instance.r
          const label = nodes.labelFor(instance.key)
          return (
            <g key={instance.pubkey}>
              <circle
                cx={instance.xy[0]}
                cy={instance.xy[1]}
                r={r * 4.5}
                fill="url(#wp-glow-instance)"
              />
              <rect
                x={instance.xy[0] - r}
                y={instance.xy[1] - r}
                width={r * 2}
                height={r * 2}
                fill={PALETTE.instance}
                transform={`rotate(45 ${instance.xy[0]} ${instance.xy[1]})`}
              />
              <NodeLabel node={instance.xy} r={r} label={label} text={instance.label} />
            </g>
          )
        })}
      </g>

      <g data-layer="currencies">
        {nodes.currencies.map((currency) => {
          const r = currency.r
          const label = nodes.labelFor(currency.key)
          return (
            <g key={currency.code}>
              <circle
                cx={currency.xy[0]}
                cy={currency.xy[1]}
                r={r * 5}
                fill="url(#wp-glow-currency)"
              />
              <circle
                cx={currency.xy[0]}
                cy={currency.xy[1]}
                r={r}
                fill="none"
                stroke={PALETTE.currency}
                stroke-width="1"
                stroke-opacity="0.5"
              />
              <circle
                cx={currency.xy[0]}
                cy={currency.xy[1]}
                r={r * 0.45}
                fill={PALETTE.currency}
              />
              <NodeLabel node={currency.xy} r={r} label={label} text={currency.code} />
            </g>
          )
        })}
      </g>

      {!reducedMotion && (
        <g data-layer="travellers">
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
  )
}

/**
 * A node's label, at the position the layout gave it. When the layout had to
 * push it clear of another, a hairline connects it back to its node so the
 * reader is never guessing which dot it belongs to.
 */
function NodeLabel(props: {
  node: readonly [number, number]
  r: number
  label: Label | undefined
  text: string
}) {
  const x = props.label?.x ?? props.node[0] + props.r + 5
  const y = props.label?.y ?? props.node[1] + 3
  const nudged = Math.abs(y - (props.node[1] + 3)) > 2

  return (
    <>
      {nudged && (
        <path
          d={`M${(props.node[0] + props.r).toFixed(1)},${props.node[1].toFixed(1)}L${(x - 2).toFixed(1)},${(y - 3).toFixed(1)}`}
          stroke={PALETTE.label}
          stroke-width="0.5"
          stroke-opacity="0.35"
          fill="none"
        />
      )}
      <text
        x={x}
        y={y}
        fill={PALETTE.label}
        font-size="8.5"
        letter-spacing="0.06em"
        style={{ fontFamily: "'Martian Mono', ui-monospace, monospace" }}
      >
        {props.text}
      </text>
    </>
  )
}
