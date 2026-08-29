import { afterEach, describe, expect, test } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/preact'
import { useLocation } from '~/router'

afterEach(() => {
  cleanup()
  globalThis.location.hash = ''
})

/** A page that says where it is and can be told to go elsewhere. */
function Where() {
  const { location, go } = useLocation()
  return (
    <>
      <output>{`${location.route} ${location.window}`}</output>
      <button type="button" onClick={() => go({ route: 'volume', window: '7d' })}>
        go
      </button>
    </>
  )
}

describe('where the reader is', () => {
  test('is read from the link they arrived on', () => {
    // Arrange
    globalThis.location.hash = '#/orders?w=24h'

    // Act
    render(<Where />)

    // Assert
    expect(screen.getByText('orders 24h')).toBeTruthy()
  })

  test('is written to the address bar when they navigate', () => {
    render(<Where />)

    fireEvent.click(screen.getByRole('button', { name: 'go' }))

    expect(globalThis.location.hash).toBe('#/volume?w=7d')
    expect(screen.getByText('volume 7d')).toBeTruthy()
  })

  test('follows the back button, because the hash is the state', () => {
    // Arrange
    render(<Where />)

    // Act — what a browser does when the reader goes back.
    globalThis.location.hash = '#/orders'
    fireEvent(globalThis.window, new HashChangeEvent('hashchange'))

    // Assert
    expect(screen.getByText('orders 30d')).toBeTruthy()
  })
})
