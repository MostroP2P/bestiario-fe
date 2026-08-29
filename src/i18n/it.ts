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
    language: 'Lingua',
    windows: { '24h': '24 H', '7d': '7 G', '30d': '30 G', '90d': '90 G', all: 'TUTTO' },
    network: 'MAINNET',
    stream: 'STREAM',
    connecting: 'IN CONNESSIONE',
  },

  nav: {
    label: 'Sezioni',
    overview: 'RIEPILOGO',
    orders: 'ORDINI',
    volume: 'VOLUME',
  },

  filters: {
    legend: 'Filtri',
    fiat: 'Valuta',
    instance: 'Istanza',
    allFiat: 'Tutte le valute',
    allInstances: 'Tutta la rete',
    unscoped: (name) =>
      `${name} non pubblica ancora un documento di ordini proprio, quindi qui si mostra soltanto ciò che pubblica su di sé; una cifra che il pubblicatore non scompone per istanza si legge come assenza e non come quella della rete.`,
    unverifiedScoped: (name, reason) =>
      `${name} pubblica un documento di ordini proprio, e non ha superato la verifica in questo browser: ${reason}. Non se ne mostra nulla: soltanto ciò che il documento delle istanze dice dell'istanza.`,
    noInstanceVolume:
      'Per istanza si pubblica soltanto il volume totale in sats, nel documento di confronto. Gli importi per valuta, le dimensioni del ticket, la ripartizione acquisto/vendita e la conversione di riferimento sono firmati per tutta la rete, quindi si leggono come assenza finché è scelta un’istanza.',
    noCompareRow: (name) =>
      `Il documento di confronto di questa finestra non nomina alcun blocco per ${name}, quindi non c’è un volume proprio da mostrare — ed è assenza, non uno zero.`,
    unverifiedCompare: (reason) =>
      `Il documento di confronto di questa finestra non ha superato la verifica in questo browser: ${reason}. Non se ne legge nulla per istanza.`,
    noFiatBreakdown:
      "Le cifre in testa sono quelle della valuta: quanto ha mosso, gli ordini che l'hanno mossa e i suoi ticket, come il pubblicatore li firma in quella valuta. Le fasce di dimensione, la ripartizione acquisto/vendita e la conversione di riferimento sono firmate per tutte le valute insieme, quindi si leggono come assenza finché ne è scelta una.",
    fiatUnavailable: (code) =>
      `L'archivio non pubblica nulla in ${code} per questa finestra, quindi le cifre qui sopra sono assenza e non quelle della rete. Un'altra finestra, o tutta la rete, può averlo.`,
    instanceAndFiat:
      "Per un'istanza in una valuta il pubblicatore firma un conteggio di ordini e nulla più: gli importi sono firmati per la rete, e per istanza soltanto come totale su tutte le valute.",
    noFiatOrders:
      "Per valuta l'archivio conta gli ordini che si sono completati, e soltanto quelli: creati, annullati, in corso e la ripartizione acquisto/vendita sono firmati per tutte le valute insieme, quindi si leggono come assenza finché ne è scelta una.",
    instanceAndFiatOrders:
      'Quanto segue è ciò che questa istanza ha contato in questa valuta, nel suo documento di ordini. Le altre sue cifre sono firmate su tutte le valute che tratta, non su una.',
  },

  ordersView: {
    heading: 'Ordini',
    caption: 'Ciò che la rete ha creato nella finestra scelta, e come è andata a finire.',
    created: 'Creati',
    completed: 'Completati',
    canceled: 'Annullati',
    completionRate: 'Tasso di completamento',
    abandonmentRate: 'Tasso di abbandono',
    openNow: 'Aperti in questo momento',
    inProgressNow: 'In corso in questo momento',
    shareHeading: 'Acquisto e vendita',
    buyShare: 'Quota di acquisto',
    sellShare: 'Quota di vendita',
    shareNote:
      "L'editore firma questa ripartizione come quota del totale, non come un dettaglio che un filtro possa tagliare. Perciò si legge qui e non viene offerta come filtro.",
    perCurrency: 'Ordini per valuta',
    perCurrencyNote:
      'Contati nel documento di volume, che è dove la rete distingue gli ordini per valuta.',
    instanceHeading: 'Ciò che questa istanza pubblica su di sé',
    instanceFee: 'Commissione',
    instanceMinOrder: 'Ordine minimo',
    instanceMaxOrder: 'Ordine massimo',
    instanceBond: 'Cauzione',
    instanceVersion: 'Versione',
    instanceFiat: 'Valute dichiarate',
    instanceSeen: "Vista l'ultima volta",
    instanceFirstSeen: 'Vista la prima volta',
    instanceSilent: 'In silenzio da',
    instanceProtocol: 'Versione del protocollo',
    instanceNetworks: 'Reti Lightning',
    instanceCreated: 'Ordini creati nella finestra',
    perCurrencyNoInstance:
      'Il documento di ordini di questa istanza non nomina alcuna valuta per questa finestra.',
    perCurrencyNoDocument:
      'Questa istanza non pubblica un documento di ordini proprio, quindi non c’è alcuna scomposizione per valuta da leggere per essa.',
    shareNotPerInstance:
      'Questa ripartizione è firmata per tutta la rete — non per istanza né per valuta — quindi non si restringe a nessuna delle due.',
    shareOfCompleted: 'Quota degli ordini completati',
    shareOfCompletedSub: 'Di quanto ha completato la rete in questa finestra',
  },

  volumeView: {
    heading: 'Volume',
    caption:
      'Quanto hanno mosso gli ordini completati: in sat e nelle valute in cui erano quotati.',
    total: 'Totale',
    completed: 'Ordini completati',
    ticketAvg: 'Ticket medio',
    p50: 'Ticket mediano',
    p90: 'Ticket p90',
    largest: 'Ordine più grande',
    splitHeading: 'Acquisto e vendita',
    buy: 'Acquistato',
    sell: 'Venduto',
    sizesHeading: 'Dimensione degli ordini',
    sizes: {
      lt_10k: 'meno di 10k',
      '10k_50k': '10k – 50k',
      '50k_200k': '50k – 200k',
      '200k_1m': '200k – 1M',
      gt_1m: 'più di 1M',
    },
    referenceHeading: 'In una valuta di riferimento',
    referenceNote:
      "Dedotto dalle quotazioni che l'editore aveva in quel momento. Dove nessuna era abbastanza vicina per valorizzare un ordine, questa è assenza e non una cifra.",
    shareOfNetwork: 'Quota del volume della rete',
    shareOfNetworkSub: 'Di quanto ha mosso tutta la rete in questa finestra',
    devFees: 'Commissioni inviate allo sviluppo',
    instanceCurrencies: 'Valute trattate da questa istanza',
    instanceCurrenciesNote:
      "Contate nel documento di ordini dell'istanza stessa: quanti ordini ha completato in ciascuna valuta. Gli importi sono pubblicati per la rete e non per istanza.",
    instanceCurrenciesEmpty:
      'Questa istanza non pubblica alcuna scomposizione per valuta per questa finestra.',
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
    orders: (window) => `ORDINI COMPLETATI · ${window}`,
    ordersSub: (rate, total) => `${rate} su un totale di ${total} chiuse`,
    volume: (window) => `VOLUME · ${window}`,
    volumeSub: (p50) => `ticket p50 ${p50}`,
    disputes: (window) => `DISPUTE · ${window}`,
    disputesSub: (resolved, rate) => `${resolved} risolte · ${rate} degli ordini`,
    rightNow: 'IN QUESTO MOMENTO',
    rightNowSub: (pending) => `in corso · ${pending} in attesa di essere presi`,
  },

  matrix: {
    heading: 'VALUTA × ISTANZA · ORDINI',
    caption: 'Ordini creati da ogni istanza in ogni valuta, nella finestra scelta',
    instance: 'istanza',
    cell: (instance, code, orders) => `${instance} · ${code}: ${orders}`,
    none: 'nessun ordine',
    empty: 'Nessuna istanza ha pubblicato la propria ripartizione per questa finestra.',
  },

  fiat: {
    heading: 'VOLUME PER VALUTA',
    caption: 'Volume per valuta nella finestra scelta',
    currency: 'valuta',
    volume: 'volume',
    sats: 'sats',
    orders: 'ordini',
    ticketAvg: 'ticket medio',
    p50: 'p50',
    p90: 'p90',
    sortBy: (column) => `Ordina per ${column}`,
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
    empty: (days) =>
      `Nessuna disputa è aperta ora, secondo gli eventi delle istanze stesse degli ultimi ${days} giorni.`,
    live: (days) =>
      `Dispute che ogni istanza ha dichiarato avviate o in corso, dai suoi eventi firmati degli ultimi ${days} giorni. Le età sono misurate sul tuo orologio.`,
    status: { initiated: 'avviata', 'in-progress': 'in corso' },
    rowTitle: (id, instance) => `Disputa ${id} · istanza ${instance}`,
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
