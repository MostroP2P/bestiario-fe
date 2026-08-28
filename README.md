<div align="center">
  <img src="assets/logo.png" alt="bestiario" width="360">
</div>

# bestiario-fe

The web client for [bestiario](https://github.com/MostroP2P/bestiario) — a
window onto what is happening in the [Mostro](https://mostro.network)
network.

bestiario indexes the public Nostr events Mostro instances publish and works
out the figures: orders created and completed, volume by currency, disputes
and how long they take, dev fees. It then publishes those figures as signed
Nostr events. This repository is the site that reads them.

It is a static site. There is no server, no API and no build-time data
fetch: the site ships code, and the data arrives at runtime over WebSocket
from public relays, verified in the reader's browser.

## The two properties everything else serves

**A reader trusts one pubkey, not a host.** The site is served from GitHub
Pages, which is a convenience and not a trust anchor. Every figure on screen
came from an event signed by the publisher key, and the signature was checked
in the browser that drew it. A mirror of this site on another domain shows
the same figures or shows nothing.

**The site never invents a number.** `null` is absence and renders as
absence, never as a zero. A figure the publisher inferred is marked as
inferred. A figure nothing published is neither of those and says so. A panel
whose proof failed shows the failure and no figure at all.

What a signature proves is that bestiario published these figures — nothing
about whether they are right.

## What it shows

One screen today, over a window the reader picks (24 h, 7 d, 30 d, 90 d, or
the whole archive):

- **The map.** Every currency the network traded in the window, placed in the
  country its ISO 4217 code names, sized by how many orders it carried.
- **Orders**: created, completed, canceled, completion and abandonment rates,
  and how many are open or in progress right now.
- **Volume**: total sats, ticket average and percentiles, the largest order,
  and a row per currency — thirteen of them on the current archive — with its
  own volume, order count and ticket distribution.
- **Disputes**: the rate, the resolution median, and the open book rebuilt
  from the indexed metric family, each with its id and its age.
- **Dev fees**: the total and its coverage, with the assumed percentage
  stated beside anything derived from it.
- **The archive's real extent**, so a period outside it reads as unindexed
  rather than as a quiet network.

### About the routes on the map

The routes are illustrative, and the site says so on the map itself.

How many routes leave a currency is measured — its share of the busiest
market. Where each one goes is not: bestiario publishes no document naming an
instance, so nothing on the wire says which instance trades which currency.
The far ends are anonymous anchors, drawn without a name so that nothing
invites a reader to think a Mostro instance sits there.

The fix is upstream and is written: a window document for every report, so
`instances` reaches a relay. Until it does, the map draws movement and
refuses to draw a claim.

## What it cannot show

Stated plainly, because a number that is not there is easy to mistake for a
number that is zero. Some of these are the daemon's limits and travel with
the data; the rest are this repository's.

- **Which instance trades which currency.** No published document crosses
  the two. See the note above.
- **Per-instance anything.** Every document is published unscoped; there is
  no `:i:<pubkey>` view to build a bestiary from.
- **Unique users.** Order keys are ephemeral; counting pubkeys counts orders,
  not people.
- **What a dispute was about.** The dispute event does not name its order.
- **Why an order was canceled.** The events record the change of state and
  never the cause.
- **Volume in a reference currency.** Computable in principle, and `missing`
  on the current archive: no completed order had a rate snapshot close enough
  to price it. It renders as absence, not as a bug in this site.

## Reproducing the payload hash

The most delicate contract in this client, and worth knowing about before
writing another one.

The publisher hashes a document's `payload` and the index names that hash;
a conformant client checks it before rendering. But the daemon computes the
hash over a *different serialisation* than the one it puts on the wire — the
struct in declaration order for the hash, an alphabetically sorted map for
the envelope. Hashing the bytes as received verifies **0 of 32** documents.
Re-serialised in declaration order, **32 of 32**.

`src/nostr/canonical.ts` is that re-serialisation, it is the only module that
may produce those bytes, and its test runs over the real signed events and
asserts the whole set rather than "most". The rules that are not guessable
from the format alone are pinned there: `ratio` and a fiat `amount` are
`f64` and always carry a decimal point, so `422550` on the wire is `422550.0`
to the hash; a fiat *metric* is an `{amount, code}` object while a fiat *row
cell* is a bare float.

It is also the module that disappears the day the daemon serialises the
envelope from the typed struct — at which point it becomes `JSON.stringify`
of what was received, and the fixtures prove the collapse was safe.

## Running it

```console
$ npm install
$ npm run dev
```

The dev server reads the live relays. There is no mock mode: the hardest bugs
here are relay bugs.

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server, against the real relays |
| `npm run build` | Typecheck, then static output to `dist/` |
| `npm run preview` | Serve `dist/` for a last look |
| `npm test` | Unit and integration tests |
| `npm run test:coverage` | The same, with the thresholds enforced |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |

### Configuration

Nothing about the deployed page is configurable by whoever serves it. Two
build-time variables, both baked into the bundle:

| Variable | Default | What it is |
| --- | --- | --- |
| `VITE_PUBLISHER_PUBKEY` | the current publisher | The key whose signature every figure must carry |
| `VITE_BASE` | `/` | `/` for a custom domain, `/<repo>/` for a project page |

Changing the publisher is a commit and a deploy, which is the point. A
publisher read at runtime from a query string would hand the trust anchor
back to whoever serves the page.

The read relays are not a trust decision — a relay can withhold an event but
cannot forge one past verification — and live in `src/config.ts`.

## Layout

```
bestiario-fe/
├── docs/SPEC.md              # the specification this implements
├── public/geo/               # country geometry, served from this origin
├── scripts/
│   ├── fetch-fixtures.mjs    # regenerates the fixtures from the relays
│   └── gen-iso-table.mjs     # alpha-2 → ISO numeric, from the atlas
├── src/
│   ├── config.ts             # publisher, relays, thresholds
│   ├── nostr/                # address grammar, canonicalisation, verification, pool
│   ├── store/                # index, documents, cache
│   ├── model/                # units, metric grouping, geography
│   ├── map/                  # projection, scene, routes, labels
│   ├── components/           # map, tables, skeletons, trust rail
│   └── views/                # one file per route
└── tests/
    ├── fixtures/snapshot/    # the real signed events
    └── ...
```

Files stay under 400 lines and modules are organised by domain, not by type.

## Testing

Tests first, and the two directories where a bug is silent — `src/nostr` and
`src/model` — are held at 100% on lines, branches and functions. The rest is
80%. `npm run test:coverage` enforces both.

The fixtures under `tests/fixtures/snapshot/` are the real signed events,
byte for byte as they travel, pulled from the relays by
`scripts/fetch-fixtures.mjs`. Regenerating them is a commit a human reads:
stale fixtures are how a client and a publisher drift apart without either
noticing. The manifest records which publisher they came from, and a test
asserts it still matches the one the build trusts.

## Accessibility

WCAG 2.2 AA. Semantic HTML, real tables with headers, and no meaning carried
by colour alone — which is why an inferred figure has a marker and not just a
hue. The map carries an accessible description of what it is showing,
including what it could not place. Loading is skeletons behind one live
region, so a screen reader hears what is loading once rather than a wall of
decorative boxes. `prefers-reduced-motion` stops every animation, the map's
travellers included.

## Contributing

Read [`docs/SPEC.md`](docs/SPEC.md) first — it is the source of truth for
what this site does and why, and it names the tests that cover each of its
requirements.

Everything written in this repository is in English: source, comments,
commit messages, documentation. Conversation with the maintainer may happen
in Spanish; the artifacts do not.

Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, …).

## Licence

MIT, which is what [bestiario](https://github.com/MostroP2P/bestiario)
declares for the daemon. Neither repository carries a `LICENSE` file yet.
