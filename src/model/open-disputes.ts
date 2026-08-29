/**
 * Which disputes are open right now.
 *
 * The book is rebuilt from the instances' own dispute events (kind 38386),
 * not from a figure bestiario computed: a dispute is on it because the
 * Mostro operating it last said `initiated` or `in-progress`, and it leaves
 * the book the moment that instance says anything else.
 *
 * Two things make an entry: the status, and how recent the word is. An
 * instance that goes quiet would otherwise hold a dispute open forever, so
 * the book only reaches back `windowMs` — two days in `config.ts`.
 *
 * Pure: same events and same clock, same book. Nothing here talks to a relay
 * and nothing here formats a pixel.
 */

export type LiveDispute = {
  /** The Nostr event id, which NIP-01 breaks a timestamp tie on. */
  readonly eventId: string
  /** The dispute's `d` tag — its identity across status changes. */
  readonly id: string
  /** The dispute's `s` tag, as the instance wrote it. */
  readonly status: string
  /** The Mostro instance that signed the event. */
  readonly instancePubkey: string
  /** Milliseconds since epoch, from the event's signed `created_at`. */
  readonly updatedAt: number
}

export type DisputeBook = {
  readonly openStatuses: readonly string[]
  readonly windowMs: number
  readonly maxEntries: number
}

/** An addressable event's identity: the author and its `d`, never the `d` alone. */
export function keyOf(dispute: LiveDispute): string {
  return `${dispute.instancePubkey}:${dispute.id}`
}

/**
 * Whether `next` replaces `held` — the same two revisions of one addressable
 * event, in the same order, whichever a relay hands over first.
 *
 * NIP-01: the later `created_at` wins, and on a tie the *lowest* event id
 * does. Two revisions inside one second are ordinary — an instance settling a
 * dispute it opened moments before — and keeping whichever arrived first
 * would make the panel depend on which relay answered first.
 */
export function supersedes(next: LiveDispute, held: LiveDispute): boolean {
  if (next.updatedAt !== held.updatedAt) return next.updatedAt > held.updatedAt
  return next.eventId < held.eventId
}

/**
 * The open book, newest first, capped at `cfg.maxEntries`.
 *
 * A dispute seen twice is one entry at its newest status — 38386 is
 * addressable, so a relay serving an older revision alongside the current one
 * is normal and must not double a row or resurrect a settled dispute. Ties on
 * `updatedAt` break on the id, so the same input always yields the same book.
 */
export function openDisputes(
  disputes: readonly LiveDispute[],
  nowMs: number,
  cfg: DisputeBook,
): LiveDispute[] {
  const newest = new Map<string, LiveDispute>()
  for (const dispute of disputes) {
    const held = newest.get(keyOf(dispute))
    if (!held || supersedes(dispute, held)) newest.set(keyOf(dispute), dispute)
  }

  const open = [...newest.values()].filter(
    (dispute) =>
      cfg.openStatuses.includes(dispute.status) &&
      // A clock skewed into the future yields a negative age, which is inside
      // any positive window: an instance's clock is not this site's to
      // correct, and a dispute nobody can see is worse than an odd age.
      nowMs - dispute.updatedAt < cfg.windowMs,
  )

  open.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
  return open.slice(0, cfg.maxEntries)
}
