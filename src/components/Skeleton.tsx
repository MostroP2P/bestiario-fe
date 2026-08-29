/**
 * Placeholders for data that has not arrived.
 *
 * The shell renders immediately and the figures land into it, so there is no
 * moment where the page is a spinner and no layout shift when a relay
 * answers — a skeleton occupies the space its figure will.
 *
 * It is a placeholder and never a figure: nothing here is a number, and the
 * whole block is `aria-hidden` with one live region saying what is loading,
 * so a screen reader hears "loading the figures" once instead of a wall of
 * decorative boxes.
 *
 * The shimmer is honoured by `prefers-reduced-motion`, which stops the sweep
 * and leaves the block flat.
 */

export type SkeletonProps = {
  readonly width?: string
  readonly height?: string
  readonly radius?: string
}

export function Skeleton({
  width = '100%',
  height = '12px',
  radius = '2px',
}: SkeletonProps) {
  return <span class="b-skeleton" style={{ width, height, borderRadius: radius }} />
}

/** A KPI tile's worth: a label, a big figure and a note under it. */
export function SkeletonKpi() {
  return (
    <div class="b-kpi" aria-hidden="true">
      <Skeleton width="60%" height="8px" />
      <Skeleton width="45%" height="26px" />
      <Skeleton width="80%" height="10px" />
    </div>
  )
}

/** A row of a table, at the given column widths. */
export function SkeletonRow({ widths }: { readonly widths: readonly string[] }) {
  return (
    <div class="b-skeleton-row" aria-hidden="true">
      {widths.map((width, i) => (
        <Skeleton key={i} width={width} height="11px" />
      ))}
    </div>
  )
}

/** The map, before its geometry and its figures are both in. */
export function SkeletonMap() {
  return (
    <div class="b-skeleton-map" aria-hidden="true">
      <div class="b-skeleton-globe" />
    </div>
  )
}

/**
 * The one thing a screen reader hears while the page fills in. Everything
 * else is decorative and hidden from it.
 */
export function LoadingAnnouncement({ what }: { readonly what: string }) {
  return (
    <p class="b-visually-hidden" role="status" aria-live="polite">
      {what}
    </p>
  )
}
