import { Figure } from './Figure'
import { Skeleton } from './Skeleton'
import type { Metric } from '~/nostr/documents'

/**
 * A labelled list of figures, each rendered through `Figure` so an inferred
 * or absent one says so wherever it appears.
 */
export function Pairs(props: {
  readonly heading: string
  readonly loading: boolean
  readonly rows: readonly (readonly [string, Metric | undefined])[]
}) {
  return (
    <div>
      <h2 class="b-eyebrow b-section-head">{props.heading}</h2>
      {props.rows.map(([label, metric]) => (
        <p key={label} class="b-pair" style={{ margin: 0 }}>
          <span>{label}</span>
          {props.loading ? (
            <Skeleton width="64px" height="11px" />
          ) : (
            <span>
              <Figure metric={metric} />
            </span>
          )}
        </p>
      ))}
    </div>
  )
}
