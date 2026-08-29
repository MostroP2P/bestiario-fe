import { plural, type Strings } from './strings'

/** Español. Traducción de `en.ts`, que es la fuente. */
export const es: Strings = {
  locale: 'es',
  name: 'Español',

  document: {
    title: 'bestiario — la red Mostro, a la vista',
    description:
      'Estadísticas de la red Mostro, leídas de eventos Nostr firmados y verificadas en tu navegador.',
  },

  units: { days: 'd', hours: 'h', minutes: 'm', seconds: 's' },

  brand: { tagline: 'OBSERVATORIO DE LA RED' },

  header: {
    windowNav: 'Ventana',
    language: 'Idioma',
    windows: { '24h': '24 H', '7d': '7 D', '30d': '30 D', '90d': '90 D', all: 'TODO' },
    network: 'MAINNET',
    verified: 'VERIFICADO',
    connecting: 'CONECTANDO',
  },

  nav: {
    label: 'Secciones',
    overview: 'RESUMEN',
    orders: 'ÓRDENES',
    volume: 'VOLUMEN',
  },

  filters: {
    legend: 'Filtros',
    fiat: 'Moneda',
    instance: 'Instancia',
    allFiat: 'Todas las monedas',
    allInstances: 'Toda la red',
    unscoped: (name) =>
      `${name} todavía no publica un documento de órdenes propio, así que lo que sigue es de toda la red.`,
    noInstanceVolume:
      'El volumen se publica para la red y no por instancia, así que estas cifras no se acotan a una sola.',
  },

  ordersView: {
    heading: 'Órdenes',
    caption: 'Lo que la red creó en la ventana elegida, y en qué terminó.',
    created: 'Creadas',
    completed: 'Completadas',
    canceled: 'Canceladas',
    completionRate: 'Tasa de completado',
    abandonmentRate: 'Tasa de abandono',
    openNow: 'Abiertas ahora mismo',
    inProgressNow: 'En curso ahora mismo',
    shareHeading: 'Compra y venta',
    buyShare: 'Proporción de compra',
    sellShare: 'Proporción de venta',
    shareNote:
      'El publicador firma este reparto como proporción del total, no como un desglose que un filtro pueda cortar. Por eso se lee aquí y no se ofrece como filtro.',
    perCurrency: 'Órdenes por moneda',
    perCurrencyNote:
      'Contadas en el documento de volumen, que es donde la red desglosa las órdenes por moneda.',
    instanceHeading: 'Lo que esta instancia publica sobre sí misma',
    instanceFee: 'Comisión',
    instanceLimits: 'Límites de orden',
    instanceBond: 'Fianza',
    instanceVersion: 'Versión',
    instanceFiat: 'Monedas declaradas',
    instanceSeen: 'Vista por última vez',
  },

  volumeView: {
    heading: 'Volumen',
    caption:
      'Lo que movieron las órdenes completadas: en sats y en las monedas en que se cotizaron.',
    total: 'Total',
    completed: 'Órdenes completadas',
    ticketAvg: 'Ticket medio',
    p50: 'Ticket mediano',
    p90: 'Ticket p90',
    largest: 'Orden más grande',
    splitHeading: 'Compra y venta',
    buy: 'Comprado',
    sell: 'Vendido',
    sizesHeading: 'Tamaño de las órdenes',
    sizes: {
      lt_10k: 'menos de 10k',
      '10k_50k': '10k – 50k',
      '50k_200k': '50k – 200k',
      '200k_1m': '200k – 1M',
      gt_1m: 'más de 1M',
    },
    referenceHeading: 'En una moneda de referencia',
    referenceNote:
      'Inferido de las cotizaciones que el publicador tenía en ese momento. Donde ninguna estaba lo bastante cerca para valorar una orden, esto es ausencia y no una cifra.',
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
    illustrativeRoutes:
      'Las rutas son ilustrativas: van a anclajes sin nombre, no a mostros. El daemon todavía no ha publicado orders:…:i:<pubkey>, y sin eso nada dice qué instancia opera qué moneda. Lo medido es la moneda, su país y sus órdenes.',
    approximateInstances: (approximate, total) =>
      `${approximate} de ${total} ${plural(total, 'instancia no nombra', 'instancias no nombran')} un país, así que su punto es una dispersión y no una ubicación. Las rutas están medidas: cada una es una moneda que esa instancia operó.`,
    describe: {
      empty: 'Sin flujo de órdenes que mostrar.',
      flows: (arcs, currencies, instances) =>
        `${arcs} ${plural(arcs, 'flujo', 'flujos')} de órdenes entre ${currencies} ${plural(currencies, 'moneda', 'monedas')} y ${instances} ${plural(instances, 'instancia', 'instancias')} de Mostro`,
      live: (count) => `${count} ${plural(count, 'orden en curso', 'órdenes en curso')}`,
      settling: (count) =>
        `${count} ${plural(count, 'orden recién completada', 'órdenes recién completadas')}`,
      unplacedCurrencies: (count) =>
        `${count} ${plural(count, 'moneda sin ubicar', 'monedas sin ubicar')} en el mapa`,
      unplacedInstances: (count) =>
        `${count} ${plural(count, 'instancia sin ubicar', 'instancias sin ubicar')} en el mapa`,
    },
  },

  kpi: {
    orders: (window) => `ÓRDENES COMPLETADAS · ${window}`,
    ordersSub: (rate, total) => `${rate} de un total de ${total} resueltas`,
    volume: (window) => `VOLUMEN · ${window}`,
    volumeSub: (p50) => `ticket p50 ${p50}`,
    disputes: (window) => `DISPUTAS · ${window}`,
    disputesSub: (resolved, rate) => `${resolved} resueltas · ${rate} de las órdenes`,
    rightNow: 'AHORA MISMO',
    rightNowSub: (pending) => `en curso · ${pending} sin tomar`,
  },

  matrix: {
    heading: 'MONEDA × INSTANCIA · ÓRDENES',
    caption: 'Órdenes creadas por cada instancia en cada moneda, en la ventana elegida',
    instance: 'instancia',
    cell: (instance, code, orders) => `${instance} · ${code}: ${orders}`,
    none: 'sin órdenes',
    empty: 'Ninguna instancia publicó su propio desglose para esta ventana.',
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
    sortBy: (column) => `Ordenar por ${column}`,
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
    empty: (days) =>
      `Ninguna disputa está abierta ahora, según los eventos propios de las instancias de los últimos ${days} días.`,
    live: (days) =>
      `Disputas que cada instancia declaró iniciadas o en curso, según sus propios eventos firmados de los últimos ${days} días. Las edades se miden con tu reloj.`,
    status: { initiated: 'iniciada', 'in-progress': 'en curso' },
    rowTitle: (id, instance) => `Disputa ${id} · instancia ${instance}`,
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
    `Leído de ${relays} ${plural(relays, 'relay', 'relays')} y verificado en este navegador contra la clave del publicador. Un valor ausente se dibuja ausente y nunca como cero; una cifra inferida se marca como tal.`,
}
