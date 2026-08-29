/**
 * One headline figure: what it is, what it says, and what qualifies it.
 *
 * Shared by every route, so a number means the same thing and looks the
 * same wherever a reader meets it.
 */
export function Kpi(props: {
  readonly label: string
  readonly value: string
  readonly sub: string
}) {
  return (
    <div class="b-kpi">
      <span class="b-eyebrow">{props.label}</span>
      <strong>{props.value}</strong>
      <small>{props.sub}</small>
    </div>
  )
}
