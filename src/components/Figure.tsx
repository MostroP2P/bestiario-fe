import { formatMetric } from '~/model/format'
import type { Metric } from '~/nostr/documents'

/**
 * A figure, with its provenance attached.
 *
 * SPEC 9 asks for three things this component is the single place to get
 * right. An inferred figure is visually distinct by a marker and not by a
 * colour alone, because colour alone fails WCAG 1.4.1. Its `error` — what
 * assumption it rests on — is reachable by hover *and* by keyboard, because a
 * tooltip that only opens under a pointer is not reachable at all. And an
 * absent figure is an em dash with a label saying which absence it is:
 * nothing to report, not measured, or never published.
 */

let sequence = 0

export function Figure({ metric }: { readonly metric: Metric | undefined }) {
  const formatted = formatMetric(metric)
  const inferred = metric?.kind === 'inferred'
  const error = metric?.error

  if (!inferred) {
    return (
      <span class="b-figure" data-absent={formatted.absent}>
        <span aria-hidden={formatted.absent}>{formatted.text}</span>
        {formatted.absent && <span class="b-visually-hidden">{formatted.label}</span>}
      </span>
    )
  }

  const id = `inf-${++sequence}`
  return (
    <span class="b-figure" data-absent={formatted.absent}>
      <span aria-hidden={formatted.absent}>{formatted.text}</span>
      {formatted.absent && <span class="b-visually-hidden">{formatted.label}</span>}{' '}
      <span
        class="b-inferred-mark"
        tabIndex={0}
        role="note"
        aria-describedby={error ? id : undefined}
        aria-label={error ? `Cifra inferida. ${error}` : 'Cifra inferida'}
      >
        <span aria-hidden="true">inf</span>
        {error && (
          <span class="b-tooltip" id={id} role="tooltip">
            {error}
          </span>
        )}
      </span>
    </span>
  )
}
