# bestiario-fe — Technical Specification

Status: draft v0.1 (2026-08-28). This document specifies
[bestiario-fe](https://github.com/MostroP2P/bestiario-fe), the web client.
It is a companion to the daemon
[bestiario](https://github.com/MostroP2P/bestiario) and to its two
documents: [`docs/NOSTR-PUBLICATION.md`](https://github.com/MostroP2P/bestiario/blob/main/docs/NOSTR-PUBLICATION.md),
which stays the source of truth for the event format, and
[`docs/SPEC.md`](https://github.com/MostroP2P/bestiario/blob/main/docs/SPEC.md)
for what each figure means.

References written `PUB §N` point into `NOSTR-PUBLICATION.md`; `SPEC §N`
into the daemon's specification. Section numbers with no document name are
this one's.

This document is written in English, like everything in the bestiario
repositories. Conversation with the maintainer happens in Spanish; the
artifacts do not.

---

## 1. Goal

**A window onto what is happening in the Mostro network.** The site exists so
that anyone — a taker sizing up the market, a maker choosing where to publish,
someone deciding whether to trust a Mostro instance at all — can see how the
network is behaving without running a node, without querying a relay by hand
and without taking anyone's word for it.

Technically it is a static site that renders the Mostro network statistics
[bestiario](https://github.com/MostroP2P/bestiario) publishes as signed Nostr
events, reading them over WebSocket from public relays, in the browser, with
no backend of any kind.

The whole data surface is one event kind. bestiario indexes raw Mostro
activity, computes the figures, and publishes them as addressable **kind
`30666`** events signed by a single publisher key (§3). Those events are not
uniform: one of them, the **index**, is a manifest that names every other
document and the hash of its payload; the rest are **data documents** —
per-window aggregates and per-bucket series — each addressed by a `d` value
under the grammar of §4.1. The client reads the index first, then fetches
only the data documents the current view needs and checks each one against
the hash the index named for it (§6). The event anatomy is PUB §2–§7; §4
records what exists on the wire today.

It is the client PUB §10 calls normative. Two properties follow, and every
decision below serves them:

- **A reader trusts one pubkey, not a host.** The site is served from GitHub
  Pages, which is a convenience, not a trust anchor. Every figure on screen
  came from an event signed by the publisher key of §3, verified in the
  reader's browser. A mirror of this site on another domain shows the same
  figures or shows nothing.
- **The site never invents a number.** `null` is absence and renders as
  absence; an inferred figure is never dressed up as a measurement.

### 1.1 Non-goals

- No server, no API, no build-time data fetch. The site ships code; the data
  arrives at runtime from relays.
- No write path. The site never signs, never publishes, never asks for a key
  and integrates no signer extension (NIP-07).
- No indexing of raw Mostro events. bestiario has done that; this reads its
  conclusions.
- No analytics, no third-party scripts, no fonts from a CDN. A static site
  whose figures are verified and whose page phones home is a mixed message.

---

## 2. Conformance

The words MUST, MUST NOT, SHOULD and MAY are used as in RFC 2119. A build
that violates a MUST is not shippable, and each one below is covered by a
test named in §12.

1. The site MUST verify the Schnorr signature of every event it renders, and
   MUST discard any event whose `pubkey` is not the configured publisher.
2. The site MUST verify that the SHA-256 of a document's `payload` equals the
   `hash` the index names for that `d` (PUB §7), by the canonicalisation of
   §5, before rendering it.
3. The site MUST NOT compare the `s` tag with the index's `snapshot_id` as a
   coherence test. An unchanged document legitimately carries an older one.
4. The site MUST render `null` as absence and never as zero, in tables and in
   charts alike. A chart MUST break its line across a null bucket rather than
   join across it.
5. The site MUST mark every `inferred` figure as inferred and MUST make its
   `error` text reachable from the figure.
6. The site MUST show the age of the data, computed from the event's signed
   `created_at` and never from a field the publisher wrote about itself.
7. On a verification failure the site MUST fail closed for the affected
   panel: it shows why, and shows no figure. On a connection failure it
   degrades — last verified data, marked stale — and says so.

---

## 3. The publisher

| | |
|---|---|
| Publisher pubkey | a single hex key, configured at build time (below) |
| Event kind | `30666` (addressable, PUB §2) |
| Read relays | `wss://relay.mostro.network`, `wss://nos.lol`, `wss://mostro-p2p.tech` |

The first two are the daemon's `[nostr].relays`; `[publish].relays` is unset,
so publication goes to the same two, and they are where the documents are.
The third is a Mostro developer's relay and is read-only redundancy: it
carries the instances' own events — kind 38383 behind the map, 38386 behind
the dispute book — and no `30666` until the daemon publishes there too. A
relay that holds nothing withholds nothing: this client takes the newest
verified document per address across every relay that answers, so a third
relay can only add.

**The publisher key is a variable, not a constant of the protocol.** It is the
key bestiario signs with, and it can be rotated; the pair of values that must
agree is the signing key configured in
[bestiario](https://github.com/MostroP2P/bestiario) and the verifying key
configured in [bestiario-fe](https://github.com/MostroP2P/bestiario-fe). For
that reason this document names no key: it is set in one place per repository
and nowhere else. In this one it lives in `src/config.ts` (§10.4), fed by a
build-time environment variable, and it is the only place in the source that
may name a publisher.

It is nevertheless resolved **at build time**, and this is a MUST: the value
is baked into the bundle and displayed in the site's trust panel as an
`npub`, derived from the same constant so what the code checks and what a
reader can copy cannot drift. Changing the publisher is a commit and a
deploy — which is the point. A publisher read at runtime from a query string
or a JSON file next to the page would hand the trust anchor back to whoever
serves the page.

Relay URLs, by contrast, are not a trust decision here — a relay can withhold
an event but cannot forge one past §2.1 — so a reader MAY add or remove
relays at runtime, persisted locally (§7.3).

---

## 4. What is published today

Verified against the signed snapshot the site is tested over
(`tests/fixtures/snapshot`, fetched 2026-08-28), which is what the relays
actually serve today.

| Family | Window documents | Series partitions |
|---|---|---|
| `orders` | `24h` `7d` `30d` `90d` `all` | `daily:YYYY-MM`, `weekly:YYYY-MM`, `monthly:YYYY` |
| `volume` | same | same |
| `disputes` | same | same |
| `dev-fees` | same | same |
| `summary` | same | none |
| `instances` | same | none |
| `market` | same | none |
| `compare` | same | none |

Plus `index`. **Nothing else.** Specifically absent, and each absence shapes
§8:

- **No scoped documents.** Every address is published with `scope: None`:
  no `:i:<pubkey>`, no `:n:<network>`. Per-instance and per-network views
  cannot be built from the wire as it stands.
- **`volume.in.USD.total` is `missing`** on the maintainer's current archive:
  every completed order lacked a rate snapshot within 300s. It is a
  legitimate `null` and renders as absence, not as a bug in this site.

The window documents of the four reports without a series family —
`summary`, `instances`, `market`, `compare` — were absent when this was first
written and are published now; §14.2 records what that changed. `instances:<w>`
is what lets the site name a Mostro at all: the currency × instance cross of
§8.1 is read from it, and it is the set that authorises an author on the
dispute book below.

§14 raises these upstream. This specification describes a site that is
complete and honest over what is published **today**, and whose information
architecture has the shape those documents will slot into when they arrive.

### 4.1 Address grammar

The `d` values the site constructs, a strict subset of PUB §3:

```
d          = "index"
           / report ":" window
           / "series:" report ":" resolution ":" bucket

report     = "orders" / "volume" / "disputes" / "dev-fees"
window     = "24h" / "7d" / "30d" / "90d" / "all"
resolution = "daily" / "weekly" / "monthly"
bucket     = YYYY "-" MM          ; daily and weekly
           / YYYY                 ; monthly
```

Lowercase, exact. A typo MUST be a miss and never a fuzzy match. The parser
and the printer are inverses and are property-tested as such (§12).

The site keeps `scope` in its address type from the start, unpopulated, so
adding `:i:<pubkey>` later is a value and not a refactor.

---

## 5. Canonicalisation: reproducing the payload hash

**This is the most delicate contract in the client, and bestiario 0.2.0 does
not currently let a naive reader satisfy it.**

### 5.1 The problem

PUB §5 says `hash` is the SHA-256 of the document's `payload`, and PUB §10
step 5 has the client verify it. But the daemon computes that hash over a
*different serialisation* than the one it puts on the wire:

- `hash_of(&payload)` serialises the Rust struct directly, so keys come out
  in **declaration order** — `{"range":…,"metrics":…}`, and each metric as
  `{"name","kind","unit","value","error"?}`.
- The envelope carries `serde_json::to_value(&payload)`, and a `serde_json`
  built without `preserve_order` backs its maps with a `BTreeMap`, so what
  travels is **alphabetically sorted at every level** —
  `{"metrics":…,"range":…}`, each metric `{"kind","name","unit","value"}`.

Hashing the bytes as received therefore never matches. Measured: **0 of 32**
documents verify that way.

### 5.2 The rule

Until §14.1 lands upstream, a conformant client MUST re-serialise the parsed
payload into bestiario's *declaration order* and hash that. Reconstructed
against the daemon's own output, this verifies **32 of 32**.

Field order, from the Rust type definitions:

| Type | Order |
|---|---|
| window payload | `range`, `metrics` |
| series payload | `period`, `resolution`, `columns`, `rows` |
| `Range` | `from`, `until` |
| `Metric` | `name`, `kind`, `unit`, `value`, `error`(omitted when absent) |
| `Column` | `name`, `kind`(omitted when absent), `unit`, `error`(omitted when absent) |
| `Fiat` value | `amount`, `code` |

Number rendering, which is the other half of the rule:

- `count`, `sats`, `seconds` are Rust `i64` and render as integers.
- `ratio`, and the `amount` of a `fiat`, are `f64` and render the way
  `serde_json` renders one: shortest round-trip, **always carrying a decimal
  point**. `1.0` is `1.0`, not `1`; `0.0` is `0.0`, not `0`. JavaScript's
  `String(n)` gives the same shortest digits and drops the `.0`, so the
  renderer appends it when the output has no `.`, `e` or `E`.
- `null` is `null`. Strings are escaped as `JSON.stringify` escapes them,
  which is byte-identical to `serde_json` for the character classes these
  documents contain (ASCII, plus UTF-8 emitted raw by both).
- A **row cell** of unit `fiat` is a bare float, not an `{amount, code}`
  object — `cell()` in the daemon writes the amount alone. A **metric** of
  unit `fiat` is the object. The two shapes share a unit name and are the
  reason 3 of 32 documents failed a first reconstruction that treated them
  alike.

### 5.3 Where it lives

One module, `src/nostr/canonical.ts`, with one exported function
`canonicalPayload(payload: Payload): string`, and no other module may hash.
It is the single point that changes when §14.1 makes it unnecessary — at
which point it becomes `JSON.stringify` of the received bytes and the
fixtures prove the change was safe.

Its fixtures are the **33 real documents** from `bestiario publish --out`,
byte for byte as written (that command emits the exact wire `content`; the
file for `d` is `d` with every `:` replaced by `-`, plus `.json`), checked
against the hashes in the real index. A regression here is a site that
renders nothing, so the test asserts 32 of 32 and not "most".

---

## 6. Client algorithm

Normative, refining PUB §10 with what a browser actually has to do.

### 6.1 Boot

1. Open the connection pool to the relays of §3.
2. `REQ` the index: `{kinds:[30666], authors:[PUBLISHER], "#d":["index"], limit:1}`.
3. For each event received: verify `pubkey === PUBLISHER`, verify the
   signature, parse `content`. Keep the one with the **highest `created_at`**
   across relays; a relay serving a stale replaceable event is normal and is
   not an error.
4. Read `snapshot_id`, `coverage`, `resolutions`, `documents[]`. Build the
   map `d → {hash, revision, updated_at, restated_because?}`.
5. Render the shell with `coverage` known: a period outside it is drawn as
   "not indexed", never as zero.

Failure to obtain a verified index is the one fatal state: the site renders
its trust panel, the error, and no figures.

### 6.2 Fetching documents

6. Determine the `d` set the current route needs (§8.5).
7. Drop from it every `d` whose cached hash equals the index hash (§7.2).
8. Request the remainder in **one** `REQ` with an OR'd `#d` filter, as
   PUB §4.1 intends. One round trip per route, not one per panel.
9. For each event: verify author, verify signature, parse, canonicalise
   (§5), hash, compare against the index. On mismatch, discard and re-request
   once; on a second mismatch mark that panel `unverified` and render no
   figure in it.
10. Cache and render.

A document the index names but no relay returns within the timeout of §7.4
is `unavailable` — visibly distinct from `unverified`, because one is a
relay's silence and the other is a failed proof.

### 6.3 Live updates

11. Keep a standing subscription for the `d` set of the current route plus
    `index`, with no `until`, so replacements arrive as they are published.
12. The index is the trigger. On a new index: diff its `documents[]` against
    the previous one; the entries whose `hash` changed are re-requested,
    everything else is served from cache. A document event that arrives
    *before* its index is held, not rendered — PUB §7 publishes the index
    last, so a document ahead of the index belongs to a snapshot that is not
    yet coherent.
13. A document whose `revision` rose above what the reader last saw is
    surfaced as a **restatement**, with `restated_because`, not swapped
    silently (PUB §8). A number that changed under a reader is a fact about
    the data and belongs on screen.

### 6.4 Choosing a resolution

For a requested span, PUB §9.2:

| Span | Resolution | Partitions |
|---|---|---|
| < 90 days | `daily` | ≤ 4 |
| < 2 years | `weekly` | ≤ 24 |
| ≥ 2 years | `monthly` | ≤ 10 per decade |

Clamped by the index's `resolutions`: a resolution the publisher does not
offer for that span is stepped up, and a span reaching outside `coverage` is
requested only for the part inside it.

---

## 7. State, cache and connection

### 7.1 The store

One module owns everything the views read:

```ts
type Store = {
  publisher: string
  relays: RelayState[]            // url, status, last event at
  index: { event: VerifiedEvent, doc: IndexDoc } | null
  documents: Map<string, DocState>  // keyed by d
  route: Route
}

type DocState =
  | { status: 'cached' | 'live', payload: Payload, createdAt: number, revision: number, restatedBecause?: string }
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'unverified', reason: 'signature' | 'hash' | 'author' | 'parse' }
```

Views read the store and never a relay. The relay layer never touches the
DOM. Everything between the socket and `DocState` is a pure function of the
bytes received and is unit-tested without a network (§12).

### 7.2 Cache

`localStorage`, one entry per `d`: `{hash, payload, createdAt, revision}`.
PUB §10 makes a closed partition with an unchanged hash immutable, so it is
cached indefinitely. A cached entry is used only when its hash matches the
**current index**; nothing else may promote a cached payload to the screen.

The cache is a latency optimisation and never a source of truth: cleared
storage costs a round trip and changes no figure. Every write is wrapped
against a quota error or a browser that refuses storage, and the site is
fully functional with the cache disabled — which is also how one of the
tests runs it.

Budget: 5 MB is the usual ceiling and the whole published corpus is 163 KB,
so eviction is not a v1 concern. A `schema_version` mismatch drops the whole
cache rather than migrating it.

### 7.3 Relays

Each relay is dialled independently; one that is down, slow or serving
nothing never blocks another. The trust panel shows, per relay, its status
and the `created_at` of the newest event it supplied. A reader may add or
remove relays; the set is persisted locally, and the configured pair is
always restorable in one click.

Reconnection is exponential backoff with jitter, capped at 30 s, reset on a
successful subscription. A tab restored from `visibilitychange` re-checks the
index immediately rather than waiting for the next backoff.

### 7.4 Timeouts and staleness

| | |
|---|---|
| Index request timeout | 8 s across all relays before the fatal state |
| Document request timeout | 8 s before `unavailable` |
| Staleness warning | data older than 6 h, from `created_at` |
| Staleness alarm | older than 24 h |

The thresholds are constants in one module, and they are about the *signed*
`created_at` — never `generated_at`, which is the publisher's claim about
itself.

---

## 8. Information architecture

Five routes. Each is a hash route (§10.2) and each names exactly the `d` set
it needs, so a reader who lands on one downloads that and nothing else.

### 8.1 Overview — `#/`

The one screen a reader who wants a number, not a study, can stop at.

- A window selector — `24h · 7d · 30d · 90d · all` — governing the whole
  route. It selects among documents already addressed by window; it never
  recomputes anything.
- KPI tiles: `orders.created`, `orders.completed`, `orders.completion_rate`,
  `volume.sats`, `disputes.opened`, `dev_fees.total_sats`. Each tile shows
  its figure, its unit and, where the document carries one, its delta.
- The activity chart: `created` and `completed` per bucket, from the series
  partitions covering the selected window.
- A coverage strip: what the archive can and cannot speak for, drawn from
  `index.coverage`, so a short archive reads as a short archive rather than
  as a quiet network.

- The open dispute book. Not a published figure and not governed by the
  window selector: it is read from the instances' own dispute events —
  Mostro's kind `38386`, `d` the dispute id and `s` its status — kept to the
  disputes an instance last called `initiated` or `in-progress`, and reaching
  back only two days, so an instance that goes quiet cannot hold a dispute
  open forever. Ages are measured against the reader's clock, from each
  event's signed `created_at`.

`d` set: `orders:<w>`, `volume:<w>`, `disputes:<w>`, `dev-fees:<w>`, plus the
series partitions for the window.

The dispute events are the one place this route reads something the publisher
did not sign. The trust anchor there is the instance set: only a key the
`instances:<w>` document names may put a row on the book, and its signature
is checked like any other. What such an event proves is that *that instance*
said this about its own dispute — never that the archive agrees.

Until §14.2 lands there is no `summary` document, so this route composes its
tiles from the four family documents. The tiles are named for the metric
they show, so the day `summary:<w>` exists the route reads it and the numbers
do not move.

### 8.2 Orders — `#/orders`

`orders:<w>` plus `series:orders:<res>:<bucket>`. Created, completed,
canceled, completion and abandonment rates, open and in-progress now, and
the deltas. The chart is stacked completed/canceled over created.

### 8.3 Volume — `#/volume`

`volume:<w>` plus its series. The largest document family — 82 metrics on
the current archive — and the one that needs the most editing:

- Headline: `volume.sats`, ticket average / p50 / p90, largest order.
- Size distribution as a histogram over the five published buckets.
- Buy/sell split.
- **Per-fiat table**, one row per currency, built by grouping metric names
  on the `volume.fiat.<CODE>.<figure>` pattern: total, sats, orders, ticket
  avg/p50/p90. Sortable, and the currency is a first-class column rather
  than a suffix in a metric name. `sats` is what the same trade came to in
  the one unit every currency shares — the only figure in the row, beside
  the order count, that ranks a market against the others rather than
  against itself — and the per-currency `sats` sum to `volume.sats`. An
  archive published before the daemon carried the figure leaves it absent,
  so nothing may depend on its presence: the table opens on `orders`, not
  on a column that may not be there.
- **Reference currency** (`volume.in.USD.*`): inferred, so it renders in the
  inferred style with its `error` text, and — on the current archive — as
  absence, because it is `missing`.

The `volume.fiat.<CODE>.<figure>` and `volume.in.<CODE>.<figure>` groupings
are the only place the site parses a metric name. That parsing lives in one
module with a stated grammar and its own tests, because a name pattern is a
contract the daemon can change.

### 8.4 Disputes — `#/disputes` and dev fees — `#/dev-fees`

Disputes: by status, by initiator, rate, outcome shares, resolution p50/p90,
and the open-now list — which arrives as the indexed metric family
`disputes.open.<n>.id` / `.age`, rebuilt into a table sorted by age. Ages are
computed by the publisher against its own clock and move between runs; the
site shows them as of `created_at`, not as of now.

Dev fees: total, count, coverage, latency p50/p90, duplicates, orphans, and
the two inferred figures — `implied_volume` and `implied_vs_observed` —
rendered inferred, with the `dev_fee_percentage` assumption stated in full
beside them. That assumption is a configuration value of the daemon, not a
published fact, and a reader who disagrees with it is entitled to know the
figure is theirs to recompute.

### 8.5 Trust — `#/trust`

Not an "about" page. The verification state, in full: the publisher npub and
hex, per-relay connection state, the current `snapshot_id`, the age of the
data from `created_at`, how many documents are verified / cached /
unavailable / unverified, and a plain-language statement of what a signature
proves and what it does not — that bestiario published these figures, and
nothing about whether they are right.

Every panel elsewhere links here, and the header carries a compact form of it
that is visible on every route.

---

## 9. Rendering rules

These are what §2 means in pixels, and they are design constraints the
incoming visual design has to accommodate rather than choices it may make.

| Case | Rule |
|---|---|
| `observed` | Plain. The default. |
| `inferred` | Visually distinct — a marker adjacent to the figure, not a colour alone — and the `error` text reachable by hover **and** by focus, and present in the accessible name. Colour alone fails WCAG 1.4.1. |
| `null` / `missing` | An em dash and an accessible label saying which absence it is: nothing to report, or outside coverage. Never `0`, never `—` with no explanation. |
| A null bucket in a chart | The line breaks. It is never interpolated and never drawn at zero. Outside-coverage regions are hatched, not blank, so an unindexed period reads as unindexed. |
| A restated figure | Marked, with `restated_because`, until the reader dismisses it. |
| Stale data | A banner from 6 h, escalating at 24 h, with the age from `created_at`. |
| `unverified` | The panel shows the failure and no figure. |

Units are formatted by unit, not by name: `sats` with thousands separators
and a `sats` suffix (never silently converted to BTC), `ratio` as a
percentage to one decimal, `seconds` as a human duration, `fiat` with its
code, `count` as an integer, `text` verbatim. One formatter module, one test
per unit.

Locale: numbers are formatted with `Intl.NumberFormat` in the reader's
locale; the *canonicalisation* of §5 never touches a formatter.

---

## 10. Stack

### 10.1 Decisions

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite 6 + TypeScript, strict** | Static output, no SSR, no server. What GitHub Pages serves. |
| View | **Preact + `@preact/signals`** | ~10 KB. The panels are genuinely reactive — a relay pushes a replacement and one tile changes — and hand-rolled DOM diffing for that is the thing frameworks exist to stop people writing. Preact over React for the bundle, given the whole payload is 163 KB. |
| Nostr | **`nostr-tools`** (`SimplePool`, `verifyEvent`, `nip19`) | The reference implementation; Schnorr via `@noble/curves`, which is audited. Verification is the site's whole security posture and is not a place to hand-roll. |
| Hashing | **`crypto.subtle.digest('SHA-256')`** | Native, no dependency. Async, which the store already is. |
| Charts | **Hand-rolled inline SVG** | See §10.3. |
| State | **Signals + one store module** | No Redux-shaped ceremony for a 5-route read-only site. |
| Tests | **Vitest** + **Playwright** | §12. |
| Lint/format | ESLint + Prettier, `tsc --noEmit` in CI | |

No CSS framework. The design arrives as a design; a utility framework would
have it re-expressed twice.

### 10.2 Routing

Hash routing — `#/`, `#/orders`, `#/volume`, `#/disputes`, `#/dev-fees`,
`#/trust` — because GitHub Pages serves no rewrite rules and a path route
deep-linked is a 404. The window selector is a query in the hash
(`#/orders?w=7d`) so a link carries what the reader was looking at.

`base` in `vite.config.ts` is `/<repo>/` for a project page and `/` for a
custom domain, driven by one env var so the two builds differ by a variable
and not by an edit.

### 10.3 Charts

Hand-rolled SVG rather than a charting library, and the rationale is
specific rather than a preference:

- The shapes needed are four: line, stacked bar, histogram, sparkline.
- §9 imposes rendering rules — a broken line across nulls, hatched
  out-of-coverage regions, inferred series marked — that every library makes
  awkward and that are trivial when the path is ours.
- SVG is styled by the same CSS as the rest of the design, so the incoming
  design applies to the charts without a second theming mechanism. A canvas
  library (uPlot, Chart.js) is a second one by construction.
- The maths — scales, ticks, path building — are pure functions and reach
  100% coverage with no DOM.

The cost is roughly 250 lines to write and own. This is the one decision in
this document most likely to be overturned by the incoming design; if it
calls for chart types beyond those four, the position to fall back to is
uPlot with a CSS-variable theme bridge.

### 10.4 Layout

```
bestiario-fe/
├── docs/SPEC.md
├── index.html
├── vite.config.ts
├── src/
│   ├── main.tsx
│   ├── config.ts              # publisher pubkey (§3), relays, thresholds
│   ├── nostr/
│   │   ├── address.ts         # the d grammar (§4.1), parse and print
│   │   ├── canonical.ts       # §5 — the only module that may hash
│   │   ├── verify.ts          # author, signature, hash
│   │   ├── pool.ts            # connections, backoff, subscriptions
│   │   └── documents.ts       # index and payload types, parsing
│   ├── store/
│   │   ├── store.ts           # §7.1
│   │   ├── cache.ts           # §7.2
│   │   └── resolution.ts      # §6.4
│   ├── model/
│   │   ├── metrics.ts         # lookup, grouping, the name grammar of §8.3
│   │   └── format.ts          # §9 unit formatting
│   ├── charts/                # §10.3, pure geometry + thin SVG components
│   ├── views/                 # one file per route
│   └── components/            # tiles, tables, badges, trust panel
└── tests/
    ├── fixtures/snapshot/     # the 33 real documents + the real index
    └── e2e/
```

Files stay under 400 lines and modules are organised by domain, not by type.

---

## 11. Build and deploy

- `npm run dev` — Vite dev server, live against the real relays. There is no
  mock mode in development: the site's hardest bugs are relay bugs.
- `npm run build` — static output to `dist/`, no server-side anything.
- `npm run preview` — serves `dist/` for a last look.
- Deploy: GitHub Actions on push to `main` — `tsc --noEmit`, ESLint, Vitest
  with coverage, Playwright, `vite build`, publish `dist/` to Pages via
  `actions/deploy-pages`. A failing test does not deploy.
- `public/.nojekyll` so Pages serves the asset paths Vite emits.
- Budget: **≤ 120 KB gzipped JS**, enforced in CI. Exceeding it is a review
  conversation, not a warning to scroll past.
- No **runtime** environment variables. Everything the site needs is
  compiled in, the publisher pubkey of §3 included: it is read from a
  build-time variable (`VITE_PUBLISHER_PUBKEY`, defaulting to the value in
  `src/config.ts`) and baked into `dist/`. Nothing about the deployed page
  is configurable by whoever serves it.

---

## 12. Testing

Per the house rules: tests first, ≥ 80% overall, and the two modules where a
bug is silent — `nostr/` and `model/` — at 100%.

**Unit (Vitest).**

- `address.ts`: every valid `d` round-trips; every malformed one is rejected.
  Property test over the generated grammar.
- `canonical.ts`: the 33 fixtures reproduce **32 of 32** index hashes. Plus
  the float rule directly — `1.0`, `0.0`, `-0.0`, a long fraction, an
  exponent — and the two `fiat` shapes of §5.2.
- `verify.ts`: a good event verifies; a tampered `content`, a wrong author, a
  broken signature and a payload whose hash differs each fail, each with the
  right reason.
- `cache.ts`: a hash mismatch never serves the cache; a `schema_version`
  change drops it; a throwing `localStorage` degrades to no cache.
- `resolution.ts`: the ladder of §6.4, at every boundary, clamped by
  `coverage` and by `resolutions`.
- `metrics.ts`: the `volume.fiat.<CODE>.*` grouping, an unknown pattern
  ignored rather than guessed.
- `format.ts`: one test per unit, including `Missing`.
- `charts/`: scales, ticks and paths, including a null run and an
  out-of-coverage run.

**Integration (Vitest, in-process relay).** A fake relay serving the real
fixtures, signed at test time with a throwaway key:

- Boot to first render: index, then documents, then figures.
- A document signed by a *different* key is discarded, and the panel is
  `unverified`.
- A document arriving before its index is held, not rendered.
- A new index with one changed hash re-requests exactly that document.
- A rising `revision` surfaces the restatement.
- One relay dead, the other serving: the site renders in full.
- Both relays dead: the fatal state, with no figure on screen.

**E2E (Playwright).** Four flows, against the fake relay: the overview
renders and the window selector switches documents; a null renders as absence
in a table and as a break in a chart; an inferred figure's `error` is
reachable by keyboard; the trust route reports what it should. Plus an axe
pass per route (§13).

**Fixtures.** `tests/fixtures/snapshot/` is regenerated by a script running
`bestiario publish --dry-run --out` against a checkout of the daemon, and the
regeneration is a commit a human reads — never something CI does silently.
Stale fixtures are how a client and a publisher drift apart without either
noticing.

---

## 13. Accessibility, performance, language

- **WCAG 2.2 AA.** Semantic HTML, one `h1` per route, tables that are real
  tables with headers, focus visible, and no meaning carried by colour alone
  — which is what makes §9's inferred marker a marker and not a hue. Charts
  carry an accessible summary and their data is reachable as a table.
- **Reduced motion** honoured; live updates never steal focus or move
  content under a pointer.
- **Light and dark**, following the system and overridable, persisted.
- **Performance**: first contentful paint before the relay answers — the
  shell renders immediately with skeletons. No layout shift when data lands.
- **Language**: five — English, Spanish, Portuguese, French, Italian — with
  every user-facing string in one module so a translation is a file and not a
  refactor. The page opens in the language `navigator.languages` asks for,
  falling back to English, and the header carries a picker so a reader can
  always overrule that guess; the choice is kept in `localStorage` and
  outranks detection on every later visit. `<html lang>`, the tab title and
  the page description follow the language shown.

---

## 14. Upstream: what bestiario should change

Each of these is a PR against the daemon, not a workaround here. The site
ships without them; it is smaller than it should be until they land.

### 14.1 The published bytes are not the hashed bytes

`Snapshot::compute` stores `serde_json::to_value(&payload)` in the envelope,
and a `serde_json` `Value` is a `BTreeMap`, so the wire is alphabetically
sorted while `hash_of` hashed declaration order. A client following PUB §10
step 5 literally verifies **0 of 32** documents.

PUB §6 says the payload "is serialised deterministically: the same figures
produce the same bytes… Field order is the order given below". Two
serialisations of one payload is exactly the drift that sentence forbids.

Fix: serialise the envelope from the typed struct rather than through
`to_value` (or enable `serde_json/preserve_order`), so the bytes signed are
the bytes hashed. Then §5 here collapses to `JSON.stringify` of what was
received — and the fixtures prove the collapse was safe.

Until then this site carries §5, which is a reimplementation of another
program's serialiser and will rot the first time a field is added.

### 14.2 `summary`, `instances` and `compare` — fixed upstream

`family_of` returned `None` for them and the loop `continue`d, dropping their
*window* documents along with series they were never going to have. The
network summary and the bestiary — the per-instance profiles and the
comparison that SPEC §6.10 calls the product's main axis — were computable,
were specified, and reached no relay.

The daemon now publishes window documents for every report, and only the
*series* loop depends on a family. `instances:<w>` is what the currency ×
instance cross of §8.1 is read from, and what authorises an author on the
open dispute book. `summary:<w>` is published and this site does not read it
yet: §8.1 still composes its tiles from the four family documents, named for
the metrics they show, so the day it does the numbers do not move.

### 14.3 No scoped documents

Everything publishes with `scope: None`, so there is no per-instance or
per-network view to build. PUB §13.4 proposes per-instance series for
`orders` and `volume` at monthly resolution. That proposal, plus per-instance
*window* documents at `30d` and `all`, is what a bestiary page needs.

### 14.4 Smaller

- `--out` writes envelopes, not signed events, so a bundled offline snapshot
  cannot be verified and this site therefore ships none (§16.2). Writing the
  signed events instead would make an offline fallback trustworthy.
- The index has no `d` for what it *did not* publish because a report has no
  series family. A client cannot currently tell "not published" from "not
  implemented".

---

## 15. Phases

One PR per row. Each is mergeable alone: it builds, lints, its tests pass,
and it breaks no route that already worked.

| # | Title | Depends | Scope |
|---|---|---|---|
| 01 | `chore: vite, typescript and the module skeleton` | — | Vite + TS strict, Preact, ESLint/Prettier, Vitest, the tree of §10.4, CI running lint + typecheck + tests. |
| 02 | `test: the published corpus as fixtures` | 01 | The 33 documents and the index under `tests/fixtures/snapshot/`, plus the regeneration script and a README recording which archive and which daemon version produced them. |
| 03 | `feat(nostr): the d grammar` | 01 | `address.ts` per §4.1, parse and print as inverses, property-tested. |
| 04 | `feat(nostr): canonical payload hashing` | 02, 03 | §5, and the test that asserts 32 of 32. The PR that de-risks everything after it. |
| 05 | `feat(nostr): verification` | 04 | Author, signature, payload hash; the four failure reasons of §7.1. |
| 06 | `feat(nostr): relay pool` | 03 | `SimplePool`, per-relay state, backoff, the OR'd `#d` request of §6.2. |
| 07 | `feat(store): index, documents and cache` | 05, 06 | §6.1–6.2, §7. Integration tests against the in-process relay. |
| 08 | `feat(store): live updates and restatement` | 07 | §6.3: index-triggered diffing, held documents, revision surfacing. |
| 09 | `feat(model): units, formatting and metric grouping` | 02 | §9 formatters and the `volume.fiat.*` grammar of §8.3. |
| 10 | `feat(ui): shell, routing and the trust panel` | 07, 09 | Hash routing, header, connection and staleness state, `#/trust` whole. |
| 11 | `feat(charts): svg primitives` | 09 | §10.3: scales, ticks, paths, the null break and the coverage hatch. |
| 12 | `feat(ui): overview` | 10, 11 | §8.1. |
| 13 | `feat(ui): orders` | 12 | §8.2. |
| 14 | `feat(ui): volume` | 12 | §8.3, the per-fiat table included. |
| 15 | `feat(ui): disputes and dev fees` | 12 | §8.4. |
| 16 | `feat(a11y): audit and remediation` | 13, 14, 15 | axe per route, keyboard paths, reduced motion, contrast. |
| 17 | `ci: deploy to github pages` | 16 | §11, bundle budget enforced. |

The design lands between 01 and 10: it governs 10–15 and may overturn §10.3.

---

## 16. Open questions

1. **Custom domain or project page.** `mostro.world` is what PUB §1 names.
   That decides `base` and whether `CNAME` ships. Assumed: project page for
   now, one variable away from the other.
2. **Offline fallback.** None in v1, because §14.4 makes a bundled snapshot
   unverifiable and rendering unverified figures contradicts §2. Revisit when
   `--out` writes signed events.
3. **Spanish.** Expected, and the string module is built for it; whether it
   ships in v1 is the maintainer's call.
4. **Deep links to an instance.** Blocked on §14.3 — there is nothing to
   link to yet.
5. **A relay run by MostroP2P for retention.** PUB §13.2. If historical
   partitions are pruned by the public relays, a long-range chart is a
   republication away, and the site can say so but cannot fix it.
