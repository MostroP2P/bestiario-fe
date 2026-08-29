import { plural, type Strings } from './strings'

/** Português. Tradução de `en.ts`, que é a fonte. */
export const pt: Strings = {
  locale: 'pt',
  name: 'Português',

  document: {
    title: 'bestiario — a rede Mostro, à vista',
    description:
      'Estatísticas da rede Mostro, lidas de eventos Nostr assinados e verificadas no seu navegador.',
  },

  units: { days: 'd', hours: 'h', minutes: 'm', seconds: 's' },

  brand: { tagline: 'OBSERVATÓRIO DA REDE' },

  header: {
    windowNav: 'Janela',
    language: 'Idioma',
    windows: { '24h': '24 H', '7d': '7 D', '30d': '30 D', '90d': '90 D', all: 'TUDO' },
    network: 'MAINNET',
    stream: 'STREAM',
    connecting: 'CONECTANDO',
  },

  nav: {
    label: 'Seções',
    overview: 'RESUMO',
    orders: 'ORDENS',
    volume: 'VOLUME',
  },

  filters: {
    legend: 'Filtros',
    fiat: 'Moeda',
    instance: 'Instância',
    allFiat: 'Todas as moedas',
    allInstances: 'Toda a rede',
    unscoped: (name) =>
      `${name} ainda não publica um documento de ordens próprio, portanto o que segue é de toda a rede.`,
    noInstanceVolume:
      'O volume é publicado para a rede e não por instância, portanto estas cifras não se restringem a uma só.',
  },

  ordersView: {
    heading: 'Ordens',
    caption: 'O que a rede criou na janela escolhida, e no que deu.',
    created: 'Criadas',
    completed: 'Concluídas',
    canceled: 'Canceladas',
    completionRate: 'Taxa de conclusão',
    abandonmentRate: 'Taxa de abandono',
    openNow: 'Abertas agora',
    inProgressNow: 'Em curso agora',
    shareHeading: 'Compra e venda',
    buyShare: 'Proporção de compra',
    sellShare: 'Proporção de venda',
    shareNote:
      'O publicador assina esta divisão como proporção do total, não como um detalhamento que um filtro possa cortar. Por isso é lida aqui e não oferecida como filtro.',
    perCurrency: 'Ordens por moeda',
    perCurrencyNote:
      'Contadas no documento de volume, que é onde a rede detalha as ordens por moeda.',
    instanceHeading: 'O que esta instância publica sobre si mesma',
    instanceFee: 'Taxa',
    instanceLimits: 'Limites de ordem',
    instanceBond: 'Caução',
    instanceVersion: 'Versão',
    instanceFiat: 'Moedas declaradas',
    instanceSeen: 'Vista pela última vez',
  },

  volumeView: {
    heading: 'Volume',
    caption:
      'O que as ordens concluídas moveram: em sats e nas moedas em que foram cotadas.',
    total: 'Total',
    completed: 'Ordens concluídas',
    ticketAvg: 'Ticket médio',
    p50: 'Ticket mediano',
    p90: 'Ticket p90',
    largest: 'Maior ordem',
    splitHeading: 'Compra e venda',
    buy: 'Comprado',
    sell: 'Vendido',
    sizesHeading: 'Tamanho das ordens',
    sizes: {
      lt_10k: 'menos de 10k',
      '10k_50k': '10k – 50k',
      '50k_200k': '50k – 200k',
      '200k_1m': '200k – 1M',
      gt_1m: 'mais de 1M',
    },
    referenceHeading: 'Numa moeda de referência',
    referenceNote:
      'Inferido das cotações que o publicador tinha no momento. Onde nenhuma estava perto o bastante para precificar uma ordem, isto é ausência e não uma cifra.',
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
    illustrativeRoutes:
      'As rotas são ilustrativas: vão para âncoras sem nome, não para mostros. O daemon ainda não publicou orders:…:i:<pubkey>, e sem ele nada diz qual instância opera qual moeda. O que é medido é a moeda, o seu país e as suas ordens.',
    approximateInstances: (approximate, total) =>
      `${approximate} de ${total} ${plural(total, 'instância não nomeia', 'instâncias não nomeiam')} um país, então o ponto delas é uma dispersão e não uma localização. As rotas são medidas: cada uma é uma moeda que essa instância operou.`,
    describe: {
      empty: 'Sem fluxo de ordens para mostrar.',
      flows: (arcs, currencies, instances) =>
        `${arcs} ${plural(arcs, 'fluxo', 'fluxos')} de ordens entre ${currencies} ${plural(currencies, 'moeda', 'moedas')} e ${instances} ${plural(instances, 'instância', 'instâncias')} de Mostro`,
      live: (count) => `${count} em andamento`,
      settling: (count) =>
        `${count} ${plural(count, 'recém-concluído', 'recém-concluídos')}`,
      unplacedCurrencies: (count) =>
        `${count} ${plural(count, 'moeda ficou', 'moedas ficaram')} fora do mapa`,
      unplacedInstances: (count) =>
        `${count} ${plural(count, 'instância ficou', 'instâncias ficaram')} fora do mapa`,
    },
  },

  kpi: {
    orders: (window) => `ORDENS CONCLUÍDAS · ${window}`,
    ordersSub: (rate, total) => `${rate} de um total de ${total} encerradas`,
    volume: (window) => `VOLUME · ${window}`,
    volumeSub: (p50) => `ticket p50 ${p50}`,
    disputes: (window) => `DISPUTAS · ${window}`,
    disputesSub: (resolved, rate) => `${resolved} resolvidas · ${rate} das ordens`,
    rightNow: 'AGORA MESMO',
    rightNowSub: (pending) => `em andamento · ${pending} esperando ser tomadas`,
  },

  matrix: {
    heading: 'MOEDA × INSTÂNCIA · ORDENS',
    caption: 'Ordens criadas por cada instância em cada moeda, na janela escolhida',
    instance: 'instância',
    cell: (instance, code, orders) => `${instance} · ${code}: ${orders}`,
    none: 'sem ordens',
    empty: 'Nenhuma instância publicou o seu próprio detalhamento para esta janela.',
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
    sortBy: (column) => `Ordenar por ${column}`,
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
    empty: (days) =>
      `Nenhuma disputa está aberta agora, pelos eventos das próprias instâncias dos últimos ${days} dias.`,
    live: (days) =>
      `Disputas que cada instância declarou iniciadas ou em andamento, pelos seus próprios eventos assinados dos últimos ${days} dias. As idades são medidas pelo relógio deste navegador.`,
    status: { initiated: 'iniciada', 'in-progress': 'em andamento' },
    rowTitle: (id, instance) => `Disputa ${id} · instância ${instance}`,
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
    `Lido de ${relays} ${plural(relays, 'relay', 'relays')} e verificado neste navegador com a chave do publicador. Um valor ausente é desenhado como ausente e nunca como zero; um número inferido é marcado como tal.`,
}
