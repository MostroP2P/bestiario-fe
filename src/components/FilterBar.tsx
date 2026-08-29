import { useStrings } from '~/i18n/context'

/**
 * The two dimensions a reader may narrow a section by.
 *
 * Only two are offered because only two are published: the currency, from
 * the `volume.fiat.<CODE>.*` family, and the instance, from the scoped
 * orders documents. Buying and selling is signed as a share of the whole and
 * not as a breakdown, so it is a figure in the page and not a third select —
 * a filter that cannot cut what it claims to cut is a lie with a dropdown.
 *
 * `null` is "everything", and it is the value both start at.
 */
export type Filters = {
  readonly fiat: string | null
  readonly instance: string | null
}

export const NO_FILTERS: Filters = { fiat: null, instance: null }

export type InstanceOption = {
  readonly pubkey: string
  readonly name: string
}

export function FilterBar(props: {
  readonly currencies: readonly string[]
  readonly instances: readonly InstanceOption[]
  readonly value: Filters
  readonly onChange: (filters: Filters) => void
  /** What this section cannot narrow, said plainly rather than left to guess. */
  readonly note?: string | undefined
}) {
  const strings = useStrings()

  return (
    <div class="b-filters">
      <fieldset class="b-filter-set">
        <legend class="b-visually-hidden">{strings.filters.legend}</legend>

        <label class="b-filter">
          <span class="b-eyebrow">{strings.filters.fiat}</span>
          <select
            class="b-lang-select"
            aria-label={strings.filters.fiat}
            value={props.value.fiat ?? ''}
            onChange={(event) =>
              props.onChange({
                ...props.value,
                fiat: event.currentTarget.value || null,
              })
            }
          >
            <option value="">{strings.filters.allFiat}</option>
            {props.currencies.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label class="b-filter">
          <span class="b-eyebrow">{strings.filters.instance}</span>
          <select
            class="b-lang-select"
            aria-label={strings.filters.instance}
            value={props.value.instance ?? ''}
            onChange={(event) =>
              props.onChange({
                ...props.value,
                instance: event.currentTarget.value || null,
              })
            }
          >
            <option value="">{strings.filters.allInstances}</option>
            {props.instances.map((instance) => (
              <option key={instance.pubkey} value={instance.pubkey}>
                {instance.name}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      {props.note && <p class="b-filter-note">{props.note}</p>}
    </div>
  )
}
