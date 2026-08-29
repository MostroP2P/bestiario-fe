/**
 * Mostro's own events, as this client reads them.
 *
 * bestiario's documents are an archive's account of what happened; these are
 * the instances speaking for themselves, in the moment. The two are kept
 * apart on purpose: nothing here is hashed against the index, and nothing
 * here is signed by the publisher this build trusts. What a 38386 event
 * proves is that *that instance* said this about its own dispute.
 *
 * Parsing only. Who may sign an event is decided where the events arrive.
 */
import type { Event } from 'nostr-tools'
import { MOSTRO_DISPUTE_KIND } from '~/config'
import type { LiveDispute } from '~/model/open-disputes'

function tag(event: Event, name: string): string | undefined {
  return event.tags.find((entry) => entry[0] === name)?.[1]
}

/**
 * The dispute a 38386 event carries, or null.
 *
 * Absence is a miss and never a guess: an event with no `d` has no identity
 * to replace, and one with no `s` has no status to judge it by. A `z` tag
 * naming something other than a dispute is a different event under a kind
 * this client asked for, and is left alone.
 */
export function disputeFrom(event: Event): LiveDispute | null {
  if (event.kind !== MOSTRO_DISPUTE_KIND) return null

  const z = tag(event, 'z')
  if (z !== undefined && z !== 'dispute') return null

  const id = tag(event, 'd')
  const status = tag(event, 's')
  if (!id || !status) return null

  return {
    eventId: event.id,
    id,
    status,
    instancePubkey: event.pubkey,
    updatedAt: event.created_at * 1000,
  }
}
