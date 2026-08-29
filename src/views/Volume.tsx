import { useMemo, useState } from 'preact/hooks'
import { printAddress, windowAddress, type Span } from '~/nostr/address'
import { fiatRows, lookup, metricsOf } from '~/model/metrics'
import { currencyOrders, instanceRows } from '~/model/instances'
import { compareOf, compareRows, shareOfNetwork } from '~/model/compare'
import { formatMetric } from '~/model/format'
import { SIZE_BUCKETS } from '~/i18n/strings'
import { useStrings } from '~/i18n/context'
import { payloadOf, useStore } from '~/store/useStore'
import type { Metric } from '~/nostr/documents'
import { Kpi } from '~/components/Kpi'
import { Pairs } from '~/components/Pairs'
import { FiatTable } from '~/components/FiatTable'
import { FilterBar, NO_FILTERS, type Filters } from '~/components/FilterBar'
import { SkeletonKpi } from '~/components/Skeleton'

/**
 * Volume — SPEC 8.3.
 *
 * The largest published family and the one that needs the most editing: the
 * headline, the sizes, the buy/sell split, and the per-currency table whose
 * rows come from the one metric-name grammar this site parses.
 *
 * The instance filter is offered and answered from the two documents that do
 * carry a publisher's own trade: `compare:<window>`, where the total in sats
 * is one row per instance, and the instance's own `orders:<window>:i:<pubkey>`,
 * which counts the currencies it traded. Everything else here — the amounts
 * per currency, the ticket sizes, the buy/sell split, the reference
 * conversion — is signed for the whole network only, so choosing an instance
 * leaves it absent and says why, rather than showing a network figure under
 * one publisher's name.
 */
