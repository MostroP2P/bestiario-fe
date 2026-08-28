import { describe, expect, test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import {
  finalizeEvent,
  generateSecretKey,
  getPublicKey,
  type Event,
} from 'nostr-tools/pure'
import { verifyDocument, verifyIndex, verifySigned } from '~/nostr/verify'
import { PUBLISHER_PUBKEY } from '~/config'
import type { IndexDoc } from '~/nostr/documents'

const DIR = 'tests/fixtures/snapshot'

const events = new Map<string, Event>(
  readdirSync(DIR)
    .filter((file) => file !== 'manifest.json')
    .map((file) => {
      const event = JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8')) as Event
      return [event.tags.find((tag) => tag[0] === 'd')?.[1] ?? file, event] as const
    }),
)

const indexEvent = events.get('index')!
const index = JSON.parse(indexEvent.content) as IndexDoc
const ordersEvent = events.get('orders:24h')!
const ordersHash = index.documents.find((entry) => entry.d === 'orders:24h')!.hash

/** The same content, signed by somebody else. */
function resignedByAnotherKey(event: Event): Event {
  const key = generateSecretKey()
  return finalizeEvent(
    {
      kind: event.kind,
      created_at: event.created_at,
      tags: event.tags,
      content: event.content,
    },
    key,
  )
}

function tampered(event: Event, content: string): Event {
  return { ...event, content }
}

describe('verifySigned', () => {
  test('accepts a real event from the publisher', () => {
    expect(verifySigned(ordersEvent, PUBLISHER_PUBKEY)).toEqual({
      ok: true,
      value: ordersEvent,
    })
  })

  test('refuses an event by another author, however valid its signature', () => {
    // Arrange — genuinely signed, by the wrong key.
    const impostor = resignedByAnotherKey(ordersEvent)

    // Act / Assert
    expect(verifySigned(impostor, PUBLISHER_PUBKEY)).toEqual({
      ok: false,
      reason: 'author',
    })
  })

  test('refuses an event whose content was changed under its signature', () => {
    // Arrange — the figure a reader would see, moved. The id and sig are
    // the originals, which is exactly what an altered event looks like.
    const altered = tampered(
      ordersEvent,
      ordersEvent.content.replace('"value":250', '"value":99999'),
    )
    expect(altered.content).not.toBe(ordersEvent.content)

    expect(verifySigned(altered, PUBLISHER_PUBKEY)).toEqual({
      ok: false,
      reason: 'signature',
    })
  })

  test('does not carry a verification from the event a copy was made of', () => {
    // nostr-tools memoises a successful verification on the event object.
    // Object spread copies symbol properties, so verifying the original
    // first and then a tampered copy is the shape that would slip through.
    expect(verifySigned(ordersEvent, PUBLISHER_PUBKEY).ok).toBe(true)
    const altered = tampered(
      ordersEvent,
      ordersEvent.content.replace('"value":250', '"value":1'),
    )

    expect(verifySigned(altered, PUBLISHER_PUBKEY)).toEqual({
      ok: false,
      reason: 'signature',
    })
  })

  test('refuses an event whose signature is nonsense', () => {
    expect(
      verifySigned({ ...ordersEvent, sig: '0'.repeat(128) }, PUBLISHER_PUBKEY),
    ).toEqual({
      ok: false,
      reason: 'signature',
    })
  })
})

describe('verifyIndex', () => {
  test('accepts the real index', () => {
    const result = verifyIndex(indexEvent, PUBLISHER_PUBKEY)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.snapshot_id).toBe(index.snapshot_id)
  })

  test('refuses an index by another author', () => {
    expect(verifyIndex(resignedByAnotherKey(indexEvent), PUBLISHER_PUBKEY)).toEqual({
      ok: false,
      reason: 'author',
    })
  })

  test('refuses content that is not JSON', () => {
    // Re-signed so the failure is the parse and not the signature.
    const key = generateSecretKey()
    const publisher = getPublicKey(key)
    const broken = finalizeEvent(
      { kind: 30666, created_at: 1, tags: [['d', 'index']], content: 'not json' },
      key,
    )

    expect(verifyIndex(broken, publisher)).toEqual({ ok: false, reason: 'parse' })
  })

  test('refuses JSON that is not an index', () => {
    const key = generateSecretKey()
    const publisher = getPublicKey(key)
    const wrong = finalizeEvent(
      {
        kind: 30666,
        created_at: 1,
        tags: [['d', 'index']],
        content: '{"hello":"world"}',
      },
      key,
    )

    expect(verifyIndex(wrong, publisher)).toEqual({ ok: false, reason: 'parse' })
  })
})

