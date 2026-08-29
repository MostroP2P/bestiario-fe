import { describe, expect, test } from 'vitest'
import { DEFAULT_WINDOW, parseHash, printHash, ROUTES } from '~/router'

describe('reading a link', () => {
  test('opens the overview when the link says nothing', () => {
    // Arrange / Act / Assert — a bare domain, and the two ways a browser
    // writes an empty hash.
    for (const hash of ['', '#', '#/']) {
      expect(parseHash(hash)).toEqual({ route: 'overview', window: DEFAULT_WINDOW })
    }
  })

  test('opens the section the link names', () => {
    expect(parseHash('#/orders').route).toBe('orders')
    expect(parseHash('#/volume').route).toBe('volume')
  })

  test('carries the window the reader was looking at', () => {
    // SPEC 10.2: the window is a query in the hash so a link says what was
    // on screen, not just which page it was.
    expect(parseHash('#/orders?w=7d')).toEqual({ route: 'orders', window: '7d' })
    expect(parseHash('#/?w=all')).toEqual({ route: 'overview', window: 'all' })
  })

  test('falls back rather than failing on a link it cannot read', () => {
    // A stale bookmark, a typo, a link someone edited by hand.
    expect(parseHash('#/nowhere')).toEqual({ route: 'overview', window: DEFAULT_WINDOW })
    expect(parseHash('#/orders?w=fortnight').window).toBe(DEFAULT_WINDOW)
    expect(parseHash('#/orders?w=').window).toBe(DEFAULT_WINDOW)
  })

  test('ignores a trailing slash and the case of the path', () => {
    expect(parseHash('#/orders/').route).toBe('orders')
    expect(parseHash('#/ORDERS').route).toBe('orders')
  })
})

describe('writing a link', () => {
  test('says the section and the window', () => {
    expect(printHash({ route: 'orders', window: '7d' })).toBe('#/orders?w=7d')
    expect(printHash({ route: 'overview', window: '7d' })).toBe('#/?w=7d')
  })

  test('leaves the default window unsaid', () => {
    // A link to the overview as it opens should be `#/`, not `#/?w=30d`:
    // the shortest link that means what it says.
    expect(printHash({ route: 'overview', window: DEFAULT_WINDOW })).toBe('#/')
    expect(printHash({ route: 'volume', window: DEFAULT_WINDOW })).toBe('#/volume')
  })

  test('is what parse reads back, for every route and window', () => {
    for (const route of ROUTES) {
      for (const window of ['24h', '7d', '30d', '90d', 'all'] as const) {
        expect(parseHash(printHash({ route, window }))).toEqual({ route, window })
      }
    }
  })
})
