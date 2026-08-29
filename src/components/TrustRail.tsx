import mostroIcon from '~/assets/mostro-icon.svg'
import { Skeleton } from './Skeleton'
import { formatAge, formatCount } from '~/model/format'
import { useStrings } from '~/i18n/context'
import type { BootState } from '~/store/store'
import type { RelayState } from '~/nostr/pool'

/**
 * The left rail: who published these figures, which relays answered, and how
 * old the data is.
 *
 * It renders as two siblings rather than one box. On a phone the reader must
 * meet the numbers and the controls before the provenance behind them, and
 * that is a reading order, not a paint order: reordering with CSS alone would
 * leave a screen reader walking publisher, relays, archive and snapshot
 * before the first figure. So the brand and the body are written in the order
 * they are read — brand, figures, provenance — and the desktop grid puts the
 * body back in the left column.
 *
 * The age is computed from the event's signed `created_at` and never from
 * `generated_at`, which is the publisher's claim about itself (SPEC 2).
 */

export type TrustRailProps = {
  readonly boot: BootState
  readonly relays: readonly RelayState[]
  readonly publisher: string
  readonly nowMs: number
}

function shortKey(hex: string): string {
  return `${hex.slice(0, 8)}…${hex.slice(-8)}`
}

function relayState(state: RelayState): string {
  switch (state.status) {
    case 'live':
      return 'ok'
    case 'connecting':
      return 'wait'
    case 'silent':
      return 'silent'
    case 'failed':
      return 'down'
  }
}

/** The brand block: the top of the rail on a desktop, the top of the page on
 * a phone. Written before the figures because it is read first in both. */
export function TrustBrand() {
  const strings = useStrings()

  return (
    <div class="b-brand">
      <img src={mostroIcon} alt="" width={30} />
      <div style={{ minWidth: 0 }}>
        <div class="b-brand-name">
          mostro<span>.world</span>
        </div>
        <div class="b-eyebrow" style={{ marginTop: '5px' }}>
          {strings.brand.tagline}
        </div>
      </div>
    </div>
  )
}

export function TrustRail(props: TrustRailProps) {
  const strings = useStrings()
  const ready = props.boot.status === 'ready' ? props.boot : null

  return (
    <div class="b-rail b-rail-body">
      <h2 class="b-eyebrow b-rail-heading">{strings.rail.publisher}</h2>
      <div class="b-rail-block">
        <p class="b-mono b-rail-key" title={props.publisher}>
          {shortKey(props.publisher)}
        </p>
        <p class="b-rail-note">{strings.rail.publisherNote}</p>
      </div>

      <h2 class="b-eyebrow b-rail-heading">{strings.rail.relays}</h2>
      <ul class="b-relays">
        {props.relays.length === 0 && <Skeleton width="80%" height="9px" />}
        {props.relays.map((relay) => (
          <li key={relay.url} class="b-relay">
            <span class="b-relay-dot" data-state={relayState(relay)} />
            <span class="b-relay-url">{relay.url.replace(/^wss:\/\//, '')}</span>
            <span class="b-relay-ms">
              {relay.newestAt === null ? '—' : formatAge(relay.newestAt, props.nowMs)}
            </span>
          </li>
        ))}
      </ul>

      <h2 class="b-eyebrow b-rail-heading">{strings.rail.archive}</h2>
      <div class="b-rail-block">
        {!ready && (
          <>
            <Skeleton width="90%" height="10px" />
            <Skeleton width="70%" height="10px" />
          </>
        )}
        {ready && (
          <>
            <div class="b-backfill-row">
              <span>{strings.rail.from}</span>
              <span class="b-mono">
                {ready.index.coverage.first_event_at.slice(0, 10)}
              </span>
            </div>
            <div class="b-backfill-row">
              <span>{strings.rail.until}</span>
              <span class="b-mono">
                {ready.index.coverage.last_event_at.slice(0, 10)}
              </span>
            </div>
            <div class="b-backfill-row">
              <span>{strings.rail.documents}</span>
              <span class="b-mono">{formatCount(ready.index.documents.length)}</span>
            </div>
            <p class="b-rail-note">{strings.rail.archiveNote}</p>
          </>
        )}
      </div>

      <h2 class="b-eyebrow b-rail-heading">{strings.rail.snapshot}</h2>
      <div class="b-rail-block">
        {!ready && <Skeleton width="85%" height="10px" />}
        {ready && (
          <>
            <p class="b-mono b-rail-key">{ready.index.snapshot_id}</p>
            <div class="b-backfill-row">
              <span>{strings.rail.age}</span>
              <span class="b-mono">{formatAge(ready.createdAt, props.nowMs)}</span>
            </div>
            <div class="b-backfill-row">
              <span>{strings.rail.version}</span>
              <span class="b-mono">{ready.index.publisher.version}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
