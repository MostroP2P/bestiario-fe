import { plural, type Strings } from './strings'

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

  document: {
    title: 'bestiario — the Mostro network, in the open',
    description:
      'Mostro network statistics, read from signed Nostr events and verified in your browser.',
  },

  units: { days: 'd', hours: 'h', minutes: 'm', seconds: 's' },

  brand: { tagline: 'NETWORK OBSERVATORY' },

  header: {
    windowNav: 'Window',
    language: 'Language',
    windows: { '24h': '24 H', '7d': '7 D', '30d': '30 D', '90d': '90 D', all: 'ALL' },
    network: 'MAINNET',
    stream: 'STREAM',
    connecting: 'CONNECTING',
  },

  nav: {
    label: 'Sections',
    overview: 'OVERVIEW',
    orders: 'ORDERS',
    volume: 'VOLUME',
  },

  filters: {
    legend: 'Filters',
    fiat: 'Currency',
    instance: 'Instance',
    allFiat: 'All currencies',
    allInstances: 'The whole network',
    unscoped: (name) =>
      `${name} does not publish an orders document of its own yet, so only what it publishes about itself is shown here; a figure the publisher does not break down per instance reads as absent rather than as the network's.`,
    unverifiedScoped: (name, reason) =>
      `${name} publishes an orders document of its own, and it did not verify in this browser: ${reason}. Nothing from it is shown — only what the instances document says about the instance.`,
    noInstanceVolume:
      'Only the total volume in sats is published per instance, in the comparison document. The per-currency amounts, ticket sizes, buy/sell split and reference conversion are signed for the whole network, so they read as absent while one instance is chosen.',
    noCompareRow: (name) =>
      `The comparison document for this window names no block for ${name}, so there is no volume of its own to show — which is absence, not a zero.`,
  },

  ordersView: {
    heading: 'Orders',
    caption: 'What the network created in the chosen window, and what became of it.',
    created: 'Created',
    completed: 'Completed',
    canceled: 'Canceled',
    completionRate: 'Completion rate',
    abandonmentRate: 'Abandonment rate',
    openNow: 'Open right now',
    inProgressNow: 'In progress right now',
    shareHeading: 'Buying and selling',
    buyShare: 'Buy share of orders',
    sellShare: 'Sell share of orders',
    shareNote:
      'The publisher signs this split as a share of the whole, not as a breakdown a filter could cut. It is read here rather than offered as one.',
    perCurrency: 'Orders by currency',
    perCurrencyNote:
      'Counted in the volume document, which is where the network breaks orders down by currency.',
    instanceHeading: 'What this instance publishes about itself',
    instanceFee: 'Fee',
    instanceMinOrder: 'Minimum order',
    instanceMaxOrder: 'Maximum order',
    instanceBond: 'Bond',
    instanceVersion: 'Version',
    instanceFiat: 'Currencies declared',
    instanceSeen: 'Last seen',
    instanceFirstSeen: 'First seen',
    instanceSilent: 'Silent for',
    instanceProtocol: 'Protocol version',
    instanceNetworks: 'Lightning networks',
    instanceCreated: 'Orders created in the window',
    perCurrencyNoInstance:
      "This instance's own orders document names no currency for this window.",
    perCurrencyNoDocument:
      'This instance publishes no orders document of its own, so there is no breakdown by currency to read for it.',
    shareNotPerInstance:
      'This split is signed for the whole network and not per instance, so it does not narrow to one.',
  },

  volumeView: {
    heading: 'Volume',
    caption:
      'What completed orders moved: in sats, and in the currencies they were priced in.',
    total: 'Total',
    completed: 'Completed orders',
    ticketAvg: 'Average ticket',
    p50: 'Median ticket',
    p90: 'p90 ticket',
    largest: 'Largest order',
    splitHeading: 'Buying and selling',
    buy: 'Bought',
    sell: 'Sold',
    sizesHeading: 'Order sizes',
    sizes: {
      lt_10k: 'under 10k',
      '10k_50k': '10k – 50k',
      '50k_200k': '50k – 200k',
      '200k_1m': '200k – 1M',
      gt_1m: 'over 1M',
    },
    referenceHeading: 'In a reference currency',
    referenceNote:
      'Inferred from the rate snapshots the publisher held at the time. Where none was close enough to price an order, this is absence and not a figure.',
    shareOfNetwork: 'Share of network volume',
    shareOfNetworkSub: 'Of what the whole network moved in this window',
    devFees: 'Dev fees sent',
    instanceCurrencies: 'Currencies this instance traded',
    instanceCurrenciesNote:
      "Counted in the instance's own orders document: how many orders it completed in each currency. The amounts are published for the network and not per instance.",
    instanceCurrenciesEmpty:
      'This instance publishes no breakdown by currency for this window.',
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
    illustrativeRoutes:
      'The routes are illustrative: they run to unnamed anchors, not to mostros. The daemon has not published orders:…:i:<pubkey> yet, and without it nothing says which instance trades which currency. What is measured is the currency, its country and its orders.',
    approximateInstances: (approximate, total) =>
      `${approximate} of ${total} ${plural(total, 'instance names', 'instances name')} no country, so their point is a scattering and not a location. The routes are measured: each one is a currency that instance traded.`,
    describe: {
      empty: 'No order flow to show.',
      flows: (arcs, currencies, instances) =>
        `${arcs} order ${plural(arcs, 'flow', 'flows')} between ${currencies} ${plural(currencies, 'currency', 'currencies')} and ${instances} Mostro ${plural(instances, 'instance', 'instances')}`,
      live: (count) => `${count} in progress`,
      settling: (count) => `${count} recently completed`,
      // Phrased so it reads at one as well as at many: a count of 1 with a
      // plural verb ("1 currencies could not be placed") is the sort of thing
      // a screen reader makes unmissable.
      unplacedCurrencies: (count) =>
        `${count} ${plural(count, 'currency', 'currencies')} not placed on the map`,
      unplacedInstances: (count) =>
        `${count} ${plural(count, 'instance', 'instances')} not placed on the map`,
    },
  },

  kpi: {
    orders: (window) => `COMPLETED ORDERS · ${window}`,
    ordersSub: (rate, total) => `${rate} of ${total} settled`,
    volume: (window) => `VOLUME · ${window}`,
    volumeSub: (p50) => `ticket p50 ${p50}`,
    disputes: (window) => `DISPUTES · ${window}`,
    disputesSub: (resolved, rate) => `${resolved} resolved · ${rate} of orders`,
    rightNow: 'RIGHT NOW',
    rightNowSub: (pending) => `in progress · ${pending} waiting to be taken`,
  },

  matrix: {
    heading: 'CURRENCY × INSTANCE · ORDERS',
    caption: 'Orders created by each instance in each currency, in the chosen window',
    instance: 'instance',
    cell: (instance, code, orders) => `${instance} · ${code}: ${orders}`,
    none: 'no orders',
    empty: 'No instance published a breakdown of its own for this window.',
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
    sortBy: (column) => `Sort by ${column}`,
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
    empty: (days) =>
      `No dispute is open right now, by the instances' own events of the last ${days} days.`,
    live: (days) =>
      `Disputes each instance last called initiated or in progress, from its own signed events of the last ${days} days. Ages are measured against your clock.`,
    status: { initiated: 'initiated', 'in-progress': 'in progress' },
    rowTitle: (id, instance) => `Dispute ${id} · instance ${instance}`,
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
    `Read from ${relays} ${plural(relays, 'relay', 'relays')} and verified in this browser against the publisher's key. An absent value is drawn as absent and never as a zero; an inferred figure is marked as one.`,
}
