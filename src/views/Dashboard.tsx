import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { DEFAULT_RELAYS, PUBLISHER_PUBKEY } from '~/config'
import { WINDOWS, windowAddress, type Span } from '~/nostr/address'
import { fiatRows, indexedFamily, lookup, metricsOf } from '~/model/metrics'
import type { Metric } from '~/nostr/documents'
import { formatMetric, useNumberLocale } from '~/model/format'
import { useStrings } from '~/i18n/context'
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

export function Dashboard() {
  const strings = useStrings()
  useNumberLocale(strings.locale)
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
      {loading && (
        <LoadingAnnouncement
          what={strings.loading.announcement(strings.loading.figures)}
        />
      )}

      {boot.status === 'failed' && (
        <p class="b-fatal" role="alert">
          <strong>{strings.fatal.heading}</strong>{' '}
          {boot.reason === 'timeout'
            ? strings.fatal.timeout
            : strings.fatal.unverified(boot.reason)}{' '}
          {strings.fatal.note}
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
            <nav class="b-tabs" aria-label={strings.header.windowNav}>
              {WINDOWS.map((span) => (
                <button
                  key={span}
                  type="button"
                  class="b-tab"
                  aria-current={span === window_ ? 'page' : undefined}
                  onClick={() => setWindow(span)}
                >
                  {strings.header.windows[span]}
                </button>
              ))}
            </nav>
            <div class="b-header-meta">
              <span>{strings.header.network}</span>
              <span class="b-stream">
                <i aria-hidden="true" />
                {boot.status === 'ready'
                  ? strings.header.verified
                  : strings.header.connecting}
              </span>
            </div>
          </div>

          <section class="b-map" aria-labelledby="map-heading" ref={mapRef}>
            {!mapReady && <SkeletonMap />}
            {atlasState.status === 'failed' && (
              <p class="b-map-state" data-failed="true">
                {strings.map.noGeometry(atlasState.reason)}
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
                strings={strings}
              />
            )}
            <div class="b-map-caption">
              <h2 id="map-heading" class="b-eyebrow" style={{ margin: 0 }}>
                {strings.map.heading}
              </h2>
              <p>{strings.map.caption}</p>
              {measuredRoutes ? (
                approximate > 0 && (
                  <p class="b-map-gap">
                    {strings.map.approximateInstances(approximate, instances.length)}
                  </p>
                )
              ) : (
                <p class="b-map-gap">{strings.map.illustrativeRoutes}</p>
              )}
            </div>
            <div class="b-map-count">
              <span class="b-eyebrow">{strings.map.activeMarkets}</span>
              {loading ? (
                <Skeleton width="52px" height="30px" />
              ) : (
                <strong>{scene.currencies.length}</strong>
              )}
              {scene.unplaced.currencies > 0 && (
                <small class="b-unplaced">
                  {strings.map.unplaced(scene.unplaced.currencies)}
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
                  label={strings.kpi.orders(strings.header.windows[window_])}
                  value={formatMetric(lookup(orders, 'orders.created')).text}
                  sub={strings.kpi.ordersSub(
                    formatMetric(lookup(orders, 'orders.completed')).text,
                    formatMetric(lookup(orders, 'orders.completion_rate')).text,
                  )}
                />
                <Kpi
                  label={strings.kpi.volume(strings.header.windows[window_])}
                  value={formatMetric(lookup(volume, 'volume.sats')).text}
                  sub={strings.kpi.volumeSub(
                    formatMetric(lookup(volume, 'volume.ticket_p50')).text,
                  )}
                />
                {/* Every figure in this row is of the chosen window. The
                    open book is about *now* and is a different question, so
                    it lives in its own panel and is labelled there. Putting
                    it here made one heading answer two. */}
                <Kpi
                  label={strings.kpi.disputes(strings.header.windows[window_])}
                  value={formatMetric(lookup(disputes, 'disputes.opened')).text}
                  sub={strings.kpi.disputesSub(
                    formatMetric(lookup(disputes, 'disputes.resolved')).text,
                    formatMetric(lookup(disputes, 'disputes.rate')).text,
                  )}
                />
                {/* Both of these are about now, and the label says so.
                    `open_now` is pending orders still live, not "open
                    disputes" and not orders opened in the window. */}
                <Kpi
                  label={strings.kpi.rightNow}
                  value={formatMetric(lookup(orders, 'orders.in_progress_now')).text}
                  sub={strings.kpi.rightNowSub(
                    formatMetric(lookup(orders, 'orders.open_now')).text,
                  )}
                />
              </>
            )}
          </div>

          <div class="b-lower">
            <div class="b-lower-main">
              <h2 class="b-eyebrow b-section-head">{strings.fiat.heading}</h2>
              <FiatTable rows={currencies} loading={loading} />

              <div class="b-split">
                <Pairs
                  heading={strings.pairs.ordersHeading}
                  loading={loading}
                  rows={[
                    [strings.pairs.canceled, lookup(orders, 'orders.canceled')],
                    [
                      strings.pairs.abandonmentRate,
                      lookup(orders, 'orders.abandonment_rate'),
                    ],
                    [strings.pairs.ticketAvg, lookup(volume, 'volume.ticket_avg')],
                    [strings.pairs.largest, lookup(volume, 'volume.largest')],
                  ]}
                />
                <Pairs
                  heading={strings.pairs.disputesHeading}
                  loading={loading}
                  rows={[
                    [strings.pairs.disputeRate, lookup(disputes, 'disputes.rate')],
                    [
                      strings.pairs.resolutionMedian,
                      lookup(disputes, 'disputes.resolution_p50'),
                    ],
                    [strings.pairs.devFees, lookup(fees, 'dev_fees.total_sats')],
                    [strings.pairs.coverage, lookup(fees, 'dev_fees.coverage')],
                    // Inferred, and marked as such: it rests on an assumed fee
                    // share the daemon was configured with, not on a measurement.
                    [
                      strings.pairs.impliedVolume,
                      lookup(fees, 'dev_fees.implied_volume'),
                    ],
                    // Inferred and, on the current archive, missing: no completed
                    // order had a rate snapshot close enough to price it. It
                    // renders as absence, which is the honest answer.
                    [
                      strings.pairs.referenceVolume,
                      lookup(volume, 'volume.in.USD.total'),
                    ],
                  ]}
                />
              </div>

              <div class="b-notes">
                <h2 class="b-eyebrow" style={{ margin: 0 }}>
                  {strings.notMeasurable.heading}
                </h2>
                <div class="b-notes-grid">
                  {strings.notMeasurable.items.map((note) => (
                    <Note key={note.title} title={note.title} why={note.why} />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <h2 class="b-eyebrow b-feed-head">
                <span>{strings.disputes.heading}</span>
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

      <p class="b-footnote">{strings.footnote(DEFAULT_RELAYS.length)}</p>
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
