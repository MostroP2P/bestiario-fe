/**
 * Reading the comparison document.
 *
 * `compare:<window>` carries one block per Mostro instance — what it
 * completed, what it moved in sats, what it sent in dev fees, the rate it
 * charges — and it is the only place per-instance *volume* is published.
 * The scoped `orders:<window>:i:<pubkey>` documents carry counts and no
 * sats; the network's `volume:<window>` carries sats and no instance. This
 * document is the cross of the two, and the volume view reads it whenever a
 * reader narrows to one publisher.
 *
 * A block is keyed by the instance's display *label* and carries no pubkey
 * row, so the join to a chosen instance goes through `instances:<window>`,
 * which has both. The label grammar — split from the right, never from the
 * left — is `labelledBlocks`, shared with the instances document.
 */
import type { Metric } from '~/nostr/documents'
import { labelledBlocks, lookup } from '~/model/metrics'

export type CompareRow = {
  /** The label the publisher keys the block by. Not an address. */
  readonly label: string
  readonly figures: ReadonlyMap<string, Metric>
}

/** One row per instance the publisher compares, in the document's order. */
export function compareRows(metrics: readonly Metric[]): CompareRow[] {
  return [...labelledBlocks(metrics, 'compare.').entries()].map(([label, figures]) => ({
    label,
    figures,
  }))
}

/** The block a label names, or nothing when the document has none. */
export function compareOf(
  rows: readonly CompareRow[],
  label: string,
): CompareRow | undefined {
  return rows.find((row) => row.label === label)
}

/**
 * What share of the network's volume one instance moved.
 *
 * The publisher signs both halves and not the quotient, so this is inferred
 * and says so: it rests on the two documents covering the same window, which
 * the window selector is what guarantees. Absence anywhere in the division —
 * a missing half, or a network that moved nothing — is absence in the
 * result, never a zero and never an infinity.
 */
export function shareOfNetwork(
  row: CompareRow | undefined,
  network: readonly Metric[],
): Metric | undefined {
  const mine = row?.figures.get('volume_sats')?.value
  const whole = lookup(network, 'volume.sats')?.value
  if (typeof mine !== 'number' || typeof whole !== 'number' || whole <= 0)
    return undefined
  return {
    name: 'compare.share_of_volume',
    kind: 'inferred',
    unit: 'ratio',
    value: mine / whole,
  }
}
