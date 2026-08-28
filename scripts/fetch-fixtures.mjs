/**
 * Regenerates tests/fixtures/snapshot/ from the live relays.
 *
 * The fixtures are the real signed events, byte for byte as they travel: the
 * `content` of each kind 30666 event the publisher's index names, plus the
 * index itself and the signed envelopes. Everything in tests/nostr is checked
 * against these, and the canonicalisation of SPEC 5 is a reimplementation of
 * another program's serialiser — the only thing that can prove it right is
 * the bytes that program actually produced.
 *
 * Run: node scripts/fetch-fixtures.mjs
 *
 * A regeneration is a commit a human reads. Stale fixtures are how a client
 * and a publisher drift apart without either noticing (SPEC 12).
 */
import { SimplePool } from 'nostr-tools/pool'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'

const OUT = 'tests/fixtures/snapshot'

// Not imported from src/config.ts: that module is Vite's, not Node's. The
// manifest records what this run used, and a test asserts it still matches
// the configured publisher — drift is caught rather than prevented.
const PUBLISHER_PUBKEY =
  process.env.PUBLISHER ?? '000001204177f1e40e2732aa6a01648fc545b73883f2b0ea6fbc91d3ea5a5b9f'
const BESTIARIO_KIND = 30666
const relays = ['wss://relay.mostro.network', 'wss://nos.lol']

const pool = new SimplePool()

const events = await pool.querySync(
  relays,
  { kinds: [BESTIARIO_KIND], authors: [PUBLISHER_PUBKEY] },
  { maxWait: 20_000 },
)
pool.close(relays)

if (events.length === 0) {
  console.error('no events: is the publisher pubkey right, and are the relays up?')
  process.exit(1)
}

/** Newest per `d`: a relay serving a stale replaceable event is normal. */
const newest = new Map()
for (const event of events) {
  const d = event.tags.find((tag) => tag[0] === 'd')?.[1]
  if (!d) continue
  const held = newest.get(d)
  if (!held || event.created_at > held.created_at) newest.set(d, event)
}

const index = newest.get('index')
if (!index) {
  console.error('the publisher has no index: nothing here can be verified')
  process.exit(1)
}

rmSync(OUT, { recursive: true, force: true })
mkdirSync(OUT, { recursive: true })

/** The file for `d` is `d` with every `:` replaced by `-`, plus `.json`. */
const fileFor = (d) => `${d.replaceAll(':', '-')}.json`

for (const [d, event] of newest) {
  writeFileSync(`${OUT}/${fileFor(d)}`, JSON.stringify(event, null, 2) + '\n')
}

const manifest = {
  fetched_at: new Date().toISOString(),
  publisher: PUBLISHER_PUBKEY,
  relays,
  snapshot_id: JSON.parse(index.content).snapshot_id,
  documents: [...newest.keys()].sort(),
}
writeFileSync(`${OUT}/manifest.json`, JSON.stringify(manifest, null, 2) + '\n')

console.error(`wrote ${newest.size} events to ${OUT} (snapshot ${manifest.snapshot_id})`)
