import { describe, expect, test } from 'vitest'
import type { Event } from 'nostr-tools'
import { disputeFrom } from '~/nostr/mostro'
import { MOSTRO_DISPUTE_KIND, MOSTRO_ORDER_KIND } from '~/config'

const PUBKEY = 'c'.repeat(64)

function event(over: Partial<Event> = {}): Event {
  return {
    id: 'e'.repeat(64),
    pubkey: PUBKEY,
    created_at: 1_700_000_000,
    kind: MOSTRO_DISPUTE_KIND,
    tags: [
      ['d', 'efa1ad7e-1cd0-4e9f-b7f0-3fd1a1c9c0aa'],
      ['s', 'initiated'],
      ['y', 'mostrop2p'],
      ['z', 'dispute'],
    ],
    content: '',
    sig: 'f'.repeat(128),
    ...over,
  }
}

describe('disputeFrom', () => {
  test('reads the id, the status and the instance that signed it', () => {
    // Act
    const dispute = disputeFrom(event())

    // Assert
    expect(dispute).toEqual({
      id: 'efa1ad7e-1cd0-4e9f-b7f0-3fd1a1c9c0aa',
      status: 'initiated',
      instancePubkey: PUBKEY,
      updatedAt: 1_700_000_000_000,
    })
  })

  test('refuses an event of another kind, so an order is never a dispute', () => {
    expect(disputeFrom(event({ kind: MOSTRO_ORDER_KIND }))).toBeNull()
  })

  test('refuses an event with no dispute id', () => {
    expect(disputeFrom(event({ tags: [['s', 'initiated']] }))).toBeNull()
  })

  test('refuses an event with no status, which is not a guess to make', () => {
    expect(disputeFrom(event({ tags: [['d', 'abc']] }))).toBeNull()
  })

  test('refuses an event whose `z` names something other than a dispute', () => {
    const mislabelled = event({
      tags: [
        ['d', 'abc'],
        ['s', 'initiated'],
        ['z', 'order'],
      ],
    })

    expect(disputeFrom(mislabelled)).toBeNull()
  })

  test('accepts an event with no `z` tag at all', () => {
    const bare = event({
      tags: [
        ['d', 'abc'],
        ['s', 'initiated'],
      ],
    })

    expect(disputeFrom(bare)?.id).toBe('abc')
  })
})
