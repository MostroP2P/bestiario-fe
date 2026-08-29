import { describe, expect, test } from 'vitest'
import { openDisputes, type LiveDispute } from '~/model/open-disputes'

const CFG = {
  openStatuses: ['initiated', 'in-progress'],
  windowMs: 2 * 24 * 60 * 60 * 1000,
  maxEntries: 50,
} as const

const NOW = 1_700_000_000_000
const HOUR = 60 * 60 * 1000

function dispute(over: Partial<LiveDispute> = {}): LiveDispute {
  return {
    eventId: 'e'.repeat(64),
    id: 'd1',
    status: 'initiated',
    instancePubkey: 'a'.repeat(64),
    updatedAt: NOW,
    ...over,
  }
}

describe('openDisputes', () => {
  test('returns nothing when no instance published a dispute', () => {
    expect(openDisputes([], NOW, CFG)).toEqual([])
  })

  test('keeps a dispute that is initiated', () => {
    const book = openDisputes([dispute({ status: 'initiated' })], NOW, CFG)

    expect(book).toHaveLength(1)
    expect(book[0]?.status).toBe('initiated')
  })

  test('keeps a dispute that is in progress', () => {
    const book = openDisputes([dispute({ status: 'in-progress' })], NOW, CFG)

    expect(book).toHaveLength(1)
  })

  test('drops a dispute that reached a settled status', () => {
    // Arrange
    const closed = ['settled', 'seller-refunded', 'released'].map((status, i) =>
      dispute({ id: `closed-${i}`, status }),
    )

    // Act
    const book = openDisputes(closed, NOW, CFG)

    // Assert
    expect(book).toEqual([])
  })

  test('drops a dispute last touched before the window', () => {
    const old = dispute({ updatedAt: NOW - 49 * HOUR })

    expect(openDisputes([old], NOW, CFG)).toEqual([])
  })

  test('keeps a dispute touched inside the window', () => {
    const recent = dispute({ updatedAt: NOW - 47 * HOUR })

    expect(openDisputes([recent], NOW, CFG)).toHaveLength(1)
  })

  test('reads the same dispute twice as one entry, at its newest status', () => {
    // Arrange — an addressable event replaced: same instance, same `d`.
    const first = dispute({ status: 'initiated', updatedAt: NOW - 3 * HOUR })
    const second = dispute({ status: 'in-progress', updatedAt: NOW - HOUR })

    // Act
    const book = openDisputes([first, second], NOW, CFG)

    // Assert
    expect(book).toHaveLength(1)
    expect(book[0]?.status).toBe('in-progress')
  })

  test('a replacement that settles the dispute takes it off the book', () => {
    const opened = dispute({ status: 'initiated', updatedAt: NOW - 3 * HOUR })
    const settled = dispute({ status: 'settled', updatedAt: NOW - HOUR })

    expect(openDisputes([opened, settled], NOW, CFG)).toEqual([])
  })

  test('the same dispute id on two instances is two disputes', () => {
    const a = dispute({ instancePubkey: 'a'.repeat(64) })
    const b = dispute({ instancePubkey: 'b'.repeat(64) })

    expect(openDisputes([a, b], NOW, CFG)).toHaveLength(2)
  })

  test('orders the book newest first, breaking ties on the id', () => {
    const older = dispute({ id: 'older', updatedAt: NOW - 2 * HOUR })
    const newer = dispute({ id: 'newer', updatedAt: NOW - HOUR })
    const tied = dispute({ id: 'anewer', updatedAt: NOW - HOUR })

    const book = openDisputes([older, newer, tied], NOW, CFG)

    expect(book.map((entry) => entry.id)).toEqual(['anewer', 'newer', 'older'])
  })

  test('caps the book so a spike degrades into a sample', () => {
    const many = Array.from({ length: 80 }, (_, i) =>
      dispute({ id: `d-${i}`, updatedAt: NOW - i * 60_000 }),
    )

    expect(openDisputes(many, NOW, { ...CFG, maxEntries: 50 })).toHaveLength(50)
  })

  test('breaks a tie on the same second by the lowest event id, as NIP-01 does', () => {
    // Arrange — two revisions of one dispute, published inside one second.
    // The protocol keeps the lexically lowest id, whatever a relay sent first.
    const kept = dispute({ eventId: 'a'.repeat(64), status: 'settled' })
    const discarded = dispute({ eventId: 'f'.repeat(64), status: 'initiated' })

    // Act — both arrival orders.
    const oneWay = openDisputes([kept, discarded], NOW, CFG)
    const other = openDisputes([discarded, kept], NOW, CFG)

    // Assert — the settled revision wins either way, so the row is gone.
    expect(oneWay).toEqual([])
    expect(other).toEqual([])
  })

  test('a tie the other way round keeps the open revision, either order', () => {
    const open = dispute({ eventId: 'a'.repeat(64), status: 'in-progress' })
    const settled = dispute({ eventId: 'f'.repeat(64), status: 'settled' })

    expect(openDisputes([open, settled], NOW, CFG)).toHaveLength(1)
    expect(openDisputes([settled, open], NOW, CFG)).toHaveLength(1)
  })

  test('keeps a dispute stamped in the future rather than hiding it', () => {
    // A publisher's clock skew is not this site's to correct, and a dispute
    // nobody can see is worse than one whose age reads as zero.
    const skewed = dispute({ updatedAt: NOW + HOUR })

    expect(openDisputes([skewed], NOW, CFG)).toHaveLength(1)
  })
})
