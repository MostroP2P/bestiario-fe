import type { Span } from '~/nostr/address'
import type { Strings } from '~/i18n/strings'
import type { Metric } from '~/nostr/documents'
import { lookup } from '~/model/metrics'
import type { Duration } from '~/model/timing'

type Part = string | { readonly metric: Metric | undefined }

export type Tile = {
  readonly label: string
  readonly value: Part
  readonly sub: Part | readonly Part[]
}

/** What the headline is built from: the reading, and the figures it reads. */
export type TileInput = {
  readonly strings: Strings
  readonly window: Span
  readonly instance: string | null
  readonly fiat: string | null
  /** The network's figures, or the chosen instance's when one is chosen. */
  readonly orders: readonly Metric[]
  /** One figure of the chosen instance's block for the chosen currency. */
  readonly scopedFiat: (name: string) => Metric | undefined
  /** One figure of the network's block for the chosen currency. */
  readonly networkFiat: (name: string) => Metric | undefined
  readonly completedInFiat: Metric | undefined
  readonly shareOfCompleted: Metric | undefined
  /** The network's time to complete. */
  readonly completion: Duration
}

/**
 * The headline, narrowed by whatever the reader narrowed.
 *
 * Only what the publisher signs for a cut may stand under it. Per currency
 * the archive counts completions and nothing else — `volume.fiat.<CODE>.orders`
 * sums to `volume.completed` exactly — so created, canceled and in-progress
 * have no per-currency reading and are not offered one. An instance in one
 * currency is the richest cut of all, because its own document breaks its
 * orders down by currency: created, completed and open right now.
 *
 * The network reading closes on how long a trade takes once taken (SPEC
 * 8.2): the median, qualified by its p90 and by how many trades it rests on.
 * bestiario signs those for the network only, so no narrowed reading shows
 * them — never the network's figure under an instance's or a currency's name.
 */
export function ordersTiles(input: TileInput): readonly Tile[] {
  const {
    strings,
    orders,
    scopedFiat,
    networkFiat,
    completedInFiat,
    shareOfCompleted,
    completion,
  } = input
  return input.instance && input.fiat
    ? [
        {
          label: strings.ordersView.created,
          value: { metric: scopedFiat('created') },
          sub: input.fiat,
        },
        {
          label: strings.ordersView.completed,
          value: { metric: scopedFiat('completed') },
          sub: input.fiat,
        },
        {
          label: strings.ordersView.openNow,
          value: { metric: scopedFiat('open_now') },
          sub: input.fiat,
        },
      ]
    : input.fiat
      ? [
          {
            label: strings.ordersView.created,
            value: { metric: networkFiat('created') },
            sub: input.fiat,
          },
          {
            label: strings.ordersView.completed,
            value: { metric: completedInFiat },
            sub: input.fiat,
          },
          {
            label: strings.ordersView.canceled,
            value: { metric: networkFiat('canceled') },
            sub: input.fiat,
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
            value: { metric: lookup(orders, 'orders.created') },
            sub: strings.header.windows[input.window],
          },
          {
            label: strings.ordersView.completed,
            value: { metric: lookup(orders, 'orders.completed') },
            sub: { metric: lookup(orders, 'orders.completion_rate') },
          },
          {
            label: strings.ordersView.canceled,
            value: { metric: lookup(orders, 'orders.canceled') },
            sub: { metric: lookup(orders, 'orders.abandonment_rate') },
          },
          input.instance
            ? {
                label: strings.ordersView.inProgressNow,
                value: { metric: lookup(orders, 'orders.in_progress_now') },
                sub: strings.ordersView.openNow,
              }
            : {
                // How long a trade takes once taken, beside the completion
                // rate. The network's only: an instance reading keeps its
                // in-progress count, which its own document does sign.
                label: strings.ordersView.timeToComplete,
                value: { metric: completion.p50 },
                sub: [
                  strings.ordersView.timeToCompleteNineInTen,
                  { metric: completion.p90 },
                  '·',
                  { metric: completion.samples },
                  strings.ordersView.timeToCompleteTimed,
                ],
              },
        ]
}
