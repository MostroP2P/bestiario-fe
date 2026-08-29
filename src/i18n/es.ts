import type { Strings } from './strings'

/** Español. Traducción de `en.ts`, que es la fuente. */
export const es: Strings = {
  locale: 'es',
  name: 'Español',

  brand: { tagline: 'OBSERVATORIO DE LA RED' },

  header: {
    windowNav: 'Ventana',
    windows: { '24h': '24 H', '7d': '7 D', '30d': '30 D', '90d': '90 D', all: 'TODO' },
    network: 'MAINNET',
    verified: 'VERIFICADO',
    connecting: 'CONECTANDO',
  },

  rail: {
    publisher: 'PUBLICADOR',
    publisherNote:
      'Cada cifra de esta página viene de un evento firmado por esta clave y verificado en tu navegador. Una firma prueba que bestiario las publicó, no que sean correctas.',
    relays: 'RELAYS',
    archive: 'ARCHIVO',
    from: 'desde',
    until: 'hasta',
    documents: 'documentos',
    archiveNote:
      'El archivo solo puede responder por este periodo. Fuera de él no hay ceros, hay ausencia.',
    snapshot: 'INSTANTÁNEA',
    age: 'edad',
    version: 'bestiario',
  },

  map: {
    heading: 'MERCADOS DE LA RED',
    caption:
      'Cada punto es una moneda con órdenes en la ventana elegida, en su país. Su tamaño y cuántas rutas salen de él son su volumen de órdenes.',
    loadingGeometry: 'CARGANDO GEOMETRÍA…',
    noGeometry: (reason) => `SIN GEOMETRÍA · ${reason}`,
    activeMarkets: 'MERCADOS ACTIVOS',
    unplaced: (count) => `${count} sin ubicar, fuera del mapa`,
    illustrativeRoutes:
      'Las rutas son ilustrativas: van a anclajes sin nombre, no a mostros. El daemon todavía no ha publicado orders:…:i:<pubkey>, y sin eso nada dice qué instancia opera qué moneda. Lo medido es la moneda, su país y sus órdenes.',
    approximateInstances: (approximate, total) =>
      `${approximate} de ${total} instancias no nombran un país, así que su punto es una dispersión y no una ubicación. Las rutas están medidas: cada una es una moneda que esa instancia operó.`,
    describe: {
      empty: 'Sin flujo de órdenes que mostrar.',
      flows: (arcs, currencies, instances) =>
        `${arcs} flujos de órdenes entre ${currencies} monedas y ${instances} instancias de Mostro`,
      live: (count) => `${count} órdenes en curso`,
      settling: (count) => `${count} órdenes recién completadas`,
      unplacedCurrencies: (count) => `${count} monedas sin ubicar en el mapa`,
      unplacedInstances: (count) => `${count} instancias sin ubicar en el mapa`,
    },
  },

  kpi: {
    orders: (window) => `ÓRDENES · ${window}`,
    ordersSub: (completed, rate) => `${completed} completadas · ${rate}`,
    volume: (window) => `VOLUMEN · ${window}`,
    volumeSub: (p50) => `ticket p50 ${p50}`,
    disputes: (window) => `DISPUTAS · ${window}`,
    disputesSub: (resolved, rate) => `${resolved} resueltas · ${rate} de las órdenes`,
    rightNow: 'AHORA MISMO',
    rightNowSub: (pending) => `en curso · ${pending} sin tomar`,
  },

  fiat: {
    heading: 'VOLUMEN POR MONEDA',
    caption: 'Volumen por moneda en la ventana elegida',
    currency: 'moneda',
    volume: 'volumen',
    orders: 'órdenes',
    ticketAvg: 'ticket medio',
    p50: 'p50',
    p90: 'p90',
    empty: 'Nada que informar en esta ventana.',
  },

  pairs: {
    ordersHeading: 'ÓRDENES',
    canceled: 'canceladas',
    abandonmentRate: 'tasa de abandono',
    ticketAvg: 'ticket medio',
    largest: 'mayor orden',
    disputesHeading: 'DISPUTAS · DEV FEES',
    disputeRate: 'tasa de disputas',
    resolutionMedian: 'mediana de resolución',
    devFees: 'dev fees',
    coverage: 'cobertura',
    impliedVolume: 'volumen implícito',
    referenceVolume: 'volumen en USD',
  },

  notMeasurable: {
    heading: 'MÁS ALLÁ DE LO QUE SE PUEDE MEDIR',
    items: [
      {
        title: 'Usuarios únicos',
        why: 'las claves son efímeras por orden; contar pubkeys cuenta órdenes, no personas.',
      },
      {
        title: 'De qué trataba una disputa',
        why: 'el evento de disputa no nombra la orden que la provocó.',
      },
      {
        title: 'Por qué se canceló una orden',
        why: 'los eventos registran el cambio de estado, nunca la causa.',
      },
    ],
  },

  disputes: {
    heading: 'DISPUTAS ABIERTAS AHORA',
    listLabel: 'Disputas abiertas',
    empty: 'Ninguna disputa abierta.',
    asOf: 'Edades medidas por el publicador al calcular la instantánea, no ahora.',
  },

  absence: {
    noData: 'sin datos',
    notMeasured: 'no medido',
    notPublished: 'no publicado',
  },

  inferred: {
    mark: 'inf',
    label: 'Cifra inferida',
    labelWith: (error) => `Cifra inferida. ${error}`,
  },

  loading: {
    announcement: (what) => `Cargando ${what}…`,
    figures: 'las cifras de la red',
  },

  fatal: {
    heading: 'Sin cifras verificadas.',
    timeout: 'Ningún relay respondió con el índice del publicador.',
    unverified: (reason) => `El índice no superó la verificación: ${reason}.`,
    note: 'Esta página no muestra cifras que no pueda probar.',
  },

  footnote: (relays) =>
    `Leído de ${relays} relays y verificado en este navegador contra la clave del publicador. Un valor ausente se dibuja ausente y nunca como cero; una cifra inferida se marca como tal.`,
}