export function Volume(props: { readonly window: Span }) {
  const strings = useStrings()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)

  const scopedAddress = filters.instance
    ? printAddress({
        kind: 'window',
        report: 'orders',
        window: props.window,
        scope: { instance: filters.instance },
      })
    : null

  const needed = useMemo(() => {
    const base = [
      windowAddress('volume', props.window),
      windowAddress('instances', props.window),
    ]
    // The comparison document is what carries volume per instance, and it is
    // asked for only when a reader narrows to one.
    if (!scopedAddress) return base
    const narrowed = [...base, windowAddress('compare', props.window), scopedAddress]
    // Narrowed to one instance *and* one currency, the reading is counts,
    // and what makes a count mean something is the network's own for the
    // same currency — which is in the orders document.
    return filters.fiat ? [...narrowed, windowAddress('orders', props.window)] : narrowed
  }, [props.window, scopedAddress, filters.fiat])
  const { boot, documents } = useStore(needed)

  const volume = metricsOf(payloadOf(documents, windowAddress('volume', props.window)))
  const instances = useMemo(
    () =>
      instanceRows(
        metricsOf(payloadOf(documents, windowAddress('instances', props.window))),
      ),
    [documents, props.window],
  )

  /** The instance the reader asked for, when the publisher named one. */
  const chosen = instances.find((instance) => instance.pubkey === filters.instance)

  /** A document has answered: with figures, with silence, or with a failure. */
  const stateOf = (address: string) => documents.get(address)
  const settled = (address: string) => {
    const state = stateOf(address)
    return state !== undefined && state.status !== 'loading'
  }

  const compareAddress = windowAddress('compare', props.window)

  /**
   * The figures are in when the documents *this* reading needs have
   * answered, and no others. An instance is read from the comparison
   * document and from its own; an instance in one currency is read from its
   * own alone, so a slow comparison round must not hide a count that is
   * already in. The network's totals are waited on only when they are what
   * is being read.
   */
  const loading =
    boot.status === 'loading' ||
    (filters.instance
      ? !settled(windowAddress('instances', props.window)) ||
        (scopedAddress !== null && !settled(scopedAddress)) ||
        (filters.fiat
          ? !settled(windowAddress('orders', props.window))
          : !settled(compareAddress))
      : volume.length === 0)

  /**
   * Its block in the comparison document. The join goes through the label,
   * because that is the only key a `compare` block carries; the pubkey the
   * reader picked with lives in `instances:<window>`, which has both.
   */
  const compared = useMemo(() => {
    if (!chosen) return undefined
    const rows = compareRows(metricsOf(payloadOf(documents, compareAddress)))
    return compareOf(rows, chosen.label)
  }, [documents, compareAddress, chosen])

  const share = shareOfNetwork(compared, volume)

  /**
   * A document that failed verification has said something this page must
   * not repeat, and it is not the same answer as a document that names no
   * block. Both are said, and neither is read.
   */
  const compareState = stateOf(compareAddress)
  const compareUnverified = compareState?.status === 'unverified'
  const scopedState = scopedAddress ? stateOf(scopedAddress) : undefined
  const scopedUnverified = scopedState?.status === 'unverified'

  /**
   * The whole network's orders document, which is the denominator of the
   * market share. A failure here is the share's failure: it must not pass
   * for a quotient nobody published.
   */
  const ordersAddress = windowAddress('orders', props.window)
  const ordersState = stateOf(ordersAddress)

  /** The instance's own orders document, once it has answered. */
  const scoped = scopedAddress
    ? metricsOf(payloadOf(documents, scopedAddress))
    : ([] as readonly Metric[])

  /** The currencies the instance itself counted, from that document. */
  const traded = useMemo(() => currencyOrders(scoped), [scoped])

  /** What the instance counted in the chosen currency, figure by figure. */
  const scopedFiat = (name: string) =>
    filters.fiat ? lookup(scoped, `orders.${filters.fiat}.${name}`) : undefined

  /**
   * How much of that currency's market this instance is: its completed
   * orders over the network's, in the same currency and the same window,
   * counted the same way in two documents. The publisher signs both halves
   * and not the quotient, so it is inferred and says so.
   */
  const shareOfMarket = ((): Metric | undefined => {
    const mine = scopedFiat('completed')?.value
    const whole = lookup(
      metricsOf(payloadOf(documents, ordersAddress)),
      `orders.${filters.fiat}.completed`,
    )?.value
    if (typeof mine !== 'number' || typeof whole !== 'number' || whole <= 0)
      return undefined
    return {
      name: 'orders.share_of_market',
      kind: 'inferred',
      unit: 'ratio',
      value: mine / whole,
    }
  })()

  const currencies = useMemo(() => fiatRows(volume), [volume])
  const shown = filters.fiat
    ? currencies.filter((row) => row.code === filters.fiat)
    : currencies
  const shownTraded = filters.fiat
    ? traded.filter((row) => row.code === filters.fiat)
    : traded

  /** A figure the whole network's, and never a narrowed reading's. */
  const networkOnly = (name: string) =>
    chosen || filters.fiat ? undefined : lookup(volume, name)

  /**
   * The currency's own block, when the reader asked for one and this
   * window has it. A currency chosen on one window and carried into
   * another the publisher never priced in it is a selection with nothing
   * behind it: the reading stays the currency's and every figure in it is
   * absent, because the network's totals are not that currency's.
   */
  const fiat = filters.fiat
    ? currencies.find((row) => row.code === filters.fiat)
    : undefined
  const fiatUnavailable = filters.fiat !== null && !fiat && !loading

  const figure = (metric: Metric | undefined) => formatMetric(metric).text

  /**
   * The headline, narrowed by whatever the reader narrowed.
   *
   * Each filter cuts the tiles to what the publisher signs for that cut and
   * to nothing else. One currency is signed in that currency — a total, a
   * count and the three tickets — and no longer in sats. One instance is
   * signed in sats, in the comparison document. Both at once is signed only
   * as a count, in the instance's own orders document, so that is the only
   * tile that carries a figure and the rest say so.
   */
  const tiles: {
    label: string
    value: string | { metric: Metric | undefined }
    sub: string | { metric: Metric | undefined }
  }[] =
    chosen && filters.fiat
      ? [
          // No amount is signed for this cut, in sats or in the currency.
          // What is signed is the instance's own count of that currency,
          // and what the count is worth beside the network's.
          {
            label: strings.volumeView.completed,
            value: { metric: scopedFiat('completed') },
            sub: filters.fiat,
          },
          {
            label: strings.volumeView.shareOfMarket,
            value: { metric: shareOfMarket },
            sub: strings.volumeView.shareOfMarketSub(filters.fiat),
          },
          {
            label: strings.volumeView.created,
            value: { metric: scopedFiat('created') },
            sub: filters.fiat,
          },
          {
            label: strings.volumeView.completionRate,
            value: { metric: scopedFiat('completion_rate') },
            sub: filters.fiat,
          },
        ]
      : chosen
        ? [
            {
              label: strings.volumeView.total,
              value: figure(compared?.figures.get('volume_sats')),
              sub: strings.header.windows[props.window],
            },
            {
              label: strings.volumeView.completed,
              value: figure(compared?.figures.get('completed')),
              sub: figure(compared?.figures.get('completion_rate')),
            },
            {
              // Worked out here and not read anywhere: handed over as the
              // metric it is, so the tile carries the inferred marker.
              label: strings.volumeView.shareOfNetwork,
              value: { metric: share },
              sub: strings.volumeView.shareOfNetworkSub,
            },
            {
              label: strings.volumeView.devFees,
              value: figure(compared?.figures.get('dev_fees_sats')),
              sub: figure(compared?.figures.get('fee')),
            },
          ]
        : filters.fiat
          ? [
              {
                // The amount is in its own currency and compares with
                // nothing; the sats beside it are what the same trade is in
                // the one unit every currency here shares.
                label: strings.volumeView.total,
                value: figure(fiat?.figures.get('total')),
                sub: { metric: fiat?.figures.get('sats') },
              },
              {
                label: strings.volumeView.completed,
                value: figure(fiat?.figures.get('orders')),
                sub: filters.fiat,
              },
              {
                label: strings.volumeView.p50,
                value: figure(fiat?.figures.get('ticket_p50')),
                sub: figure(fiat?.figures.get('ticket_p90')),
              },
              {
                label: strings.volumeView.ticketAvg,
                value: figure(fiat?.figures.get('ticket_avg')),
                sub: filters.fiat,
              },
            ]
          : [
              {
                label: strings.volumeView.total,
                value: figure(lookup(volume, 'volume.sats')),
                sub: strings.header.windows[props.window],
              },
              {
                label: strings.volumeView.completed,
                value: figure(lookup(volume, 'volume.completed')),
                sub: figure(lookup(volume, 'volume.ticket_avg')),
              },
              {
                label: strings.volumeView.p50,
                value: figure(lookup(volume, 'volume.ticket_p50')),
                sub: figure(lookup(volume, 'volume.ticket_p90')),
              },
              {
                label: strings.volumeView.largest,
                value: figure(lookup(volume, 'volume.largest')),
                sub: strings.header.windows[props.window],
              },
            ]

  return (
    <>
      <h1 class="b-visually-hidden">{strings.volumeView.heading}</h1>

      <div class="b-section-intro">
        <h2 class="b-eyebrow" style={{ margin: 0 }}>
          {strings.volumeView.heading}
        </h2>
        <p>{strings.volumeView.caption}</p>
      </div>

      <FilterBar
        currencies={currencies.map((row) => row.code)}
        instances={instances.map((instance) => ({
          pubkey: instance.pubkey,
          name: instance.name || instance.label,
        }))}
        value={filters}
        onChange={setFilters}
        note={
          filters.instance
            ? filters.fiat
              ? ordersState?.status === 'unverified'
                ? strings.filters.unverifiedOrders(ordersState.reason)
                : strings.filters.instanceAndFiat
              : compareUnverified && compareState?.status === 'unverified'
                ? strings.filters.unverifiedCompare(compareState.reason)
                : chosen && !compared && !loading
                  ? strings.filters.noCompareRow(chosen.name || chosen.label)
                  : strings.filters.noInstanceVolume
            : fiatUnavailable && filters.fiat
              ? strings.filters.fiatUnavailable(filters.fiat)
              : filters.fiat
                ? strings.filters.noFiatBreakdown
                : undefined
        }
      />

      <div class="b-kpis">
        {loading ? (
          <>
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
            <SkeletonKpi />
          </>
        ) : (
          tiles.map((tile) => (
            <Kpi key={tile.label} label={tile.label} value={tile.value} sub={tile.sub} />
          ))
        )}
      </div>

      <div class="b-lower">
        <div class="b-lower-main">
          {chosen ? (
            <>
              <h2 class="b-eyebrow b-section-head">
                {strings.volumeView.instanceCurrencies}
              </h2>
              <p class="b-note-why b-section-note">
                {strings.volumeView.instanceCurrenciesNote}
              </p>
              {shownTraded.length === 0 ? (
                <p class="b-empty">
                  {scopedUnverified && scopedState?.status === 'unverified'
                    ? strings.filters.unverifiedScoped(
                        chosen.name || chosen.label,
                        scopedState.reason,
                      )
                    : strings.volumeView.instanceCurrenciesEmpty}
                </p>
              ) : (
                <div class="b-table">
                  {shownTraded.map((currency) => (
                    <p key={currency.code} class="b-pair" style={{ margin: 0 }}>
                      <span class="b-mono">{currency.code}</span>
                      <span class="b-mono">{currency.completed}</span>
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h2 class="b-eyebrow b-section-head">{strings.fiat.heading}</h2>
              <FiatTable rows={shown} loading={loading} />
            </>
          )}
        </div>

        <div>
          <Pairs
            heading={strings.volumeView.splitHeading}
            loading={loading}
            rows={[
              [strings.volumeView.buy, networkOnly('volume.buy_sats')],
              [strings.volumeView.sell, networkOnly('volume.sell_sats')],
            ]}
          />

          <Pairs
            heading={strings.volumeView.sizesHeading}
            loading={loading}
            rows={SIZE_BUCKETS.map(
              (bucket) =>
                [
                  strings.volumeView.sizes[bucket],
                  networkOnly(`volume.size.${bucket}`),
                ] as const,
            )}
          />

          <Pairs
            heading={strings.volumeView.referenceHeading}
            loading={loading}
            rows={[
              [strings.volumeView.total, networkOnly('volume.in.USD.total')],
              [strings.volumeView.ticketAvg, networkOnly('volume.in.USD.ticket_avg')],
            ]}
          />
          <p class="b-note-why b-section-note">{strings.volumeView.referenceNote}</p>
        </div>
      </div>
    </>
  )
}
