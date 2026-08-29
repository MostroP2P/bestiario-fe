import { plural, type Strings } from './strings'

/** Español. Traducción de `en.ts`, que es la fuente. */
export const es: Strings = {
  locale: 'es',
  name: 'Español',

  document: {
    title: 'bestiario — la red Mostro, a la vista',
    description:
      'Estadísticas de la red Mostro de intercambio de bitcoin entre pares, leídas de eventos Nostr firmados y verificadas en tu navegador.',
  },

  units: { days: 'd', hours: 'h', minutes: 'm', seconds: 's' },

  brand: { tagline: 'OBSERVATORIO DE LA RED' },

  header: {
    windowNav: 'Ventana',
    language: 'Idioma',
    windows: { '24h': '24 H', '7d': '7 D', '30d': '30 D', '90d': '90 D', all: 'TODO' },
    network: 'MAINNET',
    stream: 'STREAM',
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
      `${name} todavía no publica un documento de órdenes propio, así que aquí solo se muestra lo que publica sobre sí misma; una cifra que el publicador no desglosa por instancia se lee como ausencia y no como la de la red.`,
    unverifiedScoped: (name, reason) =>
      `${name} publica un documento de órdenes propio, y no superó la verificación en este navegador: ${reason}. No se muestra nada de él: solo lo que el documento de instancias dice sobre la instancia.`,
    noInstanceVolume:
      'Por instancia solo se publica el volumen total en sats, en el documento de comparación. Los importes por moneda, los tamaños de ticket, el reparto compra/venta y la conversión de referencia se firman para toda la red, así que se leen como ausencia mientras haya una instancia elegida.',
    noCompareRow: (name) =>
      `El documento de comparación de esta ventana no nombra ningún bloque para ${name}, así que no hay volumen propio que mostrar — y eso es ausencia, no un cero.`,
    unverifiedCompare: (reason) =>
      `El documento de comparación de esta ventana no superó la verificación en este navegador: ${reason}. No se lee de él nada por instancia.`,
    noFiatBreakdown:
      'Las cifras de arriba son las de la moneda: lo que movió, las órdenes que lo movieron y sus tickets, tal como el publicador los firma en esa moneda. Los tramos de tamaño, el reparto compra/venta y la conversión de referencia se firman para todas las monedas a la vez, así que se leen como ausencia mientras haya una elegida.',
    fiatUnavailable: (code) =>
      `El archivo no publica nada en ${code} para esta ventana, así que las cifras de arriba son ausencia y no las de la red. Otra ventana, o toda la red, puede tenerlo.`,
    instanceAndFiat:
      'Para una instancia en una moneda el publicador firma conteos y tasas, y ningún importe: los importes se firman para la red, y por instancia solo como un total de todas las monedas.',
    unverifiedOrders: (reason) =>
      `El documento de órdenes de toda la red para esta ventana no superó la verificación en este navegador: ${reason}. No se lee nada de él, así que la cuota de ese mercado no se calcula — y eso es una prueba fallida, no una cifra que nadie publicó.`,
    noFiatOrders:
      'Por moneda el archivo cuenta las órdenes que se completaron, y solo esas: creadas, canceladas, en curso y el reparto compra/venta se firman para todas las monedas a la vez, así que se leen como ausencia mientras haya una elegida.',
    instanceAndFiatOrders:
      'Lo que sigue es lo que esta instancia contó en esta moneda, en su propio documento de órdenes. Sus demás cifras se firman sobre todas las monedas que opera, no sobre una.',
  },

  overviewView: {
    heading: 'La red Mostro, a la vista',
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
      'Contadas en el documento de órdenes de esta ventana, que es donde la red desglosa sus órdenes por moneda.',
    instanceHeading: 'Lo que esta instancia publica sobre sí misma',
    instanceFee: 'Comisión',
    instanceMinOrder: 'Orden mínima',
    instanceMaxOrder: 'Orden máxima',
    instanceBond: 'Fianza',
    instanceVersion: 'Versión',
    instanceFiat: 'Monedas declaradas',
    instanceSeen: 'Vista por última vez',
    instanceFirstSeen: 'Vista por primera vez',
    instanceSilent: 'En silencio desde hace',
    instanceProtocol: 'Versión del protocolo',
    instanceNetworks: 'Redes Lightning',
    instanceCreated: 'Órdenes creadas en la ventana',
    perCurrencyNoInstance:
      'El documento de órdenes de esta instancia no nombra ninguna moneda para esta ventana.',
    perCurrencyNoDocument:
      'Esta instancia no publica un documento de órdenes propio, así que no hay desglose por moneda que leer para ella.',
    shareNotPerInstance:
      'Este reparto se firma para toda la red — no por instancia ni por moneda — así que no se acota a ninguna de las dos.',
    shareOfCompleted: 'Proporción de las completadas',
    shareOfCompletedSub: 'De lo que completó la red en esta ventana',
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
    shareOfNetwork: 'Proporción del volumen de la red',
    shareOfNetworkSub: 'De lo que movió toda la red en esta ventana',
    devFees: 'Comisiones enviadas al desarrollo',
    instanceCurrencies: 'Monedas que operó esta instancia',
    instanceCurrenciesNote:
      'Contadas en el documento de órdenes de la propia instancia: cuántas órdenes completó en cada moneda. Los importes se publican para la red y no por instancia.',
    instanceCurrenciesEmpty:
      'Esta instancia no publica desglose por moneda para esta ventana.',
    created: 'Órdenes creadas',
    completionRate: 'Tasa de completado',
    shareOfMarket: 'Proporción de ese mercado',
    shareOfMarketSub: (code) => `De lo que la red completó en ${code} en esta ventana`,
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
    heading: 'MONEDA × INSTANCIA · ÓRDENES COMPLETADAS',
    caption:
      'Órdenes completadas por cada instancia en cada moneda, en la ventana elegida',
    instance: 'instancia',
    cell: (instance, code, orders) => `${instance} · ${code}: ${orders}`,
    none: 'sin órdenes completadas',
    empty:
      'Ninguna instancia publicó órdenes completadas en ninguna moneda para esta ventana.',
  },

  fiat: {
    heading: 'VOLUMEN POR MONEDA',
    caption: 'Volumen por moneda en la ventana elegida',
    currency: 'moneda',
    volume: 'volumen',
    sats: 'sats',
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
