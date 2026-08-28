/**
 * Sample data, for development only.
 *
 * SPEC 2 says the site never invents a number, so none of this may reach a
 * production build: `src/app.tsx` only reaches for it under `import.meta.env
 * .DEV`, and the panel that shows it is labelled as sample throughout. It
 * exists so the design can be worked on before the relay layer lands, and it
 * goes away when the store of SPEC 7 replaces it.
 *
 * The figures are the ones from artboard 2a of the design, unchanged.
 */
import type { LiveOrder } from '~/model/live-lines'
import type { InstanceRef } from '~/map/placements'

export const SAMPLE_INSTANCES: readonly (InstanceRef & {
  npub: string
  orders: string
  vol: string
  version: string
  up: string
  spark: readonly number[]
})[] = [
  { pubkey: 'k1', name: 'mostro.network', npub: 'npub1dbn…8h2q', orders: '7 918', vol: '3,02 BTC', version: '0.14.2', up: '99,4 %', spark: [30, 55, 42, 70, 48, 88, 62, 74, 51, 96] },
  { pubkey: 'k2', name: 'p2p.lat', npub: 'npub1qk4…m7v0', orders: '4 106', vol: '1,71 BTC', version: '0.14.2', up: '98,1 %', spark: [23, 48, 35, 63, 41, 81, 55, 67, 44, 89] },
  { pubkey: 'k3', name: 'satoshi.br', npub: 'npub19zt…c3xa', orders: '3 240', vol: '1,18 BTC', version: '0.13.9', up: '97,6 %', spark: [16, 41, 28, 56, 34, 74, 48, 60, 37, 82] },
  { pubkey: 'k4', name: 'nodo.mx', npub: 'npub1f7s…p4ke', orders: '2 087', vol: '0,64 BTC', version: '0.14.0', up: '94,2 %', spark: [12, 34, 21, 49, 27, 67, 41, 53, 30, 75] },
  { pubkey: 'k5', name: 'andes.pe', npub: 'npub1t0w…9rj5', orders: '1 051', vol: '0,26 BTC', version: '0.13.9', up: '81,0 %', spark: [12, 27, 14, 42, 20, 60, 34, 46, 23, 68] },
]

/** Share of order flow per currency, from the design's own distribution. */
const CURRENCY_WEIGHTS: readonly (readonly [string, number])[] = [
  ['VES', 34],
  ['COP', 21],
  ['ARS', 14],
  ['BRL', 9],
  ['MXN', 7],
  ['PEN', 5],
  ['USD', 4],
]

const STATUSES = ['pending', 'in-progress', 'waiting-payment', 'success', 'success'] as const

/**
 * Orders shaped like the network's: mostly live, some just completed and
 * inside their grace period, spread across currencies by the design's weights.
 */
export function sampleOrders(now: number): LiveOrder[] {
  const orders: LiveOrder[] = []
  let n = 0
  CURRENCY_WEIGHTS.forEach(([fiat, weight], c) => {
    const count = Math.max(1, Math.round(weight / 4))
    for (let i = 0; i < count; i++) {
      const status = STATUSES[(c + i) % STATUSES.length]!
      const instance = SAMPLE_INSTANCES[(c + i) % SAMPLE_INSTANCES.length]!
      orders.push({
        id: `sample-${n++}`,
        fiat,
        status,
        instancePubkey: instance.pubkey,
        // Settled orders land across the grace window so some are ageing out.
        updatedAt: now - (status === 'success' ? ((i * 137) % 11) * 60_000 : i * 1_000),
      })
    }
  })
  return orders
}

export const SAMPLE_KPIS = [
  { label: 'ÓRDENES · 30 D', value: '18 402', sub: '9 214 completadas · 51,2 % (—/pend. 143)' },
  { label: 'VOLUMEN LIQUIDADO', value: '6,81 BTC', sub: '≈ USD 742 K (inf) · error ±3,1 %' },
  { label: 'DISPUTAS ABIERTAS', value: '22', sub: '118 abiertas · 96 resueltas' },
  { label: 'MOSTROS ACTIVOS', value: '5', sub: '4 relays · 1 482 093 eventos' },
] as const

export const SAMPLE_RELAYS = [
  { url: 'relay.mostro.network', ms: '42 ms', state: 'ok' },
  { url: 'relay.damus.io', ms: '118 ms', state: 'ok' },
  { url: 'nos.lol', ms: '204 ms', state: 'slow' },
  { url: 'relay.nostr.band', ms: 'timeout', state: 'down' },
] as const

export const SAMPLE_TIMINGS = [
  { label: 'orden → tomada', value: '8 m 12 s' },
  { label: 'p90 orden → tomada', value: '41 m' },
  { label: 'hold invoice pagada', value: '3 m 04 s' },
  { label: 'tomada → completada', value: '22 m 37 s' },
] as const

export const SAMPLE_FEES_DISPUTES = [
  { label: 'dev fees acumuladas', value: '1 240 918 sats', inferred: true },
  { label: 'pct asumido', value: '0,60 %', inferred: false },
  { label: 'tasa de disputa', value: '1,28 %', inferred: false },
  { label: 'mediana de resolución', value: '4 h 12 m', inferred: false },
] as const

export const NOT_MEASURABLE = [
  { title: 'Usuarios únicos', why: 'las claves son efímeras por orden; contar pubkeys cuenta órdenes, no personas.' },
  { title: 'Origen de una disputa', why: 'el evento de disputa no referencia la orden que la provocó.' },
  { title: 'Motivo de cancelación', why: 'los eventos registran el cambio de estado, nunca la causa.' },
] as const

export const SAMPLE_FEED = [
  { t: '14:07:02', kind: '38383', text: 'nueva orden SELL BTC/VES · 4 800,00 · mostro.network', tone: 'accent' },
  { t: '14:06:54', kind: '38383', text: 'orden a91f…4c2 → in-progress', tone: 'muted' },
  { t: '14:06:31', kind: '38383', text: 'orden 7d10…9ab → success · 612 400 sats', tone: 'success' },
  { t: '14:06:12', kind: '38000', text: 'dev fee registrada · 4 812 sats (inf)', tone: 'inferred' },
  { t: '14:05:47', kind: '38383', text: 'nueva orden BUY BTC/COP · 480 000 · p2p.lat', tone: 'accent' },
  { t: '14:05:20', kind: '38001', text: 'disputa abierta · andes.pe · sin orden vinculada', tone: 'danger' },
  { t: '14:04:58', kind: '38383', text: 'orden 31bc…7f0 → canceled', tone: 'muted' },
  { t: '14:04:33', kind: '10002', text: 'config actualizada · nodo.mx · v0.14.0', tone: 'warn' },
  { t: '14:04:09', kind: '38383', text: 'orden c5e2…118 → waiting-buyer-invoice', tone: 'muted' },
  { t: '14:03:41', kind: '38383', text: 'nueva orden SELL BTC/BRL · 1 250,00 · satoshi.br', tone: 'accent' },
] as const

export const SAMPLE_CURRENCIES = CURRENCY_WEIGHTS.map(([code, pct]) => ({ code, pct }))
