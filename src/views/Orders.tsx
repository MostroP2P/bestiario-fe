import { useMemo, useState } from 'preact/hooks'
import { printAddress, windowAddress, type Span } from '~/nostr/address'
import { fiatRows, lookup, metricsOf } from '~/model/metrics'
import { instanceRows, currencyOrders } from '~/model/instances'
import { formatMetric } from '~/model/format'
import { useStrings } from '~/i18n/context'
import { payloadOf, useStore } from '~/store/useStore'
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

  const needed = useMemo(() => {
    const base = (['orders', 'volume', 'market', 'instances'] as const).map((report) =>
      windowAddress(report, props.window),
    )
    return filters.instance
      ? [
          ...base,
          printAddress({
            kind: 'window',
            report: 'orders',
            window: props.window,
            scope: { instance: filters.instance },
          }),
        ]
      : base
  }, [props.window, filters.instance])

  const { boot, documents } = useStore(needed)

  const orders = metricsOf(payloadOf(documents, windowAddress('orders', props.window)))
  const volume = metricsOf(payloadOf(documents, windowAddress('volume', props.window)))
  const market = metricsOf(payloadOf(documents, windowAddress('market', props.window)))
  const instances = useMemo(
    () =>
      instanceRows(
        metricsOf(payloadOf(documents, windowAddress('instances', props.window))),
      ),
    [documents, props.window],
  )

  const loading = boot.status === 'loading' || orders.length === 0

  /** The instance the reader asked for, when the publisher named one. */
  const chosen = instances.find((instance) => instance.pubkey === filters.instance)

  /** Its own orders document, when there is one to read. */
  const scoped = filters.instance
    ? metricsOf(
        payloadOf(
          documents,
          printAddress({
            kind: 'window',
            report: 'orders',
            window: props.window,
            scope: { instance: filters.instance },
          }),
        ),
      )
    : []
  const perInstanceCurrencies = useMemo(() => currencyOrders(scoped), [scoped])

  const currencies = useMemo(() => fiatRows(volume), [volume])
  const shown = filters.fiat
    ? currencies.filter((row) => row.code === filters.fiat)
    : currencies

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
          chosen && perInstanceCurrencies.length === 0
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
          <h2 class="b-eyebrow b-section-head">{strings.ordersView.perCurrency}</h2>
          <p class="b-note-why b-section-note">{strings.ordersView.perCurrencyNote}</p>
          <div class="b-table">
            {loading && <Skeleton width="80%" height="11px" />}
            {!loading &&
              shown.map((row) => (
                <p key={row.code} class="b-pair" style={{ margin: 0 }}>
                  <span class="b-mono">{row.code}</span>
                  <span>
                    <Figure metric={row.figures.get('orders')} />
                  </span>
                </p>
              ))}
          </div>

          {chosen && perInstanceCurrencies.length > 0 && (
            <>
              <h2 class="b-eyebrow b-section-head">{chosen.name || chosen.label}</h2>
              <div class="b-table">
                {perInstanceCurrencies.map((currency) => (
                  <p key={currency.code} class="b-pair" style={{ margin: 0 }}>
                    <span class="b-mono">{currency.code}</span>
                    <span class="b-mono">{currency.created}</span>
                  </p>
                ))}
              </div>
            </>
          )}

          {chosen && (
            <Pairs
              heading={strings.ordersView.instanceHeading}
              loading={false}
              rows={[
                [strings.ordersView.instanceFee, chosen.figures.get('fee')],
                [strings.ordersView.instanceLimits, chosen.figures.get('max_order')],
                [strings.ordersView.instanceBond, chosen.figures.get('bond')],
                [
                  strings.ordersView.instanceVersion,
                  chosen.figures.get('mostro_version'),
                ],
                [strings.ordersView.instanceFiat, chosen.figures.get('fiat')],
                [strings.ordersView.instanceSeen, chosen.figures.get('last_seen')],
              ]}
            />
          )}
        </div>

        <div>
          <Pairs
            heading={strings.ordersView.shareHeading}
            loading={loading}
            rows={[
              [strings.ordersView.buyShare, lookup(market, 'market.buy_orders_share')],
              [strings.ordersView.sellShare, lookup(market, 'market.sell_orders_share')],
            ]}
          />
          <p class="b-note-why b-section-note">{strings.ordersView.shareNote}</p>

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
