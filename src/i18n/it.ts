import { plural, type Strings } from './strings'

/** Italiano. Traduzione di `en.ts`, che fa fede. */
export const it: Strings = {
  locale: 'it',
  name: 'Italiano',

  document: {
    title: 'bestiario — la rete Mostro, allo scoperto',
    description:
      'Statistiche della rete Mostro, lette da eventi Nostr firmati e verificate nel tuo browser.',
  },

  units: { days: 'g', hours: 'h', minutes: 'min', seconds: 's' },

  brand: { tagline: 'OSSERVATORIO DELLA RETE' },

  header: {
    windowNav: 'Finestra',
    windows: { '24h': '24 H', '7d': '7 G', '30d': '30 G', '90d': '90 G', all: 'TUTTO' },
    network: 'MAINNET',
    verified: 'VERIFICATO',
    connecting: 'IN CONNESSIONE',
  },

  rail: {
    publisher: 'EDITORE',
    publisherNote:
      'Ogni cifra di questa pagina viene da un evento firmato con questa chiave e verificato nel tuo browser. Una firma prova che l’ha pubblicata bestiario, non che sia corretta.',
    relays: 'RELAY',
    archive: 'ARCHIVIO',
    from: 'dal',
    until: 'al',
    documents: 'documenti',
    archiveNote:
      'L’archivio può rispondere solo di questo periodo. Al di fuori non ci sono zeri, c’è assenza.',
    snapshot: 'ISTANTANEA',
    age: 'età',
    version: 'bestiario',
  },

  map: {
    heading: 'MERCATI DELLA RETE',
    caption:
      'Ogni punto è una valuta con ordini nella finestra scelta, nel suo paese. La sua dimensione e quante rotte ne partono sono il suo volume di ordini.',
    loadingGeometry: 'CARICAMENTO GEOMETRIA…',
    noGeometry: (reason) => `NESSUNA GEOMETRIA · ${reason}`,
    activeMarkets: 'MERCATI ATTIVI',
    unplaced: (count) => `${count} senza posizione, fuori dalla mappa`,
    illustrativeRoutes:
      'Le rotte sono illustrative: vanno verso ancoraggi senza nome, non verso le istanze Mostro. Il daemon non ha ancora pubblicato orders:…:i:<pubkey>, e senza quel dato nulla dice quale istanza tratta quale valuta. Ciò che è misurato è la valuta, il suo paese e i suoi ordini.',
    approximateInstances: (approximate, total) =>
      `${approximate} ${plural(total, 'istanza su', 'istanze su')} ${total} ${plural(total, 'non nomina', 'non nominano')} un paese, quindi il loro punto è una dispersione e non una posizione. Le rotte sono misurate: ognuna è una valuta che quell’istanza ha trattato.`,
    describe: {
      empty: 'Nessun flusso di ordini da mostrare.',
      flows: (arcs, currencies, instances) =>
        `${arcs} ${plural(arcs, 'flusso', 'flussi')} di ordini tra ${currencies} ${plural(currencies, 'valuta', 'valute')} e ${instances} ${plural(instances, 'istanza', 'istanze')} Mostro`,
      live: (count) => `${count} in corso`,
      settling: (count) =>
        `${count} ${plural(count, 'completato di recente', 'completati di recente')}`,
      unplacedCurrencies: (count) =>
        `${count} ${plural(count, 'valuta non collocata', 'valute non collocate')} sulla mappa`,
      unplacedInstances: (count) =>
        `${count} ${plural(count, 'istanza non collocata', 'istanze non collocate')} sulla mappa`,
    },
  },

  kpi: {
    orders: (window) => `ORDINI · ${window}`,
    ordersSub: (completed, rate) => `${completed} completati · ${rate}`,
    volume: (window) => `VOLUME · ${window}`,
    volumeSub: (p50) => `ticket p50 ${p50}`,
    disputes: (window) => `DISPUTE · ${window}`,
    disputesSub: (resolved, rate) => `${resolved} risolte · ${rate} degli ordini`,
    rightNow: 'IN QUESTO MOMENTO',
    rightNowSub: (pending) => `in corso · ${pending} in attesa di essere presi`,
  },

  fiat: {
    heading: 'VOLUME PER VALUTA',
    caption: 'Volume per valuta nella finestra scelta',
    currency: 'valuta',
    volume: 'volume',
    orders: 'ordini',
    ticketAvg: 'ticket medio',
    p50: 'p50',
    p90: 'p90',
    empty: 'Niente da segnalare in questa finestra.',
  },

  pairs: {
    ordersHeading: 'ORDINI',
    canceled: 'annullati',
    abandonmentRate: 'tasso di abbandono',
    ticketAvg: 'ticket medio',
    largest: 'ordine più grande',
    disputesHeading: 'DISPUTE · DEV FEES',
    disputeRate: 'tasso di disputa',
    resolutionMedian: 'mediana di risoluzione',
    devFees: 'dev fees',
    coverage: 'copertura',
    impliedVolume: 'volume implicito',
    referenceVolume: 'volume in USD',
  },

  notMeasurable: {
    heading: 'OLTRE CIÒ CHE SI PUÒ MISURARE',
    items: [
      {
        title: 'Utenti unici',
        why: 'le chiavi sono effimere per ordine; contare le pubkey conta ordini, non persone.',
      },
      {
        title: 'Di cosa trattava una disputa',
        why: 'l’evento di disputa non nomina l’ordine che l’ha provocata.',
      },
      {
        title: 'Perché un ordine è stato annullato',
        why: 'gli eventi registrano il cambio di stato, mai la causa.',
      },
    ],
  },

  disputes: {
    heading: 'DISPUTE APERTE ORA',
    listLabel: 'Dispute aperte',
    empty: 'Nessuna disputa aperta.',
    asOf: (when) =>
      `Età misurate dall’editore al momento del calcolo dell’istantanea il ${when}, non ora.`,
  },

  absence: {
    noData: 'nessun dato',
    notMeasured: 'non misurato',
    notPublished: 'non pubblicato',
  },

  inferred: {
    mark: 'inf',
    label: 'Cifra inferita',
    labelWith: (error) => `Cifra inferita. ${error}`,
  },

  loading: {
    announcement: (what) => `Caricamento ${what}…`,
    figures: 'delle cifre della rete',
  },

  fatal: {
    heading: 'Nessuna cifra verificata.',
    timeout: 'Nessun relay ha risposto con l’indice dell’editore.',
    unverified: (reason) => `L’indice non ha superato la verifica: ${reason}.`,
    note: 'Questa pagina non mostra cifre che non può provare.',
  },

  footnote: (relays) =>
    `Letto da ${relays} relay e verificato in questo browser con la chiave dell’editore. Un valore assente è reso come assente e mai come zero; una cifra inferita è segnalata come tale.`,
}
