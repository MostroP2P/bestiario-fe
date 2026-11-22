import { useStrings } from '~/i18n/context'
import { swapRail } from '~/model/swaps'

/**
 * The word "swap" beside a code that is not a currency but a swap of
 * Lightning sats for bitcoin on another rail. Nothing for a currency. The
 * rail is in the accessible name, so the tag is never colour alone.
 */
export function SwapTag({ code }: { readonly code: string }) {
  const strings = useStrings()
  const rail = swapRail(code)
  if (rail === null) return null
  return (
    <span class="b-swap-tag" title={strings.swaps.rails[rail]}>
      {' '}
      {strings.swaps.tag}
      <span class="b-visually-hidden">: {strings.swaps.rails[rail]}</span>
    </span>
  )
}
