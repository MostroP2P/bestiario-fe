import { formatMetric } from '~/model/format'
import { useStrings } from '~/i18n/context'
import { SkeletonRow } from './Skeleton'
import type { Metric } from '~/nostr/documents'

/**
 * The open dispute book, rebuilt from the indexed `disputes.open.<n>.*`
 * family.
 *
 * The ages are the publisher's, measured against its own clock at the moment
 * it computed the snapshot. They are shown as of that moment and not as of
 * now, which is why the panel says when.
 */
export function OpenDisputes({
  entries,
  asOf,
  loading,
}: {
  readonly entries: readonly { index: number; figures: Map<string, Metric> }[]
  readonly asOf: string | null
  readonly loading: boolean
}) {
  const strings = useStrings()
  if (loading) {
    return (
      <div style={{ padding: '0 20px' }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <SkeletonRow key={i} widths={['28px', '150px', '58px']} />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return <p class="b-empty">{strings.disputes.empty}</p>
  }

  return (
    <>
      {/* The scroll lives on the wrapper, not on the list: a region a pointer
          can scroll and a keyboard cannot is unreachable, and a `role` on the
          list itself would take its items out of it. */}
      <div
        class="b-dispute-scroll"
        tabIndex={0}
        role="group"
        aria-label={strings.disputes.listLabel}
      >
        <ul class="b-dispute-list">
          {entries.map((entry) => {
            const id = formatMetric(entry.figures.get('id'))
            const age = formatMetric(entry.figures.get('age'))
            return (
              <li key={entry.index} class="b-feed-item">
                <span class="b-feed-time">{entry.index}</span>
                <span class="b-feed-text b-mono" title={id.text}>
                  {id.text.slice(0, 8)}…
                </span>
                <span class="b-dispute-age">{age.text}</span>
              </li>
            )
          })}
        </ul>
      </div>
      {asOf && <p class="b-asof">{strings.disputes.asOf}</p>}
    </>
  )
}
