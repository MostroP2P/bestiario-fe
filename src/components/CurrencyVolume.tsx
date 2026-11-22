import { FiatTable } from './FiatTable'
import { SwapTable } from './SwapTable'
import { useStrings } from '~/i18n/context'
import { formatCount } from '~/model/format'
import type { FiatRow } from '~/model/metrics'
import { splitSwaps, swapCount } from '~/model/swaps'

/**
 * The per-currency volume, with swaps apart from the currencies.
 *
 * Both come from the same `volume.fiat.<CODE>.*` family. The currency table
 * gets the fiat rows; the BTC-pegged rows are swaps of Lightning sats for
 * bitcoin on another rail and get their own block. The note under it gives
 * the swap count, so a reader adding up the currency table still reaches
 * the completed figure: losing 63 orders between two figures with no word
 * of why is the bug this split must not reintroduce.
 *
 * A reader narrowed to a swap code sees only the swaps block: an empty
 * currency table there would say "nothing to report" about a window that
 * reported a swap.
 */
export function CurrencyVolume({
  rows,
  loading,
}: {
  readonly rows: readonly FiatRow[]
  readonly loading: boolean
}) {
  const strings = useStrings()
  const { fiat, swaps } = splitSwaps(rows)
  const count = swapCount(swaps)

  const currencyTable = (
    <>
      <h2 class="b-eyebrow b-section-head">{strings.fiat.heading}</h2>
      <FiatTable rows={fiat} loading={loading} />
    </>
  )

  if (loading || swaps.length === 0) return currencyTable

  return (
    <>
      {fiat.length > 0 && currencyTable}
      <h2 class="b-eyebrow b-section-head">{strings.swaps.heading}</h2>
      <p class="b-note-why b-section-note">
        {count === null
          ? strings.swaps.noteUncounted
          : strings.swaps.note(formatCount(count))}
      </p>
      <SwapTable rows={swaps} />
    </>
  )
}
