import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { MAP } from '~/config'
import { InstanceRail } from '~/components/InstanceRail'
import { WorldPulse } from '~/components/WorldPulse'
import { useAtlas } from '~/map/useAtlas'
import { useMeasuredWidth, usePrefersReducedMotion } from '~/map/hooks'
import { createProjection } from '~/map/projection'
import { buildScene, type Scene } from '~/map/scene'
import { placeCurrencies, placeInstances } from '~/map/placements'
import { activeLines, type LiveOrder } from '~/model/live-lines'
import { buildGrid, heatLevel } from '~/model/matrix'
import { sessionSeed } from '~/model/rng'
import {
  NOT_MEASURABLE,
  SAMPLE_CURRENCIES,
  SAMPLE_FEED,
  SAMPLE_FEES_DISPUTES,
  SAMPLE_INSTANCES,
  SAMPLE_KPIS,
  SAMPLE_RELAYS,
  SAMPLE_TIMINGS,
  sampleOrders,
} from '~/data/sample'

/**
 * Artboard 2a: the operational panel.
 *
 * The map, the grid and the counts all read from one set of active lines, so
 * they cannot disagree with one another. Everything else on this screen is
 * still the design's sample data and is labelled as such until the store of
 * SPEC 7 lands.
 */

const HEAT = ['#0b1c25', '#123244', '#1a4a63', '#236b8c', '#2bd9ff']
const HEAT_INK = ['#2c4552', '#bcd6e3', '#bcd6e3', '#bcd6e3', '#061019']

/** How often a settled line is re-checked against its grace period. */
const TICK_MS = 5_000

/** The map's height in artboard 2a. */
const MAP_HEIGHT = 408

const EMPTY_SCENE: Scene = {
  arcs: [],
  currencies: [],
  instances: [],
  unplaced: { currencies: 0, instances: 0 },
}

const TABS = [
  { id: 'resumen', label: 'RESUMEN', href: '#/' },
  { id: 'ordenes', label: 'ÓRDENES', href: '#/orders' },
  { id: 'volumen', label: 'VOLUMEN', href: '#/volume' },
  { id: 'disputas', label: 'DISPUTAS', href: '#/disputes' },
  { id: 'mercado', label: 'MERCADO', href: '#/market' },
]

export type DashboardProps = {
  /** Live orders. Empty until the relay layer lands; the sample fills in dev. */
  readonly orders?: readonly LiveOrder[]
  readonly sample?: boolean
}

