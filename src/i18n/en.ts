import type { Strings } from './strings'

/**
 * English, and the source of truth every other locale is a translation of.
 *
 * The register to keep: plain, specific, and never overclaiming. This site's
 * whole argument is that it says only what it can prove, and a string that
 * promises more than the data holds undoes that quietly.
 */
export const en: Strings = {
  locale: 'en',
  name: 'English',

  brand: { tagline: 'NETWORK OBSERVATORY' },

  header: {
    windowNav: 'Window',
    windows: { '24h': '24 H', '7d': '7 D', '30d': '30 D', '90d': '90 D', all: 'ALL' },
    network: 'MAINNET',
    verified: 'VERIFIED',
    connecting: 'CONNECTING',
  },

  rail: {
    publisher: 'PUBLISHER',
    publisherNote:
      'Every figure on this page comes from an event signed by this key and verified in your browser. A signature proves bestiario published them, not that they are right.',
    relays: 'RELAYS',
    archive: 'ARCHIVE',
    from: 'from',
    until: 'until',
    documents: 'documents',
    archiveNote:
      'The archive can only speak for this period. Outside it there are no zeros, there is absence.',
    snapshot: 'SNAPSHOT',
    age: 'age',
    version: 'bestiario',
  },

  map: {
    heading: 'MARKETS OF THE NETWORK',
    caption:
      'Each point is a currency with orders in the chosen window, in its country. Its size and how many routes leave it are its order volume.',
    loadingGeometry: 'LOADING GEOMETRY…',
    noGeometry: (reason) => `NO GEOMETRY · ${reason}`,
    activeMarkets: 'ACTIVE MARKETS',
    unplaced: (count) => `${count} unplaced, off the map`,
    illustrativeRoutes:
      'The routes are illustrative: they run to unnamed anchors, not to mostros. The daemon has not published orders:…:i:<pubkey> yet, and without it nothing says which instance trades which currency. What is measured is the currency, its country and its orders.',
    approximateInstances: (approximate, total) =>
      `${approximate} of ${total} instances name no country, so their point is a scattering and not a location. The routes are measured: each one is a currency that instance traded.`,
    describe: {
      empty: 'No order flow to show.',
      flows: (arcs, currencies, instances) =>
        `${arcs} order flows between ${currencies} currencies and ${instances} Mostro instances`,
      live: (count) => `${count} in progress`,
      settling: (count) => `${count} recently completed`,
      // Phrased so it reads at one as well as at many: a count of 1 with a
      // plural verb ("1 currencies could not be placed") is the sort of thing
      // a screen reader makes unmissable.
      unplacedCurrencies: (count) => `${count} currencies not placed on the map`,
      unplacedInstances: (count) => `${count} instances not placed on the map`,
    },
  },

  kpi: {
    orders: (window) => `ORDERS · ${window}`,
    ordersSub: (completed, rate) => `${completed} completed · ${rate}`,
    volume: (window) => `VOLUME · ${window}`,
    volumeSub: (p50) => `ticket p50 ${p50}`,
    disputes: (window) => `DISPUTES · ${window}`,
    disputesSub: (resolved, rate) => `${resolved} resolved · ${rate} of orders`,
    rightNow: 'RIGHT NOW',
    rightNowSub: (pending) => `in progress · ${pending} waiting to be taken`,
  },

  fiat: {
    heading: 'VOLUME BY CURRENCY',
    caption: 'Volume by currency in the chosen window',
    currency: 'currency',
    volume: 'volume',
    orders: 'orders',
    ticketAvg: 'average ticket',
    p50: 'p50',
    p90: 'p90',
    empty: 'Nothing to report in this window.',
  },

  pairs: {
    ordersHeading: 'ORDERS',
    canceled: 'canceled',
    abandonmentRate: 'abandonment rate',
    ticketAvg: 'average ticket',
    largest: 'largest order',
    disputesHeading: 'DISPUTES · DEV FEES',
    disputeRate: 'dispute rate',
    resolutionMedian: 'median resolution',
    devFees: 'dev fees',
    coverage: 'coverage',
    impliedVolume: 'implied volume',
    referenceVolume: 'volume in USD',
  },

  notMeasurable: {
    heading: 'BEYOND WHAT CAN BE MEASURED',
    items: [
      {
        title: 'Unique users',
        why: 'keys are ephemeral per order; counting pubkeys counts orders, not people.',
      },
      {
        title: 'What a dispute was about',
        why: 'the dispute event does not name the order that caused it.',
      },
      {
        title: 'Why an order was canceled',
        why: 'the events record the change of state, never the cause.',
      },
    ],
  },

  disputes: {
    heading: 'DISPUTES OPEN NOW',
    listLabel: 'Open disputes',
    empty: 'No open disputes.',
    asOf: 'Ages measured by the publisher when it computed the snapshot, not now.',
  },

  absence: {
    noData: 'no data',
    notMeasured: 'not measured',
    notPublished: 'not published',
  },

  inferred: {
    mark: 'inf',
    label: 'Inferred figure',
    labelWith: (error) => `Inferred figure. ${error}`,
  },

  loading: {
    announcement: (what) => `Loading ${what}…`,
    figures: "the network's figures",
  },

  fatal: {
    heading: 'No verified figures.',
    timeout: "No relay answered with the publisher's index.",
    unverified: (reason) => `The index did not verify: ${reason}.`,
    note: 'This page shows no figure it cannot prove.',
  },

  footnote: (relays) =>
    `Read from ${relays} relays and verified in this browser against the publisher's key. An absent value is drawn as absent and never as a zero; an inferred figure is marked as one.`,
}
