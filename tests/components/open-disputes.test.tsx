import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render } from '@testing-library/preact'
import { OpenDisputes } from '~/components/OpenDisputes'
import { en } from '~/i18n/en'
import type { LiveDispute } from '~/model/open-disputes'

const NOW = 1_700_000_000_000
const HOUR = 60 * 60 * 1000

function dispute(over: Partial<LiveDispute> = {}): LiveDispute {
  return {
    id: 'efa1ad7e-1cd0-4e9f-b7f0-3fd1a1c9c0aa',
    status: 'initiated',
    instancePubkey: 'a'.repeat(64),
    updatedAt: NOW - HOUR,
    ...over,
  }
}

const panel = (entries: readonly LiveDispute[]) =>
  render(<OpenDisputes entries={entries} nowMs={NOW} windowDays={2} loading={false} />)
    .container

afterEach(cleanup)

describe('the open dispute panel', () => {
  test('is a skeleton while the relays have not answered', () => {
    const { container } = render(
      <OpenDisputes entries={[]} nowMs={NOW} windowDays={2} loading={true} />,
    )

    expect(container.querySelectorAll('.b-skeleton').length).toBeGreaterThan(0)
    expect(container.querySelector('.b-empty')).toBeNull()
  })

  test('says the book is empty, and over how many days, when it is', () => {
    const container = panel([])

    expect(container.querySelector('.b-empty')?.textContent).toBe(en.disputes.empty(2))
  })

  test('shows one row per dispute, with its short id', () => {
    const container = panel([dispute(), dispute({ id: 'bbbbbbbb-second' })])

    const ids = [...container.querySelectorAll('.b-feed-text')].map((n) => n.textContent)
    expect(ids).toEqual(['efa1ad7e…', 'bbbbbbbb…'])
  })

  test('names the status in the reader’s language', () => {
    const container = panel([dispute({ status: 'in-progress' })])

    expect(container.querySelector('.b-dispute-status')?.textContent).toBe(
      en.disputes.status['in-progress'],
    )
  })

  test('shows a status it does not know the word for as it came', () => {
    const container = panel([dispute({ status: 'seller-refunded' })])

    expect(container.querySelector('.b-dispute-status')?.textContent).toBe(
      'seller-refunded',
    )
  })

  test('ages a dispute against the reader’s clock, not a snapshot', () => {
    const container = panel([dispute({ updatedAt: NOW - 4 * HOUR - 12 * 60_000 })])

    expect(container.querySelector('.b-dispute-age')?.textContent).toBe('4 h 12 m')
  })

  test('reads an age stamped in the future as none, rather than as negative', () => {
    const container = panel([dispute({ updatedAt: NOW + HOUR })])

    expect(container.querySelector('.b-dispute-age')?.textContent).toBe('0 s')
  })

  test('says where the book comes from and how far back it reaches', () => {
    const container = panel([dispute()])

    expect(container.querySelector('.b-asof')?.textContent).toBe(en.disputes.live(2))
  })

  test('keeps the list reachable by keyboard, with a name', () => {
    const container = panel([dispute()])

    const region = container.querySelector('.b-dispute-scroll')
    expect(region?.getAttribute('tabindex')).toBe('0')
    expect(region?.getAttribute('aria-label')).toBe(en.disputes.listLabel)
  })
})
