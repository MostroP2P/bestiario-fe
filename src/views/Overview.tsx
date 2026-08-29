/**
 * The overview — SPEC 8.1.
 *
 * The one screen a reader who wants a number, not a study, can stop at: the
 * map of where the network trades, the four figures of the chosen window,
 * and the panels that qualify them. Every figure on it is verified against
 * the hash bestiario signed, and nothing on it is invented.
 *
 * The shell renders at once and the figures land into it, so the page is
 * never a spinner and nothing shifts when a relay answers. A figure that has
 * not arrived is a skeleton; a figure that arrived as null is an em dash with
 * a label saying which absence it is; a figure nothing published is neither.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { windowAddress, type Span } from '~/nostr/address'
import { fiatRows, lookup, metricsOf } from '~/model/metrics'
import { formatMetric, formatSum } from '~/model/format'
import { useStrings } from '~/i18n/context'
import { payloadOf, useStore } from '~/store/useStore'
import { CurrencyMatrix } from '~/components/CurrencyMatrix'
import { FiatTable } from '~/components/FiatTable'
import { OpenDisputes } from '~/components/OpenDisputes'
import { Kpi } from '~/components/Kpi'
import { Pairs } from '~/components/Pairs'
import { Skeleton, SkeletonKpi, SkeletonMap } from '~/components/Skeleton'
import { WorldPulse } from '~/components/WorldPulse'
import { useAtlas } from '~/map/useAtlas'
import { useMeasuredSize, usePrefersReducedMotion } from '~/map/hooks'
import { placeAnchors, placeCurrencies, placeMostros } from '~/map/placements'
import { ANCHOR_COUNT, flowLines } from '~/map/flows'
import { networkLines, tradedCurrencies } from '~/map/network'
import { currencyOrders, instanceRows } from '~/model/instances'
import { openDisputes } from '~/model/open-disputes'
import { DISPUTES } from '~/config'
import { currencyMatrix } from '~/model/matrix'
import { printAddress } from '~/nostr/address'
import { createProjection } from '~/map/projection'
import { buildScene, MAX_BOW_OF_HEIGHT, type Scene } from '~/map/scene'
import { sessionSeed } from '~/model/rng'

const EMPTY_SCENE: Scene = {
  arcs: [],
  currencies: [],
  instances: [],
  unplaced: { currencies: 0, instances: 0 },
}

export function Overview(props: { readonly window: Span }) {
  const strings = useStrings()
  const window_ = props.window

  // Two passes: the base documents, then one scoped orders document per
  // instance the first pass named. The store fetches each set in one round
  // trip and serves anything already cached.
  const [scoped, setScoped] = useState<readonly string[]>([])
  // The instances whose dispute events the open book is read from. Named by a
  // document, so the set arrives on the second pass with the scoped orders.
  const [disputeAuthors, setDisputeAuthors] = useState<readonly string[]>([])
  const needed = useMemo(
    () => [
      ...(['orders', 'volume', 'disputes', 'dev-fees', 'instances'] as const).map(
        (report) => windowAddress(report, window_),
      ),
      ...scoped,
    ],
    [window_, scoped],
  )
  const {
    boot,
    documents,
    disputes: disputeEvents,
    disputesReady,
  } = useStore(needed, disputeAuthors)

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

  // Only the instances the archive names may put a row on the dispute book:
  // an event signed by anyone else is somebody else's claim about Mostro.
  const instanceKey = useMemo(
    () => instances.map((instance) => instance.pubkey).join(' '),
    [instances],
  )
  useEffect(() => {
    setDisputeAuthors(instanceKey ? instanceKey.split(' ') : [])
  }, [instanceKey])

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

  /** The same cross the map is drawn from, read as a grid. */
  const matrix = useMemo(() => currencyMatrix(instances, trades), [instances, trades])

  const loading = boot.status === 'loading' || orders.length === 0

  /** A document has answered: with figures, with silence, or with a failure. */
  const settled = (address: string) => {
    const state = documents.get(address)
    return state !== undefined && state.status !== 'loading'
  }

  // The cross is the second pass, and `loading` only tracks the first. Until
  // every scoped document has answered, a grid drawn now is missing rows
  // nobody said were empty, and an empty grid is a verdict the archive has
  // not given yet. So the block stays a skeleton until they settle.
  const matrixLoading =
    loading ||
    !settled(windowAddress('instances', window_)) ||
    scopedWanted.some((address) => !settled(address))
  const currencies = useMemo(() => fiatRows(volume), [volume])
  // ── the open dispute book ────────────────────────────────────────────
  // Not a published figure: the instances' own 38386 events, filtered to the
  // statuses that mean open and to what has been said in the last two days.
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const openBook = useMemo(
    () => openDisputes(disputeEvents, nowMs, DISPUTES),
    [disputeEvents, nowMs],
  )

  /** An empty book is only news once the instances are named and have answered. */
  const bookLoading =
    boot.status === 'loading' ||
    !settled(windowAddress('instances', window_)) ||
    !disputesReady

  const bookWindowDays = Math.round(DISPUTES.windowMs / 86_400_000)

  // ── the map ──────────────────────────────────────────────────────────
  const mapRef = useRef<HTMLDivElement>(null)
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
    <>
      <section class="b-map" aria-labelledby="map-heading">
        {/* Only the two short corner marks are laid over the drawing — what
              the map is, and what it counts. The explanation is a caption
              under the globe: at the width where the projection fills its
              box there is no empty ocean left to write in, and a paragraph
              placed anywhere over it lands on the countries it describes. */}
        <h2 id="map-heading" class="b-eyebrow b-map-label">
          {strings.map.heading}
        </h2>

        {/* The drawing is measured, not the section, so the projection is
              fitted to the globe's own box at every width. */}
        <div class="b-map-canvas" ref={mapRef}>
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
        </div>
        {/* Every market the archive published, not only the ones the map
            could place: a currency whose country does not resolve is still
            an active market, and the headline may not quietly drop it. */}
        <div class="b-map-count">
          <span class="b-eyebrow">{strings.map.activeMarkets}</span>
          {loading ? (
            <Skeleton width="52px" height="30px" />
          ) : (
            <strong>{marketWeights.length}</strong>
          )}
        </div>

        <div class="b-map-caption">
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
              value={formatMetric(lookup(orders, 'orders.completed')).text}
              // The rate's own denominator, and not the created total: an
              // order still open has not failed to complete, it has not
              // finished. `completion_rate` counts only the ones that ended.
              sub={strings.kpi.ordersSub(
                formatMetric(lookup(orders, 'orders.completion_rate')).text,
                formatSum([
                  lookup(orders, 'orders.completed'),
                  lookup(orders, 'orders.canceled'),
                ]).text,
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
          {/* The cross of artboard 2a, and the first block of the panel: it
              is the only place the site says which instance trades which
              currency, and it is the figure behind the map above it. */}
          <h2 class="b-eyebrow b-section-head">{strings.matrix.heading}</h2>
          <CurrencyMatrix matrix={matrix} loading={matrixLoading} />

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
                [strings.pairs.impliedVolume, lookup(fees, 'dev_fees.implied_volume')],
                // Inferred and, on the current archive, missing: no completed
                // order had a rate snapshot close enough to price it. It
                // renders as absence, which is the honest answer.
                [strings.pairs.referenceVolume, lookup(volume, 'volume.in.USD.total')],
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
            <span class="b-feed-live">{bookLoading ? '' : openBook.length}</span>
          </h2>
          <OpenDisputes
            entries={openBook}
            nowMs={nowMs}
            windowDays={bookWindowDays}
            loading={bookLoading}
          />
        </div>
      </div>
    </>
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
