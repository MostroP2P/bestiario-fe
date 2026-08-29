import { WINDOWS, type Span } from '~/nostr/address'
import { useStrings } from '~/i18n/context'

/**
 * The window every figure on the page is of.
 *
 * It governs the whole route and selects among documents already addressed
 * by window (SPEC 8.1) — it never recomputes anything. A `<select>` rather
 * than the five buttons it was: the header now carries the sections, and a
 * control that says which window you are in reads better beside them than a
 * second row of tabs competing with the first.
 */
export function WindowPicker(props: {
  readonly window: Span
  readonly onChange: (window: Span) => void
}) {
  const strings = useStrings()

  return (
    <div class="b-lang">
      <select
        class="b-lang-select"
        aria-label={strings.header.windowNav}
        value={props.window}
        onChange={(event) => {
          const chosen = event.currentTarget.value
          const span = WINDOWS.find((window) => window === chosen)
          if (span && span !== props.window) props.onChange(span)
        }}
      >
        {WINDOWS.map((span) => (
          <option key={span} value={span}>
            {strings.header.windows[span]}
          </option>
        ))}
      </select>
    </div>
  )
}
