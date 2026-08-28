/**
 * The map's colours, from artboard 2a of the design.
 *
 * Two of them carry meaning rather than decoration and are not
 * interchangeable: `arcLive` is an order in flight and `arcSettling` an order
 * that has completed and is inside its grace period. SPEC 13 forbids meaning
 * carried by colour alone, so the phase is also in each line's opacity, in
 * its accessible description, and in the panel's summary.
 */
export const PALETTE = {
  background: '#060f16',
  sphere: '#08151d',
  sphereStroke: '#14232d',
  graticule: '#122531',
  land: '#132b38',
  landStroke: '#26495c',
  /** Currencies, and the design's accent throughout. */
  currency: '#2bd9ff',
  /** Mostro instances: the network's own side of every line. */
  instance: '#e8ff3a',
  arcLive: '#2bd9ff',
  arcSettling: '#7ee08a',
  traveller: '#eafcff',
  label: '#8fb3c4',
  muted: '#5d7382',
} as const
