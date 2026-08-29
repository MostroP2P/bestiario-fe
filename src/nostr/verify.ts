/**
 * What makes a figure on this site trustworthy.
 *
 * Three checks, in order of what they cost and what they prove: the event is
 * by the publisher this build trusts, its Schnorr signature holds, and the
 * SHA-256 of its payload is the hash the index named for it (§7).
 *
 * The failures are kept apart because they mean different things to a
 * reader. A wrong author or a broken signature is someone else's event. A
 * hash mismatch is a document from another snapshot, or a tampered one. A
 * parse failure is a document this client does not understand. None of them
 * renders a figure; all of them say which happened.
 *
 * What a signature proves is that bestiario published these figures, and
 * nothing about whether they are right. The site says so on its trust route.
 */
import { verifyEvent, type Event } from 'nostr-tools/pure'
import { canonicalPayload } from './canonical'
import { sha256Hex } from './hash'
import type { Envelope, IndexDoc } from './documents'

export type Failure = 'author' | 'signature' | 'parse' | 'hash'

export type Verified<T> = { ok: true; value: T } | { ok: false; reason: Failure }

function fail<T>(reason: Failure): Verified<T> {
  return { ok: false, reason }
}

/**
 * The event's seven signed fields and nothing else.
 *
 * nostr-tools memoises a successful verification on the event object itself,
 * under a symbol. Object spread copies symbol properties, so a *copy* of a
 * verified event carries the verdict of the original — and a copy with an
 * altered `content` would be accepted without the signature ever being
 * checked again. Verifying a freshly built object drops that memo along with
 * anything else that rode in on the value.
 */
function signedFieldsOf(event: Event): Event {
  return {
    id: event.id,
    pubkey: event.pubkey,
    created_at: event.created_at,
    kind: event.kind,
    tags: event.tags,
    content: event.content,
    sig: event.sig,
  }
}

/**
 * Author and signature, against a set of authors this client expects.
 *
 * Mostro's own events are signed by each instance and not by the publisher,
 * so the anchor there is the set of instances the archive named — a set the
 * reader can check, and one an unknown key cannot talk its way into.
 */
export function verifyFrom(event: Event, authors: ReadonlySet<string>): Verified<Event> {
  if (!authors.has(event.pubkey)) return fail('author')
  if (!verifyEvent(signedFieldsOf(event))) return fail('signature')
  return { ok: true, value: event }
}

/** Author and signature. Everything that can be checked without the index. */
export function verifySigned(event: Event, publisher: string): Verified<Event> {
  return verifyFrom(event, new Set([publisher]))
}

/** The index: signed by the publisher, and JSON this client understands. */
export function verifyIndex(event: Event, publisher: string): Verified<IndexDoc> {
  const signed = verifySigned(event, publisher)
  if (!signed.ok) return signed

  let parsed: unknown
  try {
    parsed = JSON.parse(event.content)
  } catch {
    return fail('parse')
  }
  if (!isIndexDoc(parsed)) return fail('parse')
  return { ok: true, value: parsed }
}

/**
 * A data document: signed by the publisher, parseable, and hashing to what
 * the index named for its `d`.
 */
export async function verifyDocument(
  event: Event,
  publisher: string,
  expectedHash: string,
): Promise<Verified<Envelope>> {
  const signed = verifySigned(event, publisher)
  if (!signed.ok) return signed

  let envelope: Envelope
  try {
    envelope = JSON.parse(event.content) as Envelope
  } catch {
    return fail('parse')
  }
  if (!envelope || typeof envelope !== 'object' || !envelope.payload) return fail('parse')

  let hash: string
  try {
    hash = await sha256Hex(canonicalPayload(envelope.payload))
  } catch {
    // A payload this client cannot canonicalise is one it does not
    // understand, which is a parse failure and not a tampered document.
    return fail('parse')
  }
  if (hash !== expectedHash) return fail('hash')

  return { ok: true, value: envelope }
}

function isEntry(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return typeof entry['d'] === 'string' && typeof entry['hash'] === 'string'
}

function isIndexDoc(value: unknown): value is IndexDoc {
  if (typeof value !== 'object' || value === null) return false
  const doc = value as Record<string, unknown>
  return (
    typeof doc['snapshot_id'] === 'string' &&
    typeof doc['coverage'] === 'object' &&
    doc['coverage'] !== null &&
    Array.isArray(doc['documents']) &&
    doc['documents'].every(isEntry)
  )
}
