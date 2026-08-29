import { plural, type Strings } from './strings'

/** Français. Traduction de `en.ts`, qui fait foi. */
export const fr: Strings = {
  locale: 'fr',
  name: 'Français',

  document: {
    title: 'bestiario — le réseau Mostro, à découvert',
    description:
      'Statistiques du réseau Mostro, lues d’événements Nostr signés et vérifiées dans votre navigateur.',
  },

  units: { days: 'j', hours: 'h', minutes: 'min', seconds: 's' },

  brand: { tagline: 'OBSERVATOIRE DU RÉSEAU' },

  header: {
    windowNav: 'Fenêtre',
    language: 'Langue',
    windows: { '24h': '24 H', '7d': '7 J', '30d': '30 J', '90d': '90 J', all: 'TOUT' },
    network: 'MAINNET',
    stream: 'STREAM',
    connecting: 'CONNEXION…',
  },

  nav: {
    label: 'Sections',
    overview: 'APERÇU',
    orders: 'ORDRES',
    volume: 'VOLUME',
  },

  filters: {
    legend: 'Filtres',
    fiat: 'Devise',
    instance: 'Instance',
    allFiat: 'Toutes les devises',
    allInstances: 'Tout le réseau',
    unscoped: (name) =>
      `${name} ne publie pas encore de document d'ordres qui lui soit propre : seul ce qu'elle publie sur elle-même est montré ici ; un chiffre que le publicateur ne ventile pas par instance se lit comme une absence et non comme celui du réseau.`,
    unverifiedScoped: (name, reason) =>
      `${name} publie un document d'ordres qui lui est propre, et il n'a pas passé la vérification dans ce navigateur : ${reason}. Rien n'en est montré — seulement ce que le document des instances dit de l'instance.`,
    noInstanceVolume:
      'Le volume est publié pour le réseau et non par instance : ces chiffres ne se restreignent pas à une seule.',
  },

  ordersView: {
    heading: 'Ordres',
    caption:
      "Ce que le réseau a créé dans la fenêtre choisie, et ce qu'il en est advenu.",
    created: 'Créés',
    completed: 'Aboutis',
    canceled: 'Annulés',
    completionRate: "Taux d'aboutissement",
    abandonmentRate: "Taux d'abandon",
    openNow: 'Ouverts en ce moment',
    inProgressNow: 'En cours en ce moment',
    shareHeading: 'Achat et vente',
    buyShare: "Part d'achat",
    sellShare: 'Part de vente',
    shareNote:
      "L'éditeur signe cette répartition comme une part du total, et non comme une ventilation qu'un filtre pourrait découper. Elle se lit donc ici plutôt que de s'offrir en filtre.",
    perCurrency: 'Ordres par devise',
    perCurrencyNote:
      'Comptés dans le document de volume, qui est là où le réseau ventile les ordres par devise.',
    instanceHeading: 'Ce que cette instance publie sur elle-même',
    instanceFee: 'Commission',
    instanceMinOrder: 'Ordre minimum',
    instanceMaxOrder: 'Ordre maximum',
    instanceBond: 'Caution',
    instanceVersion: 'Version',
    instanceFiat: 'Devises déclarées',
    instanceSeen: 'Vue pour la dernière fois',
    instanceFirstSeen: 'Vue pour la première fois',
    instanceSilent: 'Silencieuse depuis',
    instanceProtocol: 'Version du protocole',
    instanceNetworks: 'Réseaux Lightning',
    instanceCreated: 'Ordres créés dans la fenêtre',
    perCurrencyNoInstance:
      "Le document d'ordres de cette instance ne nomme aucune devise pour cette fenêtre.",
    perCurrencyNoDocument:
      "Cette instance ne publie pas de document d'ordres qui lui soit propre : il n'y a donc pas de ventilation par devise à lire pour elle.",
    shareNotPerInstance:
      'Cette répartition est signée pour tout le réseau et non par instance : elle ne se restreint pas à une seule.',
  },

  volumeView: {
    heading: 'Volume',
    caption:
      'Ce que les ordres aboutis ont déplacé : en sats, et dans les devises où ils étaient libellés.',
    total: 'Total',
    completed: 'Ordres aboutis',
    ticketAvg: 'Ticket moyen',
    p50: 'Ticket médian',
    p90: 'Ticket p90',
    largest: 'Ordre le plus grand',
    splitHeading: 'Achat et vente',
    buy: 'Acheté',
    sell: 'Vendu',
    sizesHeading: 'Taille des ordres',
    sizes: {
      lt_10k: 'moins de 10k',
      '10k_50k': '10k – 50k',
      '50k_200k': '50k – 200k',
      '200k_1m': '200k – 1M',
      gt_1m: 'plus de 1M',
    },
    referenceHeading: 'Dans une devise de référence',
    referenceNote:
      "Déduit des cours que l'éditeur détenait alors. Là où aucun n'était assez proche pour valoriser un ordre, c'est une absence et non un chiffre.",
  },

  rail: {
    publisher: 'ÉMETTEUR',
    publisherNote:
      'Chaque chiffre de cette page provient d’un événement signé par cette clé et vérifié dans votre navigateur. Une signature prouve que bestiario les a publiés, pas qu’ils sont justes.',
    relays: 'RELAIS',
    archive: 'ARCHIVE',
    from: 'du',
    until: 'au',
    documents: 'documents',
    archiveNote:
      'L’archive ne peut parler que de cette période. En dehors, il n’y a pas de zéros, il y a l’absence.',
    snapshot: 'INSTANTANÉ',
    age: 'âge',
    version: 'bestiario',
  },

  map: {
    heading: 'MARCHÉS DU RÉSEAU',
    caption:
      'Chaque point est une monnaie avec des ordres dans la fenêtre choisie, dans son pays. Sa taille et le nombre de routes qui en partent sont son volume d’ordres.',
    loadingGeometry: 'CHARGEMENT DE LA GÉOMÉTRIE…',
    noGeometry: (reason) => `PAS DE GÉOMÉTRIE · ${reason}`,
    activeMarkets: 'MARCHÉS ACTIFS',
    illustrativeRoutes:
      'Les routes sont illustratives : elles vont vers des ancrages sans nom, pas vers des mostros. Le démon n’a pas encore publié orders:…:i:<pubkey>, et sans cela rien ne dit quelle instance négocie quelle monnaie. Ce qui est mesuré, c’est la monnaie, son pays et ses ordres.',
    approximateInstances: (approximate, total) =>
      `${approximate} ${plural(total, 'instance sur', 'instances sur')} ${total} ${plural(total, 'ne nomme', 'ne nomment')} aucun pays : leur point est une dispersion et non un emplacement. Les routes sont mesurées : chacune est une monnaie que cette instance a négociée.`,
    describe: {
      empty: 'Aucun flux d’ordres à montrer.',
      flows: (arcs, currencies, instances) =>
        `${arcs} ${plural(arcs, 'flux', 'flux')} d’ordres entre ${currencies} ${plural(currencies, 'monnaie', 'monnaies')} et ${instances} ${plural(instances, 'instance', 'instances')} Mostro`,
      live: (count) => `${count} en cours`,
      settling: (count) =>
        `${count} ${plural(count, 'récemment terminé', 'récemment terminés')}`,
      unplacedCurrencies: (count) =>
        `${count} ${plural(count, 'monnaie non placée', 'monnaies non placées')} sur la carte`,
      unplacedInstances: (count) =>
        `${count} ${plural(count, 'instance non placée', 'instances non placées')} sur la carte`,
    },
  },

  kpi: {
    orders: (window) => `ORDRES TERMINÉS · ${window}`,
    ordersSub: (rate, total) => `${rate} sur un total de ${total} clôturés`,
    volume: (window) => `VOLUME · ${window}`,
    volumeSub: (p50) => `ticket p50 ${p50}`,
    disputes: (window) => `LITIGES · ${window}`,
    disputesSub: (resolved, rate) => `${resolved} résolus · ${rate} des ordres`,
    rightNow: 'EN CE MOMENT',
    rightNowSub: (pending) => `en cours · ${pending} en attente d’être pris`,
  },

  matrix: {
    heading: 'MONNAIE × INSTANCE · ORDRES',
    caption:
      'Ordres créés par chaque instance dans chaque monnaie, dans la fenêtre choisie',
    instance: 'instance',
    cell: (instance, code, orders) => `${instance} · ${code} : ${orders}`,
    none: 'aucun ordre',
    empty: 'Aucune instance n’a publié sa propre ventilation pour cette fenêtre.',
  },

  fiat: {
    heading: 'VOLUME PAR MONNAIE',
    caption: 'Volume par monnaie dans la fenêtre choisie',
    currency: 'monnaie',
    volume: 'volume',
    orders: 'ordres',
    ticketAvg: 'ticket moyen',
    p50: 'p50',
    p90: 'p90',
    sortBy: (column) => `Trier par ${column}`,
    empty: 'Rien à signaler dans cette fenêtre.',
  },

  pairs: {
    ordersHeading: 'ORDRES',
    canceled: 'annulés',
    abandonmentRate: 'taux d’abandon',
    ticketAvg: 'ticket moyen',
    largest: 'ordre le plus important',
    disputesHeading: 'LITIGES · DEV FEES',
    disputeRate: 'taux de litige',
    resolutionMedian: 'médiane de résolution',
    devFees: 'dev fees',
    coverage: 'couverture',
    impliedVolume: 'volume implicite',
    referenceVolume: 'volume en USD',
  },

  notMeasurable: {
    heading: 'AU-DELÀ DE CE QUI PEUT ÊTRE MESURÉ',
    items: [
      {
        title: 'Utilisateurs uniques',
        why: 'les clés sont éphémères par ordre ; compter les pubkeys compte des ordres, pas des personnes.',
      },
      {
        title: 'Le sujet d’un litige',
        why: 'l’événement de litige ne nomme pas l’ordre qui l’a provoqué.',
      },
      {
        title: 'Pourquoi un ordre a été annulé',
        why: 'les événements enregistrent le changement d’état, jamais la cause.',
      },
    ],
  },

  disputes: {
    heading: 'LITIGES OUVERTS MAINTENANT',
    listLabel: 'Litiges ouverts',
    empty: (days) =>
      `Aucun litige n'est ouvert en ce moment, d'après les événements propres aux instances des ${days} derniers jours.`,
    live: (days) =>
      `Litiges que chaque instance a déclarés ouverts ou en cours, d'après ses propres événements signés des ${days} derniers jours. Les âges sont mesurés sur votre horloge.`,
    status: { initiated: 'ouvert', 'in-progress': 'en cours' },
    rowTitle: (id, instance) => `Litige ${id} · instance ${instance}`,
  },

  absence: {
    noData: 'pas de donnée',
    notMeasured: 'non mesuré',
    notPublished: 'non publié',
  },

  inferred: {
    mark: 'inf',
    label: 'Chiffre inféré',
    labelWith: (error) => `Chiffre inféré. ${error}`,
  },

  loading: {
    announcement: (what) => `Chargement ${what}…`,
    figures: 'des chiffres du réseau',
  },

  fatal: {
    heading: 'Aucun chiffre vérifié.',
    timeout: 'Aucun relais n’a répondu avec l’index de l’émetteur.',
    unverified: (reason) => `L’index n’a pas passé la vérification : ${reason}.`,
    note: 'Cette page n’affiche aucun chiffre qu’elle ne peut prouver.',
  },

  footnote: (relays) =>
    `Lu depuis ${relays} ${plural(relays, 'relais', 'relais')} et vérifié dans ce navigateur à l’aide de la clé de l’émetteur. Une valeur absente est dessinée comme absente et jamais comme un zéro ; un chiffre inféré est signalé comme tel.`,
}
