import { formatMetric } from '~/model/format'
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
  const columns = ['total', 'orders', 'ticket_avg', 'ticket_p50', 'ticket_p90'] as const
  const headings = ['volumen', 'órdenes', 'ticket medio', 'p50', 'p90']

  if (loading) {
    return (
      <div class="b-table">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonRow key={i} widths={['52px', '92px', '54px', '78px', '64px', '64px']} />
        ))}
      </div>
    )
  }

  if (rows.length === 0) {
    return <p class="b-empty">Nada que informar en esta ventana.</p>
  }

  return (
    <div class="b-table">
      <table>
        <caption class="b-visually-hidden">Volumen por moneda en la ventana elegida</caption>
        <thead>
          <tr>
            <th scope="col">moneda</th>
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
              {columns.map((column) => {
                const formatted = formatMetric(row.figures.get(column))
                return (
                  <td key={column} data-absent={formatted.absent}>
                    <span aria-hidden={formatted.absent}>{formatted.text}</span>
                    {formatted.absent && <span class="b-visually-hidden">{formatted.label}</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