describe('verifyDocument', () => {
  test('accepts a document whose payload hashes to what the index named', async () => {
    const result = await verifyDocument(ordersEvent, PUBLISHER_PUBKEY, ordersHash)

    expect(result.ok).toBe(true)
  })

  test('accepts every document the index names', async () => {
    // The whole set, because a client that verifies most of them renders a
    // panel that is sometimes empty for no reason a reader can see.
    for (const entry of index.documents) {
      const event = events.get(entry.d)
      expect(event, entry.d).toBeDefined()
      const result = await verifyDocument(event!, PUBLISHER_PUBKEY, entry.hash)
      expect(result.ok, `${entry.d}: ${result.ok ? '' : result.reason}`).toBe(true)
    }
  })

  test('refuses a document whose hash is not the one the index named', async () => {
    // A real, correctly signed document from another snapshot looks exactly
    // like this, and must not be mixed in (§7).
    const result = await verifyDocument(ordersEvent, PUBLISHER_PUBKEY, 'f'.repeat(64))

    expect(result).toEqual({ ok: false, reason: 'hash' })
  })

  test('refuses a document by another author before it hashes anything', async () => {
    const result = await verifyDocument(
      resignedByAnotherKey(ordersEvent),
      PUBLISHER_PUBKEY,
      ordersHash,
    )

    expect(result).toEqual({ ok: false, reason: 'author' })
  })

  test('refuses a document with no payload', async () => {
    const key = generateSecretKey()
    const publisher = getPublicKey(key)
    const empty = finalizeEvent(
      { kind: 30666, created_at: 1, tags: [['d', 'orders:24h']], content: '{}' },
      key,
    )

    expect(await verifyDocument(empty, publisher, ordersHash)).toEqual({
      ok: false,
      reason: 'parse',
    })
  })
})

describe('verifyDocument · a document this client cannot read', () => {
  test('refuses content that is not JSON', async () => {
    const key = generateSecretKey()
    const publisher = getPublicKey(key)
    const broken = finalizeEvent(
      { kind: 30666, created_at: 1, tags: [['d', 'orders:24h']], content: 'not json' },
      key,
    )

    expect(await verifyDocument(broken, publisher, ordersHash)).toEqual({
      ok: false,
      reason: 'parse',
    })
  })

  test('refuses a payload it cannot canonicalise, rather than throwing', async () => {
    // Arrange — a series payload whose rows are not rows.
    const key = generateSecretKey()
    const publisher = getPublicKey(key)
    const nonsense = finalizeEvent(
      {
        kind: 30666,
        created_at: 1,
        tags: [['d', 'series:orders:daily:2026-08']],
        content: JSON.stringify({
          payload: {
            period: { from: 'a', until: 'b' },
            resolution: 'daily',
            columns: [],
            rows: 7,
          },
        }),
      },
      key,
    )

    // Act / Assert
    expect(await verifyDocument(nonsense, publisher, ordersHash)).toEqual({
      ok: false,
      reason: 'parse',
    })
  })
})

describe('verifyDocument · content that is JSON but not a document', () => {
  const signedAs = (content: string) => {
    const key = generateSecretKey()
    return {
      publisher: getPublicKey(key),
      event: finalizeEvent(
        { kind: 30666, created_at: 1, tags: [['d', 'orders:24h']], content },
        key,
      ),
    }
  }

  test('refuses a null content', async () => {
    const { publisher, event } = signedAs('null')

    expect(await verifyDocument(event, publisher, ordersHash)).toEqual({
      ok: false,
      reason: 'parse',
    })
  })

  test('refuses a scalar content', async () => {
    const { publisher, event } = signedAs('5')

    expect(await verifyDocument(event, publisher, ordersHash)).toEqual({
      ok: false,
      reason: 'parse',
    })
  })
})

describe('verifyIndex · content that is JSON but not an index', () => {
  const signedIndex = (content: string) => {
    const key = generateSecretKey()
    return {
      publisher: getPublicKey(key),
      event: finalizeEvent(
        { kind: 30666, created_at: 1, tags: [['d', 'index']], content },
        key,
      ),
    }
  }

  test('refuses a null content', () => {
    const { publisher, event } = signedIndex('null')

    expect(verifyIndex(event, publisher)).toEqual({ ok: false, reason: 'parse' })
  })

  test('refuses an index whose documents list holds a null', () => {
    // A malformed entry makes the whole index untrustworthy: the hashes are
    // what everything else is checked against.
    const { publisher, event } = signedIndex(
      JSON.stringify({
        snapshot_id: 'x',
        coverage: { first_event_at: 'a', last_event_at: 'b' },
        documents: [null],
      }),
    )

    expect(verifyIndex(event, publisher)).toEqual({ ok: false, reason: 'parse' })
  })

  test('refuses an index whose entry is missing its hash', () => {
    const { publisher, event } = signedIndex(
      JSON.stringify({
        snapshot_id: 'x',
        coverage: { first_event_at: 'a', last_event_at: 'b' },
        documents: [{ d: 'orders:24h' }],
      }),
    )

    expect(verifyIndex(event, publisher)).toEqual({ ok: false, reason: 'parse' })
  })

  test('accepts an index with an empty documents list, which is a real state', () => {
    const { publisher, event } = signedIndex(
      JSON.stringify({
        snapshot_id: 'x',
        coverage: { first_event_at: 'a', last_event_at: 'b' },
        documents: [],
      }),
    )

    expect(verifyIndex(event, publisher).ok).toBe(true)
  })
})
