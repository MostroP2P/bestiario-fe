import { useEffect, useMemo, useRef } from 'preact/hooks'
import type { Feature, Geometry } from 'geojson'
import { PALETTE } from '~/map/palette'
import { toPathData } from '~/map/geometry'
import type { MapProjection } from '~/map/projection'
import { selectLabels, type Label, type Marker } from '~/map/labels'
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

/**
 * A horizontal step wider than this fraction of the map is the antimeridian
 * seam and not a segment.
 *
 * A route is sampled into dozens of points, so even one crossing the whole
 * map advances a few tens of pixels per step; a wrap jumps most of the width
 * at once. A fifth sits far above the first and far below the second, and
 * half — the first guess — let a 790-pixel streak through.
 */
const SEAM_FRACTION = 0.2

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

/**
 * A node's radius, from its share of the busiest node rather than from its
 * raw count.
 *
 * An absolute scale is unusable on this data: the busiest market carries
 * hundreds of orders and the quietest one, and a square root of the count
 * alone gives the leader a glow that swallows a continent. Scaling against
 * the peak keeps the map readable whatever the network's volume, and the
 * figures themselves are in the table below, where a reader can compare them
 * without measuring a circle.
 */
const MIN_RADIUS = 2.4
const MAX_RADIUS = 11

function radiusFor(weight: number, peak: number): number {
  if (peak <= 0) return MIN_RADIUS
  const share = Math.sqrt(Math.max(0, weight) / peak)
  return MIN_RADIUS + share * (MAX_RADIUS - MIN_RADIUS)
}

export function WorldPulse(props: WorldPulseProps) {
  const { scene, projection, reducedMotion } = props
  const travellers = useRef<(SVGCircleElement | null)[]>([])

  const nodes = useMemo(() => {
    const instancePeak = Math.max(1, ...scene.instances.map((i) => i.lines))
    const currencyPeak = Math.max(1, ...scene.currencies.map((c) => c.weight))
    const instances = scene.instances.map((i) => ({
      ...i,
      key: `i:${i.pubkey}`,
      r: radiusFor(i.lines, instancePeak),
    }))
    const currencies = scene.currencies.map((c) => ({
      ...c,
      key: `c:${c.code}`,
      r: radiusFor(c.weight, currencyPeak),
    }))

    // Busiest first: when two labels cannot both fit, the one carrying more
    // flow keeps it and the other is left to the legend.
    const labels: Label[] = [
      // An anchor has no name, so it has no label to place. Only a real
      // instance would, and none is published.
      ...instances
        .filter((n) => n.label.length > 0)
        .map((n) => ({
          key: n.key,
          lines: n.lines,
          x: n.xy[0] + n.r + 5,
          y: n.xy[1] + 3,
          text: n.label,
        })),
      ...currencies.map((n) => ({
        key: n.key,
        lines: n.lines,
        x: n.xy[0] + n.r + 5,
        y: n.xy[1] + 3,
        text: n.code,
      })),
    ]
      .sort((a, b) => b.lines - a.lines || a.key.localeCompare(b.key))
      .map(({ key, x, y, text }) => ({ key, x, y, text }))

    // Every marker on the map, so a label is never drawn over a node that is
    // not its own. The glow around a node is decoration and is not an
    // obstacle; the mark itself is.
    const markers: Marker[] = [
      // An instance's mark is a square turned on its corner, so it reaches
      // further than its radius by the diagonal.
      ...instances.map((n) => ({
        key: n.key,
        x: n.xy[0],
        y: n.xy[1],
        r: n.r * Math.SQRT2,
      })),
      ...currencies.map((n) => ({ key: n.key, x: n.xy[0], y: n.xy[1], r: n.r })),
    ]

    return { instances, currencies, shown: selectLabels(labels, markers) }
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
        {/* Routes are clipped to the globe: an arc that leaves the sphere
            stops reading as a route over it. */}
        <clipPath id="wp-sphere">
          <path d={projection.sphere} />
        </clipPath>
        <radialGradient id="wp-glow-currency">
          <stop offset="0%" stop-color={PALETTE.currency} stop-opacity="0.42" />
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
      <path
        d={projection.graticule}
        fill="none"
        stroke={PALETTE.graticule}
        stroke-width="0.6"
      />
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

      <g data-layer="arcs" clip-path="url(#wp-sphere)">
        {scene.arcs.map((arc) => {
          const style = arcStyle(arc)
          return (
            <path
              key={arc.orderId}
              d={toPathData(arc.points, props.width * SEAM_FRACTION)}
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
          const named = instance.label.length > 0
          return (
            <g key={instance.pubkey} data-instance={instance.pubkey}>
              {named ? (
                <>
                  <circle
                    cx={instance.xy[0]}
                    cy={instance.xy[1]}
                    r={r * 3.2}
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
                </>
              ) : (
                // An anchor: a hollow mark, deliberately faint and unlabelled,
                // so nothing suggests a mostro is here. Nothing published says
                // where one is.
                <circle
                  cx={instance.xy[0]}
                  cy={instance.xy[1]}
                  r={Math.max(2.5, r * 0.7)}
                  fill="none"
                  stroke={PALETTE.instance}
                  stroke-width="1"
                  stroke-opacity="0.34"
                  stroke-dasharray="2 2"
                />
              )}
              {named && nodes.shown.has(instance.key) && (
                <NodeLabel node={instance.xy} r={r} text={instance.label} />
              )}
            </g>
          )
        })}
      </g>

      <g data-layer="currencies">
        {nodes.currencies.map((currency) => {
          const r = currency.r
          return (
            <g key={currency.code} data-code={currency.code}>
              <circle
                cx={currency.xy[0]}
                cy={currency.xy[1]}
                r={r * 3.4}
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
              {nodes.shown.has(currency.key) && (
                <NodeLabel node={currency.xy} r={r} text={currency.code} />
              )}
            </g>
          )
        })}
      </g>

      {!reducedMotion && (
        <g data-layer="travellers" clip-path="url(#wp-sphere)">
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
 * A node's label, beside the node it names.
 *
 * Drawn with a dark halo behind it. Selection keeps labels off each other and
 * off the markers, but a node's glow reaches much further than its mark, and
 * pale text over a bright glow is unreadable however well it is placed. The
 * halo is the cartographer's answer and costs one stroke.
 */
function NodeLabel(props: { node: readonly [number, number]; r: number; text: string }) {
  return (
    <text
      x={props.node[0] + props.r + 5}
      y={props.node[1] + 3}
      fill={PALETTE.label}
      stroke={PALETTE.background}
      stroke-width="2.4"
      stroke-linejoin="round"
      font-size="8.5"
      letter-spacing="0.06em"
      style={{
        fontFamily: "'Martian Mono', ui-monospace, monospace",
        paintOrder: 'stroke fill',
      }}
    >
      {props.text}
    </text>
  )
}
