import { formatDuration } from '~/model/format'
import { useStrings } from '~/i18n/context'
import { SkeletonRow } from './Skeleton'
import type { LiveDispute } from '~/model/open-disputes'

/**
 * The open dispute book, rebuilt from the instances' own dispute events.
 *
 * Every row is a dispute a Mostro last called `initiated` or `in-progress`,
 * and the age is measured from that event's signed `created_at` against the
 * reader's own clock — not from a snapshot the publisher computed at some
 * earlier moment. The panel says so, and says how far back it reaches: a
 * dispute nobody has spoken about in two days is not on it.
 */
export function OpenDisputes({
  entries,
  nowMs,
  windowDays,
  loading,
}: {
  readonly entries: readonly LiveDispute[]
  readonly nowMs: number
  readonly windowDays: number
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
    return (
      <>
        <p class="b-empty">{strings.disputes.empty(windowDays)}</p>
        <p class="b-asof">{strings.disputes.live(windowDays)}</p>
      </>
    )
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
          {entries.map((entry, position) => (
            <li
              key={`${entry.instancePubkey}:${entry.id}`}
              class="b-feed-item"
              title={strings.disputes.rowTitle(
                entry.id,
                entry.instancePubkey.slice(0, 8),
              )}
            >
              <span class="b-feed-time">{position + 1}</span>
              <span class="b-feed-text b-mono">{entry.id.slice(0, 8)}…</span>
              <span class="b-dispute-status">
                {strings.disputes.status[entry.status] ?? entry.status}
              </span>
              <span class="b-dispute-age">
                {formatDuration(Math.max(0, (nowMs - entry.updatedAt) / 1000))}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <p class="b-asof">{strings.disputes.live(windowDays)}</p>
    </>
  )
}
