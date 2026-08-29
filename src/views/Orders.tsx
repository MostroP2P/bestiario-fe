import { useMemo, useState } from 'preact/hooks'
import { printAddress, windowAddress, type Span } from '~/nostr/address'
import { fiatRows, lookup, metricsOf } from '~/model/metrics'
import { instanceRows, currencyOrders, instanceOrders } from '~/model/instances'
import { formatMetric } from '~/model/format'
import { useStrings } from '~/i18n/context'
import { payloadOf, useStore } from '~/store/useStore'
import type { Metric } from '~/nostr/documents'
import { Figure } from '~/components/Figure'
import { Kpi } from '~/components/Kpi'
import { Pairs } from '~/components/Pairs'
import { FilterBar, NO_FILTERS, type Filters } from '~/components/FilterBar'
import { Skeleton, SkeletonKpi } from '~/components/Skeleton'

/**
 * Orders — SPEC 8.2.
 *
 * What the network created in the window and what became of it, narrowed by
 * the two dimensions that are actually published. An instance is asked for
 * by its own scoped document; until the daemon publishes one (SPEC 14.3)
 * choosing an instance says so and shows what the instance does publish
 * about itself, which is not nothing and is not invented.
 */
export function Orders(props: { readonly window: Span }) {
  const strings = useStrings()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)

  /** The instance's own orders document, once a reader has asked for one. */
  const scopedAddress = filters.instance
    ? printAddress({
        kind: 'window',
        report: 'orders',
        window: props.window,
        scope: { instance: filters.instance },
      })
    : null

  const needed = useMemo(() => {
    const base = (['orders', 'volume', 'market', 'instances'] as const).map((report) =>
      windowAddress(report, props.window),
    )
    return scopedAddress ? [...base, scopedAddress] : base
  }, [props.window, scopedAddress])

  const { boot, documents } = useStore(needed)

  const network = metricsOf(payloadOf(documents, windowAddress('orders', props.window)))
  const volume = metricsOf(payloadOf(documents, windowAddress('volume', props.window)))
  const market = metricsOf(payloadOf(documents, windowAddress('market', props.window)))
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

  /**
   * What the instance's own document is doing. `unavailable` is the index
   * not naming it at all — the archive has not published one (SPEC 14.3) —
   * and it is the only state the fallback may read a figure under. A
   * document still in the air has said nothing yet, and one that failed
   * verification has said something this page must not repeat.
   */
  const scopedState = scopedAddress ? stateOf(scopedAddress) : undefined
  const scopedPending = scopedAddress !== null && !settled(scopedAddress)
  const scopedUnverified = scopedState?.status === 'unverified'
  const scoped = scopedAddress
    ? metricsOf(payloadOf(documents, scopedAddress))
    : ([] as readonly Metric[])

  /**
   * The figures the page reads. Choosing an instance narrows every one of
   * them: what follows is that instance's or it is absent, and never the
   * network's total wearing an instance's name — not even in the window
   * before the instances document has named the instance the reader picked.
   */
  const orders = filters.fiat
    ? []
    : filters.instance
      ? chosen
        ? instanceOrders(chosen, scoped)
        : []
      : network

  /**
   * The figures are in when the documents this reading needs have answered.
   * Narrowed to one instance that is the instances document and the
   * instance's own, and never the network's totals, which this reading does
   * not use and may be empty on a quiet window.
   */
  const loading =
    boot.status === 'loading' ||
    (filters.instance
      ? !settled(windowAddress('instances', props.window)) || scopedPending
      : filters.fiat
        ? !settled(windowAddress('volume', props.window))
        : network.length === 0)

  /**
   * The market document is signed for the network as a whole — not per
   * instance, and not per currency — so it narrows to nothing.
   */
  const marketOf = (name: string) =>
    filters.instance || filters.fiat ? undefined : lookup(market, name)

  const perInstanceCurrencies = useMemo(() => currencyOrders(scoped), [scoped])

  const currencies = useMemo(() => fiatRows(volume), [volume])
  const shown = filters.fiat
    ? currencies.filter((row) => row.code === filters.fiat)
    : currencies
  const shownForInstance = filters.fiat
    ? perInstanceCurrencies.filter((row) => row.code === filters.fiat)
    : perInstanceCurrencies

  const figure = (metric: Metric | undefined) => formatMetric(metric).text

  /**
   * What one currency's row of the volume document counts: completions.
   * A currency chosen on one window and carried into another that never
   * priced it has no row here, and that is absence — never the network's
   * count wearing a currency's name.
   */
  const fiatRow = filters.fiat
    ? currencies.find((row) => row.code === filters.fiat)
    : undefined
  const completedInFiat = fiatRow?.figures.get('orders')
  const fiatUnavailable = filters.fiat !== null && !fiatRow && !loading

  /** What the instance counted in that currency, in its own document. */
  const scopedFiat = (name: string) =>
    filters.fiat ? lookup(scoped, `orders.${filters.fiat}.${name}`) : undefined

  /**
   * A currency's share of what the network completed. The publisher signs
   * both halves and not the quotient, so it is inferred and says so; a
   * missing half, or a network that completed nothing, is absence.
   */
  const shareOfCompleted = ((): Metric | undefined => {
    const mine = completedInFiat?.value
    const whole = lookup(network, 'orders.completed')?.value
    if (typeof mine !== 'number' || typeof whole !== 'number' || whole <= 0)
      return undefined
    return {
      name: 'orders.share_of_completed',
      kind: 'inferred',
      unit: 'ratio',
      value: mine / whole,
    }
  })()

  /**
   * The headline, narrowed by whatever the reader narrowed.
   *
   * Only what the publisher signs for a cut may stand under it. Per currency
   * the archive counts completions and nothing else — `volume.fiat.<CODE>.orders`
   * sums to `volume.completed` exactly — so created, canceled and in-progress
   * have no per-currency reading and are not offered one. An instance in one
   * currency is the richest cut of all, because its own document breaks its
   * orders down by currency: created, completed and open right now.
   */
  const tiles: {
    label: string
    value: string | { metric: Metric | undefined }
    sub: string
  }[] =
    filters.instance && filters.fiat
      ? [
          {
            label: strings.ordersView.created,
            value: figure(scopedFiat('created')),
            sub: filters.fiat,
          },
          {
            label: strings.ordersView.completed,
            value: figure(scopedFiat('completed')),
            sub: filters.fiat,
          },
          {
            label: strings.ordersView.openNow,
            value: figure(scopedFiat('open_now')),
            sub: filters.fiat,
          },
        ]
      : filters.fiat
        ? [
            {
              label: strings.ordersView.completed,
              value: figure(completedInFiat),
              sub: filters.fiat,
            },
            {
              // Worked out here and not read anywhere, so it is handed over
              // as the metric it is: marked inferred, and saying so to a
              // reader who reaches it by keyboard as well as by pointer.
              label: strings.ordersView.shareOfCompleted,
              value: { metric: shareOfCompleted },
              sub: strings.ordersView.shareOfCompletedSub,
            },
          ]
        : [
            {
              label: strings.ordersView.created,
              value: figure(lookup(orders, 'orders.created')),
              sub: strings.header.windows[props.window],
            },
            {
              label: strings.ordersView.completed,
              value: figure(lookup(orders, 'orders.completed')),
              sub: figure(lookup(orders, 'orders.completion_rate')),
            },
            {
              label: strings.ordersView.canceled,
              value: figure(lookup(orders, 'orders.canceled')),
              sub: figure(lookup(orders, 'orders.abandonment_rate')),
            },
            {
              label: strings.ordersView.inProgressNow,
              value: figure(lookup(orders, 'orders.in_progress_now')),
              sub: strings.ordersView.openNow,
            },
          ]

  return (
    <>
      <h1 class="b-visually-hidden">{strings.ordersView.heading}</h1>

      <div class="b-section-intro">
        <h2 class="b-eyebrow" style={{ margin: 0 }}>
          {strings.ordersView.heading}
        </h2>
        <p>{strings.ordersView.caption}</p>
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
          chosen && scopedUnverified
            ? strings.filters.unverifiedScoped(
                chosen.name || chosen.label,
                scopedState?.status === 'unverified' ? scopedState.reason : '',
              )
            : chosen && !scopedPending && scoped.length === 0
              ? strings.filters.unscoped(chosen.name || chosen.label)
              : filters.instance && filters.fiat
                ? strings.filters.instanceAndFiatOrders
                : fiatUnavailable && filters.fiat
                  ? strings.filters.fiatUnavailable(filters.fiat)
                  : filters.fiat
                    ? strings.filters.noFiatOrders
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
          <h2 class="b-eyebrow b-section-head">
            {chosen
              ? `${chosen.name || chosen.label} · ${strings.ordersView.perCurrency}`
              : strings.ordersView.perCurrency}
          </h2>
          <p class="b-note-why b-section-note">
            {!chosen || loading
              ? strings.ordersView.perCurrencyNote
              : shownForInstance.length > 0
                ? strings.ordersView.perCurrencyNote
                : scoped.length > 0
                  ? strings.ordersView.perCurrencyNoInstance
                  : strings.ordersView.perCurrencyNoDocument}
          </p>
          <div class="b-table">
            {loading && <Skeleton width="80%" height="11px" />}
            {!loading &&
              !chosen &&
              shown.map((row) => (
                <p key={row.code} class="b-pair" style={{ margin: 0 }}>
                  <span class="b-mono">{row.code}</span>
                  <span>
                    <Figure metric={row.figures.get('orders')} />
                  </span>
                </p>
              ))}
            {!loading &&
              chosen &&
              shownForInstance.map((currency) => (
                <p key={currency.code} class="b-pair" style={{ margin: 0 }}>
                  <span class="b-mono">{currency.code}</span>
                  <span class="b-mono">{currency.created}</span>
                </p>
              ))}
          </div>

          {chosen && (
            <Pairs
              heading={strings.ordersView.instanceHeading}
              loading={false}
              rows={[
                [strings.ordersView.instanceCreated, chosen.figures.get('created')],
                [strings.ordersView.instanceFee, chosen.figures.get('fee')],
                [strings.ordersView.instanceMinOrder, chosen.figures.get('min_order')],
                [strings.ordersView.instanceMaxOrder, chosen.figures.get('max_order')],
                [strings.ordersView.instanceBond, chosen.figures.get('bond')],
                [
                  strings.ordersView.instanceVersion,
                  chosen.figures.get('mostro_version'),
                ],
                [
                  strings.ordersView.instanceProtocol,
                  chosen.figures.get('protocol_version'),
                ],
                [strings.ordersView.instanceNetworks, chosen.figures.get('ln_networks')],
                [strings.ordersView.instanceFiat, chosen.figures.get('fiat')],
                [strings.ordersView.instanceFirstSeen, chosen.figures.get('first_seen')],
                [strings.ordersView.instanceSeen, chosen.figures.get('last_seen')],
                [strings.ordersView.instanceSilent, chosen.figures.get('silent_for')],
              ]}
            />
          )}
        </div>

        <div>
          <Pairs
            heading={strings.ordersView.shareHeading}
            loading={loading}
            rows={[
              [strings.ordersView.buyShare, marketOf('market.buy_orders_share')],
              [strings.ordersView.sellShare, marketOf('market.sell_orders_share')],
            ]}
          />
          <p class="b-note-why b-section-note">
            {filters.instance || filters.fiat
              ? strings.ordersView.shareNotPerInstance
              : strings.ordersView.shareNote}
          </p>

          <Pairs
            heading={strings.ordersView.openNow}
            loading={loading}
            rows={[
              [strings.ordersView.openNow, lookup(orders, 'orders.open_now')],
              [
                strings.ordersView.inProgressNow,
                lookup(orders, 'orders.in_progress_now'),
              ],
              [
                strings.ordersView.abandonmentRate,
                lookup(orders, 'orders.abandonment_rate'),
              ],
            ]}
          />
        </div>
      </div>
    </>
  )
}
