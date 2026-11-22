import { Figure } from './Figure'
import { useStrings } from '~/i18n/context'
import type { FiatRow } from '~/model/metrics'
import { swapRail, type SwapRail } from '~/model/swaps'

const RAIL_ORDER: readonly SwapRail[] = ['onchain', 'liquid', 'rootstock']

/**
 * One row per rail a swap moved bitcoin to or from.
 *
 * The figures are the publisher's `volume.fiat.<CODE>.*` for a BTC-pegged
 * code, signed in sats. `total` is left out on purpose: it is the other
 * rail's side of the same trades, in sats as well, and beside the Lightning
 * sats it would read as a second volume.
 */
export function SwapTable({ rows }: { readonly rows: readonly FiatRow[] }) {
  const strings = useStrings()
  const ordered = [...rows].sort(
    (a, b) =>
      RAIL_ORDER.indexOf(swapRail(a.code)!) - RAIL_ORDER.indexOf(swapRail(b.code)!) ||
      a.code.localeCompare(b.code),
  )
  const columns: readonly (readonly [string, string])[] = [
    ['completed', strings.swaps.completed],
    ['sats', strings.swaps.sats],
    ['ticket_p50', strings.swaps.typical],
    ['ticket_p90', strings.swaps.nineInTen],
  ]

  return (
    <div class="b-table" tabIndex={0} role="group" aria-label={strings.swaps.caption}>
      <table>
        <caption class="b-visually-hidden">{strings.swaps.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{strings.swaps.rail}</th>
            {columns.map(([key, heading]) => (
              <th key={key} scope="col">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordered.map((row) => (
            <tr key={row.code}>
              <th scope="row">
                {strings.swaps.rails[swapRail(row.code)!]}{' '}
                <span class="b-mono">{row.code}</span>
              </th>
              {columns.map(([key]) => (
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
