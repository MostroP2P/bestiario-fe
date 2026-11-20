import { Fragment } from 'preact'
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
 * often as it is a word, and a figure there answers to the same rules. It
 * may also be a short run of both — "p90 27 m · 20 timed" — read in order
 * and spaced, so a figure inside a phrase still goes through `Figure`.
 */
type Part = string | { readonly metric: Metric | undefined }

function render(part: Part) {
  return typeof part === 'string' ? part : <Figure metric={part.metric} />
}

export function Kpi(props: {
  readonly label: string
  readonly value: Part
  readonly sub: Part | readonly Part[]
}) {
  const sub: readonly Part[] = Array.isArray(props.sub) ? props.sub : [props.sub as Part]
  return (
    <div class="b-kpi">
      <span class="b-eyebrow">{props.label}</span>
      <strong>{render(props.value)}</strong>
      <small>
        {sub.map((part, index) => (
          <Fragment key={index}>
            {index > 0 && ' '}
            {render(part)}
          </Fragment>
        ))}
      </small>
    </div>
  )
}
