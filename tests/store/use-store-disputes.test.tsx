import { afterEach, describe, expect, test, vi } from 'vitest'
import { cleanup, render, waitFor } from '@testing-library/preact'
import type { Filter } from 'nostr-tools'

/**
 * What the hook does with the dispute watch when its consumer goes away.
 *
 * The store is shared for the whole page, so a route that stops asking has to
 * say so: otherwise the overview's subscription outlives the overview and the
 * tab keeps verifying dispute traffic nobody is looking at.
 */

let subscriptions = 0
let closed = 0

vi.mock('~/nostr/pool', () => ({
  openRelays: () => ({
    query: () => Promise.resolve([]),
    subscribe: (filter: Filter) => {
      if (filter.kinds?.includes(38386)) subscriptions += 1
      return () => {
        if (filter.kinds?.includes(38386)) closed += 1
      }
    },
    states: () => [],
    close: () => {},
  }),
}))

const { useStore, resetStore } = await import('~/store/useStore')

const AUTHORS = ['a'.repeat(64)]

function Probe({ authors }: { readonly authors: readonly string[] }) {
  const view = useStore([], authors)
  return <span>{view.disputes.length}</span>
}

afterEach(() => {
  cleanup()
  resetStore()
  subscriptions = 0
  closed = 0
})

describe('useStore and the dispute watch', () => {
  test('follows the instances the view names', async () => {
    render(<Probe authors={AUTHORS} />)

    await waitFor(() => expect(subscriptions).toBe(1))
  })

  test('releases the watch when the view that asked for it unmounts', async () => {
    // Arrange
    const { unmount } = render(<Probe authors={AUTHORS} />)
    await waitFor(() => expect(subscriptions).toBe(1))

    // Act — the reader leaves the overview.
    unmount()

    // Assert
    await waitFor(() => expect(closed).toBe(1))
  })

  test('a view that names no instance opens nothing to release', () => {
    const { unmount } = render(<Probe authors={[]} />)
    unmount()

    expect(subscriptions).toBe(0)
    expect(closed).toBe(0)
  })
})
