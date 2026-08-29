import { useStrings } from '~/i18n/context'
import { heatLevel, type Matrix } from '~/model/matrix'
import { Skeleton } from './Skeleton'

/**
 * Artboard 2a's cross: one row per instance, one column per currency, shaded
 * by how many orders the pair created.
 *
 * It is a real table and not the artboard's grid of boxes. The figures are a
 * two-dimensional relation — this instance, in that currency — and a screen
 * reader that cannot hear which row and column a cell belongs to hears a
 * stream of unattached numbers. The look is unchanged: the table is laid out
 * at the artboard's own 96px name column, 3px gutter and 26px cell.
 *
 * The heat is a shade *and* the figure itself, never a shade alone, so the
 * grid reads the same to someone who cannot tell the shades apart — WCAG
 * 1.4.1. Each step clears AA against its own background, which the artboard's
 * inks did not at the two brightest steps.
 *
 * An empty cell is a pair with no orders in the window, drawn as the
 * artboard's dot; a screen reader hears the word rather than the glyph.
 */
export function CurrencyMatrix({
  matrix,
  loading,
}: {
  readonly matrix: Matrix
  readonly loading: boolean
}) {
  const strings = useStrings()

  if (loading) {
    return (
      <div class="b-matrix" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} class="b-matrix-skeleton">
            <Skeleton width="86px" height="11px" />
            {[0, 1, 2, 3, 4, 5, 6].map((cell) => (
              <Skeleton key={cell} height="26px" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  if (matrix.rows.length === 0) {
    return <p class="b-empty">{strings.matrix.empty}</p>
  }

  return (
    <div class="b-matrix" tabIndex={0} role="group" aria-label={strings.matrix.caption}>
      <table>
        <caption class="b-visually-hidden">{strings.matrix.caption}</caption>
        <thead>
          <tr>
            <th scope="col">
              <span class="b-visually-hidden">{strings.matrix.instance}</span>
            </th>
            {matrix.columns.map((code) => (
              <th key={code} scope="col">
                {code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.pubkey}>
              <th scope="row" title={row.name}>
                {row.name}
              </th>
              {row.cells.map((count, column) => {
                const code = matrix.columns[column] ?? ''
                return (
                  <td
                    key={code}
                    data-level={heatLevel(count, matrix.peak)}
                    title={strings.matrix.cell(row.name, code, count)}
                  >
                    {count === 0 ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span class="b-visually-hidden">{strings.matrix.none}</span>
                      </>
                    ) : (
                      count
                    )}
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
