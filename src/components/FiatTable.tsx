import { useMemo, useState } from 'preact/hooks'
import { Figure } from './Figure'
import { useStrings } from '~/i18n/context'
import { SkeletonRow } from './Skeleton'
import type { FiatRow } from '~/model/metrics'
import {
  CODE_KEY,
  DEFAULT_FIAT_SORT,
  nextSort,
  sortFiatRows,
  type FiatSort,
} from '~/model/sort-fiat'

/**
 * One row per currency, from the `volume.fiat.<CODE>.<figure>` family.
 *
 * The currency is a column and not a suffix in a metric name. A figure the
 * publisher did not compute for a currency renders as absence, never as zero.
 *
 * Every heading reorders the table, and the state of that order is carried by
 * `aria-sort` rather than by the arrow beside it — the arrow is decoration a
 * screen reader never sees, and colour or shape alone may not be the only
 * thing saying which column a reader is looking at.
 */
export function FiatTable({
  rows,
  loading,
}: {
  readonly rows: readonly FiatRow[]
  readonly loading: boolean
}) {
  const strings = useStrings()
  const [sort, setSort] = useState<FiatSort>(DEFAULT_FIAT_SORT)

  const columns: readonly (readonly [string, string])[] = [
    [CODE_KEY, strings.fiat.currency],
    ['total', strings.fiat.volume],
    ['orders', strings.fiat.orders],
    ['ticket_avg', strings.fiat.ticketAvg],
    ['ticket_p50', strings.fiat.p50],
    ['ticket_p90', strings.fiat.p90],
  ]

  const sorted = useMemo(() => sortFiatRows(rows, sort), [rows, sort])

  if (loading) {
    return (
      <div class="b-table">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonRow
            key={i}
            widths={['52px', '92px', '54px', '78px', '64px', '64px']}
          />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return <p class="b-empty">{strings.fiat.empty}</p>
  }

  return (
    <div class="b-table" tabIndex={0} role="group" aria-label={strings.fiat.caption}>
      <table>
        <caption class="b-visually-hidden">{strings.fiat.caption}</caption>
        <thead>
          <tr>
            {columns.map(([key, heading]) => {
              const active = sort.key === key
              return (
                <th
                  key={key}
                  scope="col"
                  aria-sort={
                    active
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                >
                  <button
                    type="button"
                    class="b-sort"
                    data-active={active}
                    aria-label={strings.fiat.sortBy(heading)}
                    onClick={() => setSort((current) => nextSort(current, key))}
                  >
                    {heading}
                    <span class="b-sort-mark" aria-hidden="true">
                      {active ? (sort.direction === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={row.code}>
              <th scope="row">{row.code}</th>
              {columns.slice(1).map(([key]) => (
                <td key={key}>
                  <Figure metric={row.figures.get(key)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
