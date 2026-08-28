/**
 * A relay, in the browser.
 *
 * Playwright intercepts the WebSocket before it leaves the page and this
 * answers it with the real signed events under `tests/fixtures/snapshot/`.
 * The site therefore verifies genuine signatures against genuine hashes — the
 * whole trust path runs — without a network, and without assertions that
 * change whenever the network does.
 *
 * It speaks the part of NIP-01 the client uses: `REQ` is answered with the
 * matching events and then `EOSE`; `CLOSE` needs no answer.
 */
import { readFileSync, readdirSync } from 'node:fs'
import type { Page } from '@playwright/test'

const DIR = 'tests/fixtures/snapshot'

export type Event = {
  id: string
  pubkey: string
  created_at: number
  kind: number
  tags: string[][]
  content: string
  sig: string
}

export function fixtures(): Event[] {
  return readdirSync(DIR)
    .filter((file) => file !== 'manifest.json')
    .map((file) => JSON.parse(readFileSync(`${DIR}/${file}`, 'utf8')) as Event)
}

export const dOf = (event: Event): string =>
  event.tags.find((tag) => tag[0] === 'd')?.[1] ?? ''

/**
 * Serve `events` to every relay the page dials.
 *
 * Pass an empty array for the state where no relay answers, which is the one
 * fatal state the site has.
 */
export async function serveRelay(
  page: Page,
  events: readonly Event[],
  delayMs = 0,
): Promise<void> {
  await page.routeWebSocket(/^wss:\/\//, (ws) => {
    ws.onMessage((raw) => {
      if (typeof raw !== 'string') return
      let message: unknown
      try {
        message = JSON.parse(raw)
      } catch {
        return
      }
      if (!Array.isArray(message)) return
      const [verb, subscription, filter] = message as [
        string,
        string,
        Record<string, unknown>,
      ]
      if (verb !== 'REQ') return

      const wanted = filter?.['#d'] as string[] | undefined
      const kinds = filter?.['kinds'] as number[] | undefined
      const authors = filter?.['authors'] as string[] | undefined

      const answer = () => {
        for (const event of events) {
          if (kinds && !kinds.includes(event.kind)) continue
          if (authors && !authors.includes(event.pubkey)) continue
          if (wanted && !wanted.includes(dOf(event))) continue
          ws.send(JSON.stringify(['EVENT', subscription, event]))
        }
        ws.send(JSON.stringify(['EOSE', subscription]))
      }
      // A delay is how the skeleton state is reached deliberately rather
      // than raced for.
      if (delayMs > 0) setTimeout(answer, delayMs)
      else answer()
    })
  })
}
