import { Figure } from './Figure'
import { useStrings } from '~/i18n/context'
import { SkeletonRow } from './Skeleton'
import type { FiatRow } from '~/model/metrics'

/**
 * One row per currency, from the `volume.fiat.<CODE>.<figure>` family.
 *
 * The currency is a column and not a suffix in a metric name. A figure the
 * publisher did not compute for a currency renders as absence, never as zero.
 */
export function FiatTable({
  rows,
  loading,
}: {
  readonly rows: readonly FiatRow[]
  readonly loading: boolean
}) {
  const strings = useStrings()
  const columns = ['total', 'orders', 'ticket_avg', 'ticket_p50', 'ticket_p90'] as const
  const headings = [
    strings.fiat.volume,
    strings.fiat.orders,
    strings.fiat.ticketAvg,
    strings.fiat.p50,
    strings.fiat.p90,
  ]

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
            <th scope="col">{strings.fiat.currency}</th>
            {headings.map((heading) => (
              <th key={heading} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
              <th scope="row">{row.code}</th>
              {columns.map((column) => (
                <td key={column}>
                  <Figure metric={row.figures.get(column)} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
