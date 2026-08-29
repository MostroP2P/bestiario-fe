import { formatMetric } from '~/model/format'
import { useStrings } from '~/i18n/context'
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
 *
 * The publisher writes `error` in English, whatever the page is rendered in.
 * It is quoted rather than translated: it is the publisher's own statement of
 * what a figure rests on, and putting words in its mouth is the one thing
 * this site must not do.
 */

let sequence = 0

export function Figure({ metric }: { readonly metric: Metric | undefined }) {
  const strings = useStrings()
  const formatted = formatMetric(metric)
  const absent = formatted.absence !== null
  const absenceLabel = formatted.absence ? strings.absence[formatted.absence] : ''
  const inferred = metric?.kind === 'inferred'
  const error = metric?.error

  if (!inferred) {
    return (
      <span class="b-figure" data-absent={absent}>
        <span aria-hidden={absent}>{formatted.text}</span>
        {absent && <span class="b-visually-hidden">{absenceLabel}</span>}
      </span>
    )
  }

  const id = `inf-${++sequence}`
  return (
    <span class="b-figure" data-absent={absent}>
      <span aria-hidden={absent}>{formatted.text}</span>
      {absent && <span class="b-visually-hidden">{absenceLabel}</span>}{' '}
      <span
        class="b-inferred-mark"
        tabIndex={0}
        role="note"
        aria-describedby={error ? id : undefined}
        aria-label={error ? strings.inferred.labelWith(error) : strings.inferred.label}
      >
        <span aria-hidden="true">{strings.inferred.mark}</span>
        {error && (
          <span class="b-tooltip" id={id} role="tooltip">
            {error}
          </span>
        )}
      </span>
    </span>
  )
}
