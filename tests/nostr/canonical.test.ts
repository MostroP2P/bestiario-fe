import { describe, expect, test } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { canonicalPayload, renderFloat } from '~/nostr/canonical'
import { sha256Hex } from '~/nostr/hash'
import { PUBLISHER_PUBKEY } from '~/config'
import type { Envelope, IndexDoc, Payload } from '~/nostr/documents'

const DIR = 'tests/fixtures/snapshot'

type Event = { content: string; pubkey: string; tags: string[][] }

function read(file: string): Event {
  return JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8')) as Event
}

const manifest = JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8')) as {
  publisher: string
  documents: string[]
}

/** Every fixture, keyed by its `d`. */
const events = new Map<string, Event>(
  readdirSync(DIR)
    .filter((file) => file !== 'manifest.json')
    .map((file) => {
      const event = read(file)
      const d = event.tags.find((tag) => tag[0] === 'd')?.[1] ?? file
      return [d, event] as const
    }),
)

const index = JSON.parse(events.get('index')!.content) as IndexDoc

function payloadOf(d: string): Payload {
  return (JSON.parse(events.get(d)!.content) as Envelope).payload
}

describe('the fixtures themselves', () => {
  test('came from the publisher this build trusts', () => {
    // A fixture set signed by another key proves nothing about this site.
    expect(manifest.publisher).toBe(PUBLISHER_PUBKEY)
  })

  test('are all signed by that publisher', () => {
    for (const [d, event] of events) {
      expect(event.pubkey, d).toBe(PUBLISHER_PUBKEY)
    }
  })

  test('include the index and every document it names', () => {
    expect(events.has('index')).toBe(true)
    for (const entry of index.documents) {
      expect(events.has(entry.d), `${entry.d} is named by the index but not captured`).toBe(true)
    }
  })
})

describe('canonicalPayload', () => {
  test('reproduces the hash of every document the index names', async () => {
    // Arrange
    const failures: string[] = []

    // Act
    for (const entry of index.documents) {
      const hash = await sha256Hex(canonicalPayload(payloadOf(entry.d)))
      if (hash !== entry.hash) failures.push(entry.d)
    }

    // Assert — all of them. A regression here is a site that renders
    // nothing, so this asserts the whole set and never "most".
    expect(failures).toEqual([])
    expect(index.documents.length).toBeGreaterThanOrEqual(32)
  })

  test('does not verify against the bytes as they travel', async () => {
    // The reason this module exists: the wire is alphabetically sorted and
    // the hash was taken over declaration order.
    const entry = index.documents[0]!
    const naive = await sha256Hex(JSON.stringify(payloadOf(entry.d)))

    expect(naive).not.toBe(entry.hash)
  })

  test('puts a window payload in declaration order', () => {
    const text = canonicalPayload(payloadOf('orders:24h'))

    expect(text.startsWith('{"range":{"from":')).toBe(true)
    expect(text).toContain('"metrics":[{"name":')
  })

  test('puts a series payload in declaration order', () => {
    const text = canonicalPayload(payloadOf('series:orders:daily:2026-08'))

    expect(text.startsWith('{"period":{"from":')).toBe(true)
    expect(text).toContain('"resolution":')
    expect(text).toContain('"columns":[{"name":')
  })

  test('writes a metric fiat value as an object and a row cell as a bare float', () => {
    const window = canonicalPayload(payloadOf('volume:all'))
    const series = canonicalPayload(payloadOf('series:volume:daily:2026-08'))

    expect(window).toContain('{"amount":422550.0,"code":"ARS"}')
    expect(series).toContain('114400.0')
    expect(series).not.toContain('{"amount":114400.0')
  })

  test('omits an absent error rather than writing null', () => {
    const text = canonicalPayload(payloadOf('orders:24h'))

    expect(text).not.toContain('"error":null')
  })

  test('keeps an error that is present', () => {
    const text = canonicalPayload(payloadOf('volume:all'))

    expect(text).toContain('"error":"no rate used;')
  })
})

describe('renderFloat', () => {
  test('always carries a decimal point', () => {
    expect(renderFloat(1)).toBe('1.0')
    expect(renderFloat(0)).toBe('0.0')
    expect(renderFloat(422550)).toBe('422550.0')
  })

  test('keeps a fraction as short as it round-trips', () => {
    expect(renderFloat(0.2459016393442623)).toBe('0.2459016393442623')
  })

  test('spells out negative zero, which String loses', () => {
    expect(renderFloat(-0)).toBe('-0.0')
  })

  test('leaves an exponent alone', () => {
    expect(renderFloat(1e30)).toBe('1e+30')
  })

  test('leaves a negative alone', () => {
    expect(renderFloat(-0.09375)).toBe('-0.09375')
  })
})

describe('canonicalPayload · a row wider than its columns', () => {
  test('does not throw, so one odd document cannot take the page down', () => {
    const payload = {
      period: { from: 'a', until: 'b' },
      resolution: 'daily',
      columns: [{ name: 'date', unit: 'date' as const }],
      rows: [['2026-08-01', 5]],
    }

    expect(() => canonicalPayload(payload)).not.toThrow()
    expect(canonicalPayload(payload)).toContain('["2026-08-01",5]')
  })
})
