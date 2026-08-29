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
  const orders = filters.instance
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
      : network.length === 0)

  /** The market document is signed for the network, and narrows to nothing. */
  const marketOf = (name: string) => (filters.instance ? undefined : lookup(market, name))

  const perInstanceCurrencies = useMemo(() => currencyOrders(scoped), [scoped])

  const currencies = useMemo(() => fiatRows(volume), [volume])
  const shown = filters.fiat
    ? currencies.filter((row) => row.code === filters.fiat)
    : currencies
  const shownForInstance = filters.fiat
    ? perInstanceCurrencies.filter((row) => row.code === filters.fiat)
    : perInstanceCurrencies

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
          <>
            <Kpi
              label={strings.ordersView.created}
              value={formatMetric(lookup(orders, 'orders.created')).text}
              sub={strings.header.windows[props.window]}
            />
            <Kpi
              label={strings.ordersView.completed}
              value={formatMetric(lookup(orders, 'orders.completed')).text}
              sub={formatMetric(lookup(orders, 'orders.completion_rate')).text}
            />
            <Kpi
              label={strings.ordersView.canceled}
              value={formatMetric(lookup(orders, 'orders.canceled')).text}
              sub={formatMetric(lookup(orders, 'orders.abandonment_rate')).text}
            />
            <Kpi
              label={strings.ordersView.inProgressNow}
              value={formatMetric(lookup(orders, 'orders.in_progress_now')).text}
              sub={strings.ordersView.openNow}
            />
          </>
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
            {chosen
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
