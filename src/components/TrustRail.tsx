import mostroIcon from '~/assets/mostro-icon.svg'
import { Skeleton } from './Skeleton'
import { formatAge } from '~/model/format'
import type { BootState } from '~/store/store'
import type { RelayState } from '~/nostr/pool'

/**
 * The left rail: who published these figures, which relays answered, and how
 * old the data is.
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

export function TrustRail(props: TrustRailProps) {
  const ready = props.boot.status === 'ready' ? props.boot : null

  return (
    <div class="b-rail">
      <div class="b-brand">
        <img src={mostroIcon} alt="" width={30} />
        <div style={{ minWidth: 0 }}>
          <div class="b-brand-name">
            mostro<span>.world</span>
          </div>
          <div class="b-eyebrow" style={{ marginTop: '5px' }}>
            OBSERVATORIO DE LA RED
          </div>
        </div>
      </div>

      <h2 class="b-eyebrow b-rail-heading">PUBLICADOR</h2>
      <div class="b-rail-block">
        <p class="b-mono b-rail-key" title={props.publisher}>
          {shortKey(props.publisher)}
        </p>
        <p class="b-rail-note">
          Cada cifra de esta página viene de un evento firmado por esta clave y verificado
          en tu navegador. Una firma prueba que bestiario las publicó, no que sean
          correctas.
        </p>
      </div>

      <h2 class="b-eyebrow b-rail-heading">RELAYS</h2>
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

      <h2 class="b-eyebrow b-rail-heading">ARCHIVO</h2>
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
              <span>desde</span>
              <span class="b-mono">
                {ready.index.coverage.first_event_at.slice(0, 10)}
              </span>
            </div>
            <div class="b-backfill-row">
              <span>hasta</span>
              <span class="b-mono">
                {ready.index.coverage.last_event_at.slice(0, 10)}
              </span>
            </div>
            <div class="b-backfill-row">
              <span>documentos</span>
              <span class="b-mono">{ready.index.documents.length}</span>
            </div>
            <p class="b-rail-note">
              El archivo solo puede hablar de este periodo. Fuera de él no hay ceros, hay
              ausencia.
            </p>
          </>
        )}
      </div>

      <h2 class="b-eyebrow b-rail-heading">INSTANTÁNEA</h2>
      <div class="b-rail-block">
        {!ready && <Skeleton width="85%" height="10px" />}
        {ready && (
          <>
            <p class="b-mono b-rail-key">{ready.index.snapshot_id}</p>
            <div class="b-backfill-row">
              <span>edad</span>
              <span class="b-mono">{formatAge(ready.createdAt, props.nowMs)}</span>
            </div>
            <div class="b-backfill-row">
              <span>bestiario</span>
              <span class="b-mono">{ready.index.publisher.version}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
