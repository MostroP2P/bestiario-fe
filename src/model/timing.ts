/**
 * How long each stage of an order takes — bestiario `docs/SPEC.md` §6.4.
 *
 * The daemon signs four durations in the network's `orders:<w>` documents,
 * each as a median, a p90 and the number of trades it rests on, under the
 * names `bestiario stats timing` prints: `timing.<stage>_p50`, `_p90` and
 * `_samples`. They exist for the network only — no instance-scoped document
 * and no currency block carries them.
 *
 * The sample count is read with the percentiles, never without: a duration
 * is the gap between two versions bestiario saw, and a relay keeps only an
 * order's latest one, so the sample is the trades whose take was observed
 * live — far fewer than the trades completed. An empty sample is signed as
 * `0` with `missing` percentiles, and is carried through untouched.
 */
import { lookup } from './metrics'
import type { Metric } from '~/nostr/documents'

export type Stage = 'time_to_fill' | 'time_to_complete' | 'full_cycle' | 'time_to_cancel'

export type Duration = {
  readonly p50: Metric | undefined
  readonly p90: Metric | undefined
  readonly samples: Metric | undefined
}

/** One stage's figures, each absent when the document does not carry it. */
export function duration(metrics: readonly Metric[], stage: Stage): Duration {
  return {
    p50: lookup(metrics, `timing.${stage}_p50`),
    p90: lookup(metrics, `timing.${stage}_p90`),
    samples: lookup(metrics, `timing.${stage}_samples`),
  }
}
