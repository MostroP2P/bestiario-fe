import mostroIcon from '~/assets/mostro-icon.svg'
import type { SAMPLE_INSTANCES, SAMPLE_RELAYS } from '~/data/sample'

/**
 * The left rail of artboard 2a: who is publishing, which relays answered, and
 * how much of the archive is indexed.
 *
 * The instance list is a real list and the relay list is a real list, because
 * SPEC 13 asks for semantic HTML and a reader on a screen reader should hear
 * "5 instances" rather than a run of divs.
 */

export type RailProps = {
  readonly instances: typeof SAMPLE_INSTANCES
  readonly relays: typeof SAMPLE_RELAYS
  readonly selected: string | null
  readonly onSelect: (pubkey: string) => void
  readonly events: string
  readonly backfillPct: number
  readonly backfillFrom: string
}

export function InstanceRail(props: RailProps) {
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

      <h2 class="b-eyebrow b-rail-heading">INSTANCIAS</h2>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {props.instances.map((instance) => (
          <li key={instance.pubkey}>
            <button
              type="button"
              class="b-instance"
              data-selected={props.selected === instance.pubkey}
              onClick={() => props.onSelect(instance.pubkey)}
              aria-pressed={props.selected === instance.pubkey}
              style={{
                width: '100%',
                background: 'none',
                border: 0,
                borderLeft: '2px solid transparent',
                textAlign: 'left',
                cursor: 'pointer',
                font: 'inherit',
              }}
            >
              <span class="b-instance-row">
                <span class="b-instance-name">{instance.name}</span>
                <span class="b-instance-up">{instance.up}</span>
              </span>
              <span class="b-spark" aria-hidden="true">
                {instance.spark.map((height, i) => (
                  <span key={i} style={{ height: `${Math.max(12, height)}%` }} />
                ))}
              </span>
              <span class="b-visually-hidden">
                {instance.orders} órdenes, {instance.vol}, versión {instance.version}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <h2
        class="b-eyebrow"
        style={{ margin: '14px 18px 0', borderTop: '1px solid var(--rule)', paddingTop: '14px' }}
      >
        RELAYS
      </h2>
      <ul class="b-relays" style={{ listStyle: 'none' }}>
        {props.relays.map((relay) => (
          <li key={relay.url} class="b-relay">
            <span class="b-relay-dot" data-state={relay.state} />
            <span class="b-relay-url">{relay.url}</span>
            <span class="b-relay-ms">{relay.ms}</span>
          </li>
        ))}
      </ul>

      <div class="b-backfill">
        <div class="b-backfill-row">
          <span>eventos</span>
          <span class="b-mono">{props.events}</span>
        </div>
        <div
          class="b-meter"
          role="img"
          aria-label={`backfill ${props.backfillPct} % desde ${props.backfillFrom}`}
        >
          <span style={{ width: `${props.backfillPct}%` }} />
        </div>
        <div
          class="b-mono"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '9px',
            color: 'var(--ink-dimmer)',
          }}
        >
          <span>backfill {props.backfillPct} %</span>
          <span>{props.backfillFrom}</span>
        </div>
      </div>
    </div>
  )
}
