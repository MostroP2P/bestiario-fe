import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { DEFAULT_RELAYS, PUBLISHER_PUBKEY } from '~/config'
import { WINDOWS, windowAddress, type Span } from '~/nostr/address'
import { fiatRows, indexedFamily, lookup, metricsOf } from '~/model/metrics'
import type { Metric } from '~/nostr/documents'
import { formatMetric } from '~/model/format'
import { Figure } from '~/components/Figure'
import { payloadOf, useStore } from '~/store/useStore'
import { TrustRail } from '~/components/TrustRail'
import { FiatTable } from '~/components/FiatTable'
import { OpenDisputes } from '~/components/OpenDisputes'
import {
  LoadingAnnouncement,
  Skeleton,
  SkeletonKpi,
  SkeletonMap,
} from '~/components/Skeleton'
import { WorldPulse } from '~/components/WorldPulse'
import { useAtlas } from '~/map/useAtlas'
import { useMeasuredSize, usePrefersReducedMotion } from '~/map/hooks'
import { placeAnchors, placeCurrencies, placeMostros } from '~/map/placements'
import { ANCHOR_COUNT, flowLines } from '~/map/flows'
import { networkLines, tradedCurrencies } from '~/map/network'
import { currencyOrders, instanceRows } from '~/model/instances'
import { printAddress } from '~/nostr/address'
import { createProjection } from '~/map/projection'
import { buildScene, MAX_BOW_OF_HEIGHT, type Scene } from '~/map/scene'
import { sessionSeed } from '~/model/rng'

/**
 * The overview: every figure on it verified against the hash bestiario
 * signed, and nothing on it invented.
 *
 * The shell renders at once and the figures land into it, so the page is
 * never a spinner and nothing shifts when a relay answers. A figure that has
 * not arrived is a skeleton; a figure that arrived as null is an em dash with
 * a label saying which absence it is; a figure nothing published is neither.
 */

const EMPTY_SCENE: Scene = {
  arcs: [],
  currencies: [],
  instances: [],
  unplaced: { currencies: 0, instances: 0 },
}

const WINDOW_LABELS: Record<Span, string> = {
  '24h': '24 H',
  '7d': '7 D',
  '30d': '30 D',
  '90d': '90 D',
  all: 'TODO',
}

