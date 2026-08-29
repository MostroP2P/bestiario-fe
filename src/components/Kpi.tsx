import { Figure } from './Figure'
import type { Metric } from '~/nostr/documents'

/**
 * One headline figure: what it is, what it says, and what qualifies it.
 *
 * Shared by every route, so a number means the same thing and looks the
 * same wherever a reader meets it.
 *
 * A tile whose value the site worked out rather than read — a share, a
 * quotient — is given the metric itself instead of its text, so it goes
 * through `Figure` and carries the inferred marker and the absence label
 * that a headline computed in the browser must carry. SPEC 9 asks that of
 * every inferred figure, and a KPI tile is not an exception to it. The
 * qualifier under a figure takes either as well: it is a second figure as
 * often as it is a word, and a figure there answers to the same rules.
 */
export function Kpi(props: {
  readonly label: string
  readonly value: string | { readonly metric: Metric | undefined }
  readonly sub: string | { readonly metric: Metric | undefined }
}) {
  return (
    <div class="b-kpi">
      <span class="b-eyebrow">{props.label}</span>
      <strong>
        {typeof props.value === 'string' ? (
          props.value
        ) : (
          <Figure metric={props.value.metric} />
        )}
      </strong>
      <small>
        {typeof props.sub === 'string' ? props.sub : <Figure metric={props.sub.metric} />}
      </small>
    </div>
  )
}
