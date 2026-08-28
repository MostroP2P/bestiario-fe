import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { DEFAULT_RELAYS, PUBLISHER_PUBKEY } from '~/config'
import { WINDOWS, windowAddress, type Span } from '~/nostr/address'
import { fiatRows, indexedFamily, lookup, metricsOf } from '~/model/metrics'
import { formatMetric } from '~/model/format'
import { payloadOf, useStore } from '~/store/useStore'
import { TrustRail } from '~/components/TrustRail'
import { FiatTable } from '~/components/FiatTable'
import { OpenDisputes } from '~/components/OpenDisputes'
import { LoadingAnnouncement, Skeleton, SkeletonKpi, SkeletonMap } from '~/components/Skeleton'
import { WorldPulse } from '~/components/WorldPulse'
import { useAtlas } from '~/map/useAtlas'
import { useMeasuredSize, usePrefersReducedMotion } from '~/map/hooks'
import { placeCurrencies } from '~/map/placements'
import { createProjection } from '~/map/projection'
import { buildScene, type Scene } from '~/map/scene'
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

  const needed = useMemo(
    () =>
      (['orders', 'volume', 'disputes', 'dev-fees', 'instances'] as const).map((report) =>
        windowAddress(report, window_),
      ),
    [window_],
  )
  const { boot, documents, relays } = useStore(needed)

  const orders = metricsOf(payloadOf(documents, windowAddress('orders', window_)))
  const volume = metricsOf(payloadOf(documents, windowAddress('volume', window_)))
  const disputes = metricsOf(payloadOf(documents, windowAddress('disputes', window_)))
  const fees = metricsOf(payloadOf(documents, windowAddress('dev-fees', window_)))
  const instancesState = documents.get(windowAddress('instances', window_))

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
      currencies.map((row) => ({
        code: row.code,
        weight: Number(row.figures.get('orders')?.value ?? 0),
      })),
    [currencies],
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

  const scene = useMemo(() => {
    if (!projection || !placed || atlasState.status !== 'ready') return EMPTY_SCENE
    return buildScene({
      lines: [],
      currencies: marketWeights,
      currencyAt: (code) => placed.get(code) ?? null,
      instanceAt: () => null,
      instanceLabel: (pubkey) => pubkey,
      project: projection.project,
    })
  }, [projection, placed, atlasState, marketWeights])

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

          <section
            class="b-map"
            aria-labelledby="map-heading"
            ref={mapRef}
          >
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
                tamaño es cuántas órdenes se publicaron en ella.
              </p>
              {instancesState?.status === 'unavailable' && (
                <p class="b-map-gap">
                  Las rutas hacia cada mostro no se dibujan: bestiario todavía no publica el
                  documento <code>instances</code>, y sin él nada dice qué instancia opera
                  qué moneda.
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
                  pairs={[
                    ['canceladas', formatMetric(lookup(orders, 'orders.canceled')).text],
                    ['tasa de abandono', formatMetric(lookup(orders, 'orders.abandonment_rate')).text],
                    ['ticket medio', formatMetric(lookup(volume, 'volume.ticket_avg')).text],
                    ['mayor orden', formatMetric(lookup(volume, 'volume.largest')).text],
                  ]}
                />
                <Pairs
                  heading="DISPUTAS · DEV FEES"
                  loading={loading}
                  pairs={[
                    ['tasa de disputa', formatMetric(lookup(disputes, 'disputes.rate')).text],
                    [
                      'mediana de resolución',
                      formatMetric(lookup(disputes, 'disputes.resolution_p50')).text,
                    ],
                    ['dev fees', formatMetric(lookup(fees, 'dev_fees.total_sats')).text],
                    ['cobertura', formatMetric(lookup(fees, 'dev_fees.coverage')).text],
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

function Kpi(props: { readonly label: string; readonly value: string; readonly sub: string }) {
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
  readonly pairs: readonly (readonly [string, string])[]
}) {
  return (
    <div>
      <h2 class="b-eyebrow b-section-head">{props.heading}</h2>
      {props.pairs.map(([label, value]) => (
        <p key={label} class="b-pair" style={{ margin: 0 }}>
          <span>{label}</span>
          {props.loading ? (
            <Skeleton width="64px" height="11px" />
          ) : (
            <span>{value}</span>
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
