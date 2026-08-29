import { useMemo, useState } from 'preact/hooks'
import { windowAddress, type Span } from '~/nostr/address'
import { fiatRows, lookup, metricsOf } from '~/model/metrics'
import { instanceRows } from '~/model/instances'
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
 * The instance filter is offered and answered honestly: volume is published
 * for the network and not per instance, so choosing one says that rather
 * than quietly showing network figures under an instance's name.
 */
export function Volume(props: { readonly window: Span }) {
  const strings = useStrings()
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)

  const needed = useMemo(
    () => [
      windowAddress('volume', props.window),
      windowAddress('instances', props.window),
    ],
    [props.window],
  )
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
  const currencies = useMemo(() => fiatRows(volume), [volume])
  const shown = filters.fiat
    ? currencies.filter((row) => row.code === filters.fiat)
    : currencies

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
        note={filters.instance ? strings.filters.noInstanceVolume : undefined}
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
              value={formatMetric(lookup(volume, 'volume.sats')).text}
              sub={strings.header.windows[props.window]}
            />
            <Kpi
              label={strings.volumeView.completed}
              value={formatMetric(lookup(volume, 'volume.completed')).text}
              sub={strings.volumeView.ticketAvg}
            />
            <Kpi
              label={strings.volumeView.p50}
              value={formatMetric(lookup(volume, 'volume.ticket_p50')).text}
              sub={formatMetric(lookup(volume, 'volume.ticket_p90')).text}
            />
            <Kpi
              label={strings.volumeView.largest}
              value={formatMetric(lookup(volume, 'volume.largest')).text}
              sub={formatMetric(lookup(volume, 'volume.ticket_avg')).text}
            />
          </>
        )}
      </div>

      <div class="b-lower">
        <div class="b-lower-main">
          <h2 class="b-eyebrow b-section-head">{strings.fiat.heading}</h2>
          <FiatTable rows={shown} loading={loading} />
        </div>

        <div>
          <Pairs
            heading={strings.volumeView.splitHeading}
            loading={loading}
            rows={[
              [strings.volumeView.buy, lookup(volume, 'volume.buy_sats')],
              [strings.volumeView.sell, lookup(volume, 'volume.sell_sats')],
            ]}
          />

          <Pairs
            heading={strings.volumeView.sizesHeading}
            loading={loading}
            rows={SIZE_BUCKETS.map(
              (bucket) =>
                [
                  strings.volumeView.sizes[bucket],
                  lookup(volume, `volume.size.${bucket}`),
                ] as const,
            )}
          />

          <Pairs
            heading={strings.volumeView.referenceHeading}
            loading={loading}
            rows={[
              [strings.volumeView.total, lookup(volume, 'volume.in.USD.total')],
              [strings.volumeView.ticketAvg, lookup(volume, 'volume.in.USD.ticket_avg')],
            ]}
          />
          <p class="b-note-why b-section-note">{strings.volumeView.referenceNote}</p>
        </div>
      </div>
    </>
  )
}