export function Dashboard() {
  const [window_, setWindow] = useState<Span>('30d')
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Two passes: the base documents, then one scoped orders document per
  // instance the first pass named. The store fetches each set in one round
  // trip and serves anything already cached.
  const [scoped, setScoped] = useState<readonly string[]>([])
  const needed = useMemo(
    () => [
      ...(['orders', 'volume', 'disputes', 'dev-fees', 'instances'] as const).map(
        (report) => windowAddress(report, window_),
      ),
      ...scoped,
    ],
    [window_, scoped],
  )
  const { boot, documents, relays } = useStore(needed)

  const orders = metricsOf(payloadOf(documents, windowAddress('orders', window_)))
  const volume = metricsOf(payloadOf(documents, windowAddress('volume', window_)))
  const disputes = metricsOf(payloadOf(documents, windowAddress('disputes', window_)))
  const fees = metricsOf(payloadOf(documents, windowAddress('dev-fees', window_)))

  const instances = useMemo(
    () =>
      instanceRows(metricsOf(payloadOf(documents, windowAddress('instances', window_)))),
    [documents, window_],
  )

  // An instance is addressed by its pubkey, which is a row of its block and
  // never its label.
  const scopedWanted = useMemo(
    () =>
      instances.map((instance) =>
        printAddress({
          kind: 'window',
          report: 'orders',
          window: window_,
          scope: { instance: instance.pubkey },
        }),
      ),
    [instances, window_],
  )
  const scopedKey = scopedWanted.join(' ')
  useEffect(() => {
    setScoped(scopedKey ? scopedKey.split(' ') : [])
  }, [scopedKey])

  /** What each instance traded, when the publisher says. */
  const trades = useMemo(
    () =>
      instances.flatMap((instance) => {
        const address = printAddress({
          kind: 'window',
          report: 'orders',
          window: window_,
          scope: { instance: instance.pubkey },
        })
        const currencies = currencyOrders(metricsOf(payloadOf(documents, address)))
        return currencies.length > 0 ? [{ pubkey: instance.pubkey, currencies }] : []
      }),
    [instances, documents, window_],
  )

  /** The cross is published: every line stands for a figure that was signed. */
  const measuredRoutes = trades.length > 0

  const loading = boot.status === 'loading' || orders.length === 0
  const currencies = useMemo(() => fiatRows(volume), [volume])
  const openBook = useMemo(() => indexedFamily(disputes, 'disputes.open'), [disputes])

  // ── the map ──────────────────────────────────────────────────────────
  const mapRef = useRef<HTMLElement>(null)
  const { width: mapWidth, height: mapHeight } = useMeasuredSize(mapRef)
  const reducedMotion = usePrefersReducedMotion()
  const atlasState = useAtlas(`${import.meta.env.BASE_URL}geo/countries-110m.json`)
  const seed = useMemo(() => sessionSeed(), [])

  const projection = useMemo(
    () => (mapWidth > 0 && mapHeight > 0 ? createProjection(mapWidth, mapHeight) : null),
    [mapWidth, mapHeight],
  )

  const marketWeights = useMemo(
    () =>
      measuredRoutes
        ? tradedCurrencies(trades)
        : currencies.map((row) => ({
            code: row.code,
            weight: Number(row.figures.get('orders')?.value ?? 0),
          })),
    [measuredRoutes, trades, currencies],
  )

  const placed = useMemo(
    () =>
      atlasState.status === 'ready'
        ? placeCurrencies(
            marketWeights.map((m) => m.code),
            atlasState.atlas,
            seed,
          )
        : null,
    [atlasState, marketWeights, seed],
  )

  const mostros = useMemo(
    () =>
      atlasState.status === 'ready' && measuredRoutes
        ? placeMostros(instances, atlasState.atlas, seed)
        : null,
    [atlasState, measuredRoutes, instances, seed],
  )

  const anchors = useMemo(
    () =>
      atlasState.status === 'ready' && !measuredRoutes
        ? placeAnchors(atlasState.atlas, seed, ANCHOR_COUNT)
        : null,
    [atlasState, measuredRoutes, seed],
  )

  // Real routes when the cross is published; the illustrative fan otherwise.
  const flows = useMemo(
    () =>
      measuredRoutes ? networkLines(trades) : flowLines(marketWeights, ANCHOR_COUNT),
    [measuredRoutes, trades, marketWeights],
  )

  const instanceName = useMemo(
    () => new Map(instances.map((i) => [i.pubkey, i.name])),
    [instances],
  )
  const approximate = useMemo(
    () => [...(mostros?.values() ?? [])].filter((p) => p.approximate).length,
    [mostros],
  )

  const scene = useMemo(() => {
    if (!projection || !placed || atlasState.status !== 'ready') return EMPTY_SCENE
    if (!mostros && !anchors) return EMPTY_SCENE
    return buildScene({
      lines: flows,
      currencies: marketWeights,
      currencyAt: (code) => placed.get(code) ?? null,
      instanceAt: (id) => mostros?.get(id)?.point ?? anchors?.get(id) ?? null,
      // A real instance is named; an anchor is not, and an empty label is
      // what keeps the map from inventing one.
      instanceLabel: (pubkey) => instanceName.get(pubkey) ?? '',
      project: projection.project,
      maxBow: mapHeight * MAX_BOW_OF_HEIGHT,
    })
  }, [
    projection,
    placed,
    mostros,
    anchors,
    atlasState,
    marketWeights,
    flows,
    instanceName,
    mapHeight,
  ])

  const mapReady = atlasState.status === 'ready' && projection !== null && !loading

  return (
    <div class="b-page">
      {loading && <LoadingAnnouncement what="las cifras de la red" />}

      {boot.status === 'failed' && (
        <p class="b-fatal" role="alert">
          <strong>Sin cifras verificadas.</strong>{' '}
          {boot.reason === 'timeout'
            ? 'Ningún relay respondió con el índice del publicador.'
            : `El índice no superó la verificación: ${boot.reason}.`}{' '}
          Esta página no muestra cifras que no pueda probar.
        </p>
      )}

      <div class="b-shell">
        <TrustRail
          boot={boot}
          relays={relays}
          publisher={PUBLISHER_PUBKEY}
          nowMs={nowMs}
        />

        <div style={{ minWidth: 0 }}>
          <div class="b-header">
            <nav class="b-tabs" aria-label="Ventana">
              {WINDOWS.map((span) => (
                <button
                  key={span}
                  type="button"
                  class="b-tab"
                  aria-current={span === window_ ? 'page' : undefined}
                  onClick={() => setWindow(span)}
                >
                  {WINDOW_LABELS[span]}
                </button>
              ))}
            </nav>
            <div class="b-header-meta">
              <span>MAINNET</span>
              <span class="b-stream">
                <i aria-hidden="true" />
                {boot.status === 'ready' ? 'VERIFICADO' : 'CONECTANDO'}
              </span>
            </div>
          </div>

          <section class="b-map" aria-labelledby="map-heading" ref={mapRef}>
            {!mapReady && <SkeletonMap />}
            {atlasState.status === 'failed' && (
              <p class="b-map-state" data-failed="true">
                SIN GEOMETRÍA · {atlasState.reason}
              </p>
            )}
            {mapReady && projection && (
              <WorldPulse
                scene={scene}
                land={atlasState.status === 'ready' ? atlasState.atlas.features : []}
                projection={projection}
                width={mapWidth}
                height={mapHeight}
                reducedMotion={reducedMotion}
              />
            )}
            <div class="b-map-caption">
              <h2 id="map-heading" class="b-eyebrow" style={{ margin: 0 }}>
                MERCADOS DE LA RED
              </h2>
              <p>
                Cada punto es una moneda con órdenes en la ventana elegida, en su país. Su
                tamaño y cuántas rutas salen de ella son su volumen de órdenes.
              </p>
              {measuredRoutes ? (
                approximate > 0 && (
                  <p class="b-map-gap">
                    {approximate} de {instances.length} instancias no nombran un país, así
                    que su punto es una dispersión y no una ubicación. Las rutas sí son
                    medidas: cada una es una moneda que esa instancia operó.
                  </p>
                )
              ) : (
                <p class="b-map-gap">
                  Las rutas son ilustrativas: van a anclajes sin nombre, no a mostros. El
                  daemon todavía no publicó <code>orders:…:i:&lt;pubkey&gt;</code>, y sin
                  él nada dice qué instancia opera qué moneda. Lo medido es la moneda, su
                  país y sus órdenes.
                </p>
              )}
            </div>
            <div class="b-map-count">
              <span class="b-eyebrow">MERCADOS ACTIVOS</span>
              {loading ? (
                <Skeleton width="52px" height="30px" />
              ) : (
                <strong>{scene.currencies.length}</strong>
              )}
              {scene.unplaced.currencies > 0 && (
                <small class="b-unplaced">
                  {scene.unplaced.currencies} sin ubicar, fuera del mapa
                </small>
              )}
            </div>
          </section>

          <div class="b-kpis">
            {loading ? (
              <>
                <SkeletonKpi />
                <SkeletonKpi />
                <SkeletonKpi />
                <SkeletonKpi />
              </>
            ) : (
              <>
                <Kpi
                  label={`ÓRDENES · ${WINDOW_LABELS[window_]}`}
                  value={formatMetric(lookup(orders, 'orders.created')).text}
                  sub={`${formatMetric(lookup(orders, 'orders.completed')).text} completadas · ${
                    formatMetric(lookup(orders, 'orders.completion_rate')).text
                  }`}
                />
                <Kpi
                  label="VOLUMEN LIQUIDADO"
                  value={formatMetric(lookup(volume, 'volume.sats')).text}
                  sub={`ticket p50 ${formatMetric(lookup(volume, 'volume.ticket_p50')).text}`}
                />
                <Kpi
                  label="DISPUTAS ABIERTAS"
                  value={formatMetric(lookup(disputes, 'disputes.open_now')).text}
                  sub={`${formatMetric(lookup(disputes, 'disputes.opened')).text} abiertas · ${
                    formatMetric(lookup(disputes, 'disputes.resolved')).text
                  } resueltas`}
                />
                <Kpi
                  label="EN CURSO AHORA"
                  value={formatMetric(lookup(orders, 'orders.in_progress_now')).text}
                  sub={`${formatMetric(lookup(orders, 'orders.open_now')).text} abiertas`}
                />
              </>
            )}
          </div>

          <div class="b-lower">
            <div class="b-lower-main">
              <h2 class="b-eyebrow b-section-head">VOLUMEN POR MONEDA</h2>
              <FiatTable rows={currencies} loading={loading} />

              <div class="b-split">
                <Pairs
                  heading="ÓRDENES"
                  loading={loading}
                  rows={[
                    ['canceladas', lookup(orders, 'orders.canceled')],
                    ['tasa de abandono', lookup(orders, 'orders.abandonment_rate')],
                    ['ticket medio', lookup(volume, 'volume.ticket_avg')],
                    ['mayor orden', lookup(volume, 'volume.largest')],
                  ]}
                />
                <Pairs
                  heading="DISPUTAS · DEV FEES"
                  loading={loading}
                  rows={[
                    ['tasa de disputa', lookup(disputes, 'disputes.rate')],
                    [
                      'mediana de resolución',
                      lookup(disputes, 'disputes.resolution_p50'),
                    ],
                    ['dev fees', lookup(fees, 'dev_fees.total_sats')],
                    ['cobertura', lookup(fees, 'dev_fees.coverage')],
                    // Inferred, and marked as such: it rests on an assumed fee
                    // share the daemon was configured with, not on a measurement.
                    ['volumen implícito', lookup(fees, 'dev_fees.implied_volume')],
                    // Inferred and, on the current archive, missing: no completed
                    // order had a rate snapshot close enough to price it. It
                    // renders as absence, which is the honest answer.
                    ['volumen en USD', lookup(volume, 'volume.in.USD.total')],
                  ]}
                />
              </div>

              <div class="b-notes">
                <h2 class="b-eyebrow" style={{ margin: 0 }}>
                  FUERA DE ALCANCE DE LA MEDICIÓN
                </h2>
                <div class="b-notes-grid">
                  <Note
                    title="Usuarios únicos"
                    why="las claves son efímeras por orden; contar pubkeys cuenta órdenes, no personas."
                  />
                  <Note
                    title="Origen de una disputa"
                    why="el evento de disputa no referencia la orden que la provocó."
                  />
                  <Note
                    title="Motivo de cancelación"
                    why="los eventos registran el cambio de estado, nunca la causa."
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 class="b-eyebrow b-feed-head">
                <span>DISPUTAS ABIERTAS</span>
                <span class="b-feed-live">{loading ? '' : openBook.length}</span>
              </h2>
              <OpenDisputes
                entries={openBook}
                asOf={boot.status === 'ready' ? boot.index.generated_at : null}
                loading={loading}
              />
            </div>
          </div>
        </div>
      </div>

      <p class="b-footnote">
        Leído de {DEFAULT_RELAYS.length} relays y verificado en este navegador contra la
        clave del publicador. Un valor ausente se dibuja ausente y nunca como cero; una
        cifra inferida se marca como tal.
      </p>
    </div>
  )
}

function Kpi(props: {
  readonly label: string
  readonly value: string
  readonly sub: string
}) {
  return (
    <div class="b-kpi">
      <span class="b-eyebrow">{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.sub}</small>
    </div>
  )
}

function Pairs(props: {
  readonly heading: string
  readonly loading: boolean
  readonly rows: readonly (readonly [string, Metric | undefined])[]
}) {
  return (
    <div>
      <h2 class="b-eyebrow b-section-head">{props.heading}</h2>
      {props.rows.map(([label, metric]) => (
        <p key={label} class="b-pair" style={{ margin: 0 }}>
          <span>{label}</span>
          {props.loading ? (
            <Skeleton width="64px" height="11px" />
          ) : (
            <span>
              <Figure metric={metric} />
            </span>
          )}
        </p>
      ))}
    </div>
  )
}

function Note(props: { readonly title: string; readonly why: string }) {
  return (
    <div>
      <div class="b-note-title">{props.title}</div>
      <div class="b-note-why">{props.why}</div>
    </div>
  )
}
