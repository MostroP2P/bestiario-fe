/**
 * Every value the site is configured with, in one file (SPEC 3, 7.4, 11).
 *
 * Nothing here is read at runtime from the page's host: the publisher key is
 * baked in at build time, so changing the trust anchor is a commit and a
 * deploy. Relay URLs are the exception the spec allows — a relay can withhold
 * an event but cannot forge one — and a reader may override the set locally.
 */

/** Publisher pubkey (hex), SPEC 3. The only place in the source naming one. */
export const PUBLISHER_PUBKEY: string = import.meta.env.VITE_PUBLISHER_PUBKEY ?? ''

/** bestiario's addressable statistics events, PUB §2. */
export const BESTIARIO_KIND = 30666

/** Mostro's own order events, the live layer behind the world map. */
export const MOSTRO_ORDER_KIND = 38383

/** Nostr metadata, used to resolve a Mostro instance's name and flag. */
export const METADATA_KIND = 0

export const DEFAULT_RELAYS: readonly string[] = [
  'wss://relay.mostro.network',
  'wss://nos.lol',
]

/** SPEC 7.4. All in milliseconds, all measured against a signed `created_at`. */
export const TIMEOUTS = {
  index: 8_000,
  document: 8_000,
  stalenessWarning: 6 * 60 * 60 * 1000,
  stalenessAlarm: 24 * 60 * 60 * 1000,
} as const

/** SPEC 7.3. Exponential backoff with jitter, capped. */
export const BACKOFF = {
  initialMs: 500,
  maxMs: 30_000,
  jitterRatio: 0.3,
} as const

/**
 * The world map's live layer.
 *
 * `graceMs` is how long a finished order keeps its line on the map after it
 * settles. It is deliberately a knob: at today's volume ten minutes reads as
 * a busy network, and at ten times today's volume it would read as noise, at
 * which point this drops to a minute without touching the renderer.
 */
export const MAP = {
  graceMs: 10 * 60 * 1000,
  /** Order statuses that put a line on the map while they are current. */
  liveStatuses: ['pending', 'in-progress', 'waiting-buyer-invoice', 'waiting-payment'],
  /** Statuses that keep their line only for `graceMs` after `created_at`. */
  settlingStatuses: ['success'],
  /** Ceiling on lines drawn at once, so a spike degrades into a sample. */
  maxLines: 400,
} as const

export const CACHE_SCHEMA_VERSION = 1
