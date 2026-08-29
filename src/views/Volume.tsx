import { useMemo, useState } from 'preact/hooks'
import { printAddress, windowAddress, type Span } from '~/nostr/address'
import { fiatRows, lookup, metricsOf } from '~/model/metrics'
import { currencyOrders, instanceRows } from '~/model/instances'
import { compareOf, compareRows, shareOfNetwork } from '~/model/compare'
import { formatMetric } from '~/model/format'
import { SIZE_BUCKETS } from '~/i18n/strings'
import { useStrings } from '~/i18n/context'
import { payloadOf, useStore } from '~/store/useStore'
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
    return scopedAddress
      ? [...base, windowAddress('compare', props.window), scopedAddress]
      : base
  }, [props.window, scopedAddress])
  const { boot, documents } = useStore(needed)

  const volume = metricsOf(payloadOf(documents, windowAddress('volume', props.window)))
  const instances = useMemo(
    () =>
      instanceRows(
        metricsOf(payloadOf(documents, windowAddress('instances', props.window))),
      ),
    [documents, props.window],
  )

  const loading = boot.status === 'loading' || volume.length === 0

  /** The instance the reader asked for, when the publisher named one. */
  const chosen = instances.find((instance) => instance.pubkey === filters.instance)

  /**
   * Its block in the comparison document. The join goes through the label,
   * because that is the only key a `compare` block carries; the pubkey the
   * reader picked with lives in `instances:<window>`, which has both.
   */
  const compared = useMemo(() => {
    if (!chosen) return undefined
    const rows = compareRows(
      metricsOf(payloadOf(documents, windowAddress('compare', props.window))),
    )
    return compareOf(rows, chosen.label)
  }, [documents, props.window, chosen])

  const share = shareOfNetwork(compared, volume)

  /** A document has answered: with figures, with silence, or with a failure. */
  const settled = (address: string) => {
    const state = documents.get(address)
    return state !== undefined && state.status !== 'loading'
  }

  // The comparison document is asked for only once an instance is chosen, so
  // it lands a round trip after the click. Saying it names no block for the
  // instance before it has answered would be a verdict nobody has given yet.
  const comparePending =
    chosen !== undefined && !settled(windowAddress('compare', props.window))

  /** The currencies the instance itself counted, from its own document. */
  const traded = useMemo(() => {
    if (!scopedAddress) return []
    return currencyOrders(metricsOf(payloadOf(documents, scopedAddress)))
  }, [documents, scopedAddress])

  const currencies = useMemo(() => fiatRows(volume), [volume])
  const shown = filters.fiat
    ? currencies.filter((row) => row.code === filters.fiat)
    : currencies
  const shownTraded = filters.fiat
    ? traded.filter((row) => row.code === filters.fiat)
    : traded

  /** A network figure never carries an instance's name. */
  const networkOnly = (name: string) => (chosen ? undefined : lookup(volume, name))

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
          chosen && !compared && !comparePending
            ? strings.filters.noCompareRow(chosen.name || chosen.label)
            : filters.instance
              ? strings.filters.noInstanceVolume
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
              label={strings.volumeView.total}
              value={
                formatMetric(
                  chosen
                    ? compared?.figures.get('volume_sats')
                    : lookup(volume, 'volume.sats'),
                ).text
              }
              sub={strings.header.windows[props.window]}
            />
            <Kpi
              label={strings.volumeView.completed}
              value={
                formatMetric(
                  chosen
                    ? compared?.figures.get('completed')
                    : lookup(volume, 'volume.completed'),
                ).text
              }
              sub={
                chosen
                  ? formatMetric(compared?.figures.get('completion_rate')).text
                  : strings.volumeView.ticketAvg
              }
            />
            {chosen ? (
              <Kpi
                label={strings.volumeView.shareOfNetwork}
                value={formatMetric(share).text}
                sub={strings.volumeView.shareOfNetworkSub}
              />
            ) : (
              <Kpi
                label={strings.volumeView.p50}
                value={formatMetric(lookup(volume, 'volume.ticket_p50')).text}
                sub={formatMetric(lookup(volume, 'volume.ticket_p90')).text}
              />
            )}
            {chosen ? (
              <Kpi
                label={strings.volumeView.devFees}
                value={formatMetric(compared?.figures.get('dev_fees_sats')).text}
                sub={formatMetric(compared?.figures.get('fee')).text}
              />
            ) : (
              <Kpi
                label={strings.volumeView.largest}
                value={formatMetric(lookup(volume, 'volume.largest')).text}
                sub={formatMetric(lookup(volume, 'volume.ticket_avg')).text}
              />
            )}
          </>
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
                <p class="b-empty">{strings.volumeView.instanceCurrenciesEmpty}</p>
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