export function Dashboard(props: DashboardProps) {
  const atlasState = useAtlas(`${import.meta.env.BASE_URL}geo/countries-110m.json`)
  const mapRef = useRef<HTMLElement>(null)
  const mapWidth = useMeasuredWidth(mapRef)
  const reducedMotion = usePrefersReducedMotion()
  const seed = useMemo(() => sessionSeed(), [])
  const [selected, setSelected] = useState<string | null>(SAMPLE_INSTANCES[0]?.pubkey ?? null)

  // A settled line leaves the map when its grace period runs out, and nothing
  // else changes at that moment — so the clock has to tick on its own.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  const orders = useMemo<readonly LiveOrder[]>(
    () => props.orders ?? (props.sample ? sampleOrders(now) : []),
    [props.orders, props.sample, now],
  )

  const lines = useMemo(() => activeLines(orders, now, MAP), [orders, now])

  const placements = useMemo(() => {
    if (atlasState.status !== 'ready') return null
    return {
      instances: placeInstances(SAMPLE_INSTANCES, atlasState.atlas, seed),
      currencies: placeCurrencies(
        SAMPLE_CURRENCIES.map((c) => c.code),
        atlasState.atlas,
        seed,
      ),
      land: atlasState.atlas.features,
    }
  }, [atlasState, seed])

  const instanceName = useMemo(
    () => new Map(SAMPLE_INSTANCES.map((i) => [i.pubkey, i.name])),
    [],
  )

  const projection = useMemo(
    () => (mapWidth > 0 ? createProjection(mapWidth, MAP_HEIGHT) : null),
    [mapWidth],
  )

  const currencyAt = useCallback(
    (code: string) => placements?.currencies.get(code) ?? null,
    [placements],
  )
  const instanceAt = useCallback(
    (pubkey: string) => placements?.instances.get(pubkey) ?? null,
    [placements],
  )
  const instanceLabel = useCallback(
    (pubkey: string) => instanceName.get(pubkey) ?? pubkey,
    [instanceName],
  )

  // One scene, read by the map and by the counts beside it, so the headline
  // can never claim a market the map is not drawing.
  const scene = useMemo(
    () =>
      projection && placements
        ? buildScene({
            lines,
            currencyAt,
            instanceAt,
            instanceLabel,
            project: projection.project,
          })
        : EMPTY_SCENE,
    [projection, placements, lines, currencyAt, instanceAt, instanceLabel],
  )

  const grid = useMemo(
    () =>
      buildGrid(
        lines,
        SAMPLE_INSTANCES.map((i) => i.pubkey),
        SAMPLE_CURRENCIES.map((c) => c.code),
      ),
    [lines],
  )

  const unplaced = scene.unplaced.currencies + scene.unplaced.instances

  const byLines = <T extends { lines: number }>(a: T, b: T) => b.lines - a.lines
  const legendCurrencies = useMemo(
    () => [...scene.currencies].sort((a, b) => byLines(a, b) || a.code.localeCompare(b.code)),
    [scene],
  )
  const legendInstances = useMemo(
    () => [...scene.instances].sort((a, b) => byLines(a, b) || a.label.localeCompare(b.label)),
    [scene],
  )

  return (
    <div class="b-page">
      {props.sample && (
        <p class="b-sample" role="status">
          DATOS DE EJEMPLO · el mapa es real y se calcula desde las órdenes; las cifras
          alrededor son las del diseño y no vienen de ningún relay
        </p>
      )}

      <div class="b-shell">
        <InstanceRail
          instances={SAMPLE_INSTANCES}
          relays={SAMPLE_RELAYS}
          selected={selected}
          onSelect={setSelected}
          events="1 482 093"
          backfillPct={96}
          backfillFrom="2024-01-01"
        />

        <div style={{ minWidth: 0 }}>
          <div class="b-header">
            <nav class="b-tabs" aria-label="Secciones">
              {TABS.map((tab) => (
                <a
                  key={tab.id}
                  class="b-tab"
                  href={tab.href}
                  aria-current={tab.id === 'resumen' ? 'page' : undefined}
                >
                  {tab.label}
                </a>
              ))}
            </nav>
            <div class="b-header-meta">
              <span>30 D</span>
              <span style={{ color: 'var(--ink)' }}>MAINNET</span>
              <span class="b-stream">
                <i aria-hidden="true" />
                STREAM
              </span>
            </div>
          </div>

          <section
            class="b-map"
            aria-labelledby="map-heading"
            ref={mapRef}
            style={{ height: `${MAP_HEIGHT}px`, background: 'var(--panel)' }}
          >
            {atlasState.status === 'loading' && (
              <p class="b-map-state">CARGANDO GEOMETRÍA…</p>
            )}
            {atlasState.status === 'failed' && (
              <p class="b-map-state" data-failed="true">
                SIN GEOMETRÍA · {atlasState.reason}
              </p>
            )}
            {placements && projection && (
              <WorldPulse
                scene={scene}
                land={placements.land}
                projection={projection}
                width={mapWidth}
                height={MAP_HEIGHT}
                reducedMotion={reducedMotion}
              />
            )}
            <div class="b-map-caption">
              <h2 id="map-heading" class="b-eyebrow" style={{ margin: 0 }}>
                FLUJO DE ÓRDENES · EN VIVO
              </h2>
              <p>
                Una línea por orden activa, desde el país de su moneda hacia el mostro que
                la opera. Se apaga {MAP.graceMs / 60000} minutos después de completarse.
              </p>
            </div>
            <div class="b-map-count">
              <span class="b-eyebrow">MERCADOS ACTIVOS</span>
              <strong>{scene.currencies.length}</strong>
              <small>en {scene.instances.length} mostros</small>
              {unplaced > 0 && (
                <small class="b-unplaced">{unplaced} sin ubicar, fuera del mapa</small>
              )}

              {/* The map keeps the design's whole globe, so a label that will
                  not fit is dropped from it rather than drawn on top of
                  another. Everything the map draws is listed here, whether or
                  not it kept its label. */}
              {scene.arcs.length > 0 && (
                <dl class="b-legend">
                  {legendCurrencies.map((c) => (
                    <div key={c.code} class="b-legend-row">
                      <dt>
                        <i class="b-legend-mark" data-kind="currency" />
                        {c.code}
                      </dt>
                      <dd>{c.lines}</dd>
                    </div>
                  ))}
                  {legendCurrencies.length > 0 && legendInstances.length > 0 && (
                    <div class="b-legend-rule" />
                  )}
                  {legendInstances.map((i) => (
                    <div key={i.pubkey} class="b-legend-row">
                      <dt>
                        <i class="b-legend-mark" data-kind="instance" />
                        {i.label}
                      </dt>
                      <dd>{i.lines}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </section>

          <div class="b-kpis">
            {SAMPLE_KPIS.map((kpi) => (
              <div key={kpi.label} class="b-kpi">
                <span class="b-eyebrow">{kpi.label}</span>
                <strong>{kpi.value}</strong>
                <small>{kpi.sub}</small>
              </div>
            ))}
          </div>

          <div class="b-lower">
            <div class="b-lower-main">
              <h2 class="b-eyebrow b-section-head">MONEDA X INSTANCIA · ÓRDENES ACTIVAS</h2>
              <div class="b-matrix">
                <div class="b-matrix-row">
                  <span />
                  {grid.columns.map((code) => (
                    <span key={code} class="b-matrix-col">
                      {code}
                    </span>
                  ))}
                </div>
                {grid.rows.map((pubkey, r) => (
                  <div key={pubkey} class="b-matrix-row">
                    <span class="b-matrix-name">{instanceName.get(pubkey) ?? pubkey}</span>
                    {grid.columns.map((code, c) => {
                      const count = grid.counts[r]?.[c] ?? 0
                      const level = heatLevel(count, grid.peak)
                      return (
                        <span
                          key={code}
                          class="b-cell"
                          style={{ background: HEAT[level], color: HEAT_INK[level] }}
                          title={`${instanceName.get(pubkey) ?? pubkey} · ${code}: ${count}`}
                        >
                          {count === 0 ? '·' : count}
                        </span>
                      )
                    })}
                  </div>
                ))}
              </div>

              <div class="b-split">
                <div>
                  <h2 class="b-eyebrow b-section-head">TIEMPOS</h2>
                  {SAMPLE_TIMINGS.map((t) => (
                    <p key={t.label} class="b-pair" style={{ margin: 0 }}>
                      <span>{t.label}</span>
                      <span>{t.value}</span>
                    </p>
                  ))}
                </div>
                <div>
                  <h2 class="b-eyebrow b-section-head">DISPUTAS · DEV FEES</h2>
                  {SAMPLE_FEES_DISPUTES.map((f) => (
                    <p key={f.label} class="b-pair" style={{ margin: 0 }}>
                      <span>{f.label}</span>
                      <span>
                        {f.value}
                        {f.inferred && (
                          <span class="b-inferred" title="Figura inferida, no medida">
                            {' '}
                            (inf)
                          </span>
                        )}
                      </span>
                    </p>
                  ))}
                </div>
              </div>

              <div class="b-notes">
                <h2 class="b-eyebrow" style={{ margin: 0 }}>
                  FUERA DE ALCANCE DE LA MEDICIÓN
                </h2>
                <div class="b-notes-grid">
                  {NOT_MEASURABLE.map((note) => (
                    <div key={note.title}>
                      <div class="b-note-title">{note.title}</div>
                      <div class="b-note-why">{note.why}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h2 class="b-eyebrow b-feed-head">
                <span>FLUJO DE EVENTOS</span>
                <span class="b-feed-live">LIVE</span>
              </h2>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {SAMPLE_FEED.map((e) => (
                  <li key={e.t + e.text} class="b-feed-item">
                    <span class="b-feed-time">{e.t}</span>
                    <span class="b-feed-kind" data-tone={e.tone}>
                      {e.kind}
                    </span>
                    <span class="b-feed-text">{e.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
