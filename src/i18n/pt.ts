import type { Strings } from './strings'

/** Português. Tradução de `en.ts`, que é a fonte. */
export const pt: Strings = {
  locale: 'pt',
  name: 'Português',

  brand: { tagline: 'OBSERVATÓRIO DA REDE' },

  header: {
    windowNav: 'Janela',
    windows: { '24h': '24 H', '7d': '7 D', '30d': '30 D', '90d': '90 D', all: 'TUDO' },
    network: 'MAINNET',
    verified: 'VERIFICADO',
    connecting: 'CONECTANDO',
  },

  rail: {
    publisher: 'PUBLICADOR',
    publisherNote:
      'Cada número desta página vem de um evento assinado por esta chave e verificado no seu navegador. A assinatura prova que o bestiario publicou esses números, não que eles estejam certos.',
    relays: 'RELAYS',
    archive: 'ARQUIVO',
    from: 'de',
    until: 'até',
    documents: 'documentos',
    archiveNote:
      'O arquivo só responde por este período. Fora dele não há zeros, há ausência.',
    snapshot: 'INSTANTÂNEO',
    age: 'idade',
    version: 'bestiario',
  },

  map: {
    heading: 'MERCADOS DA REDE',
    caption:
      'Cada ponto é uma moeda com ordens na janela escolhida, no país dela. O tamanho do ponto e quantas rotas saem dele são o volume de ordens dessa moeda.',
    loadingGeometry: 'CARREGANDO GEOMETRIA…',
    noGeometry: (reason) => `SEM GEOMETRIA · ${reason}`,
    activeMarkets: 'MERCADOS ATIVOS',
    unplaced: (count) => `${count} não localizadas, fora do mapa`,
    illustrativeRoutes:
      'As rotas são ilustrativas: vão para âncoras sem nome, não para mostros. O daemon ainda não publicou orders:…:i:<pubkey>, e sem ele nada diz qual instância opera qual moeda. O que é medido é a moeda, o seu país e as suas ordens.',
    approximateInstances: (approximate, total) =>
      `${approximate} de ${total} instâncias não nomeiam um país, então o ponto delas é uma dispersão e não uma localização. As rotas são medidas: cada uma é uma moeda que essa instância operou.`,
    describe: {
      empty: 'Sem fluxo de ordens para mostrar.',
      flows: (arcs, currencies, instances) =>
        `${arcs} fluxos de ordens entre ${currencies} moedas e ${instances} instâncias de Mostro`,
      live: (count) => `${count} em andamento`,
      settling: (count) => `${count} recém-concluídos`,
      unplacedCurrencies: (count) => `${count} moedas ficaram fora do mapa`,
      unplacedInstances: (count) => `${count} instâncias ficaram fora do mapa`,
    },
  },

  kpi: {
    orders: (window) => `ORDENS · ${window}`,
    ordersSub: (completed, rate) => `${completed} concluídas · ${rate}`,
    volume: (window) => `VOLUME · ${window}`,
    volumeSub: (p50) => `ticket p50 ${p50}`,
    disputes: (window) => `DISPUTAS · ${window}`,
    disputesSub: (resolved, rate) => `${resolved} resolvidas · ${rate} das ordens`,
    rightNow: 'AGORA MESMO',
    rightNowSub: (pending) => `em andamento · ${pending} esperando ser tomadas`,
  },

  fiat: {
    heading: 'VOLUME POR MOEDA',
    caption: 'Volume por moeda na janela escolhida',
    currency: 'moeda',
    volume: 'volume',
    orders: 'ordens',
    ticketAvg: 'ticket médio',
    p50: 'p50',
    p90: 'p90',
    empty: 'Nada a informar nesta janela.',
  },

  pairs: {
    ordersHeading: 'ORDENS',
    canceled: 'canceladas',
    abandonmentRate: 'taxa de abandono',
    ticketAvg: 'ticket médio',
    largest: 'maior ordem',
    disputesHeading: 'DISPUTAS · DEV FEES',
    disputeRate: 'taxa de disputa',
    resolutionMedian: 'mediana de resolução',
    devFees: 'dev fees',
    coverage: 'cobertura',
    impliedVolume: 'volume implícito',
    referenceVolume: 'volume em USD',
  },

  notMeasurable: {
    heading: 'ALÉM DO QUE SE PODE MEDIR',
    items: [
      {
        title: 'Usuários únicos',
        why: 'as chaves são efêmeras por ordem; contar pubkeys conta ordens, não pessoas.',
      },
      {
        title: 'O assunto de uma disputa',
        why: 'o evento de disputa não nomeia a ordem que a provocou.',
      },
      {
        title: 'Por que uma ordem foi cancelada',
        why: 'os eventos registram a mudança de estado, nunca a causa.',
      },
    ],
  },

  disputes: {
    heading: 'DISPUTAS ABERTAS AGORA',
    listLabel: 'Disputas abertas',
    empty: 'Nenhuma disputa aberta.',
    asOf: 'Idades medidas pelo publicador ao calcular o instantâneo, não agora.',
  },

  absence: {
    noData: 'sem dados',
    notMeasured: 'não medido',
    notPublished: 'não publicado',
  },

  inferred: {
    mark: 'inf',
    label: 'Número inferido',
    labelWith: (error) => `Número inferido. ${error}`,
  },

  loading: {
    announcement: (what) => `Carregando ${what}…`,
    figures: 'os números da rede',
  },

  fatal: {
    heading: 'Sem números verificados.',
    timeout: 'Nenhum relay respondeu com o índice do publicador.',
    unverified: (reason) => `O índice não pôde ser verificado: ${reason}.`,
    note: 'Esta página não mostra números que não possa provar.',
  },

  footnote: (relays) =>
    `Lido de ${relays} relays e verificado neste navegador com a chave do publicador. Um valor ausente é desenhado como ausente e nunca como zero; um número inferido é marcado como tal.`,
}
