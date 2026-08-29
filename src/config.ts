/**
 * Every value the site is configured with, in one file (SPEC 3, 7.4, 11).
 *
 * Nothing here is read at runtime from the page's host: the publisher key is
 * baked in at build time, so changing the trust anchor is a commit and a
 * deploy. Relay URLs are the exception the spec allows — a relay can withhold
 * an event but cannot forge one — and a reader may override the set locally.
 */

/** Publisher pubkey (hex), SPEC 3. The only place in the source naming one. */
export const PUBLISHER_PUBKEY: string =
  import.meta.env.VITE_PUBLISHER_PUBKEY ??
  '000001204177f1e40e2732aa6a01648fc545b73883f2b0ea6fbc91d3ea5a5b9f'

/** bestiario's addressable statistics events, PUB §2. */
export const BESTIARIO_KIND = 30666

/** Mostro's own order events, the live layer behind the world map. */
export const MOSTRO_ORDER_KIND = 38383

/**
 * Mostro's own dispute events, the live layer behind the open-dispute book.
 *
 * These are the instances' events and not bestiario's: they are signed by
 * each Mostro, carry no payload this client hashes, and say only what that
 * instance says about its own disputes.
 */
export const MOSTRO_DISPUTE_KIND = 38386

/** Nostr metadata, used to resolve a Mostro instance's name and flag. */
export const METADATA_KIND = 0

/**
 * Where to read from, in the order they are dialled.
 *
 * The first two are the daemon's own, so they are where the statistics are.
 * The third is a Mostro developer's relay, added for redundancy: it carries
 * the instances' own events — the orders behind the map and the disputes
 * behind the book — and it will carry the documents too the day the daemon
 * publishes there. Until then it is a read that costs a connection and
 * withholds nothing, which is the only way a relay can be wrong here: a
 * relay may keep an event from this client, it can never forge one, and
 * every document is verified against the publisher's key and the index's
 * hash whichever relay hands it over.
 */
export const DEFAULT_RELAYS: readonly string[] = [
  'wss://relay.mostro.network',
  'wss://nos.lol',
  'wss://mostro-p2p.tech',
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

/**
 * The open-dispute book.
 *
 * A dispute is on the book while its own instance last said it was open, and
 * only for as long as that word is recent: an instance that stops publishing
 * leaves a dispute that would otherwise stand open forever. Two days is the
 * knob — long enough that a dispute argued over a weekend is still there,
 * short enough that the panel is about now.
 */
export const DISPUTES = {
  /** Statuses that count as an open dispute (`s` tag of a 38386 event). */
  openStatuses: ['initiated', 'in-progress'],
  /** How far back the book reaches, measured on the signed `created_at`. */
  windowMs: 2 * 24 * 60 * 60 * 1000,
  /** Ceiling on entries, so a spike degrades into a sample. */
  maxEntries: 50,
} as const

export const CACHE_SCHEMA_VERSION = 1
