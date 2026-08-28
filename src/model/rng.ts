/**
 * A seeded pseudo-random generator.
 *
 * The map places nodes at random inside their country, but "random" here has
 * to mean *stable for the life of a page*: a node that jumps around on every
 * re-render would read as movement, and movement on this map means order
 * flow. One seed per page load, drawn once, and everything downstream is a
 * pure function of it — which is also what makes the placement testable.
 *
 * mulberry32: 32-bit state, good enough distribution for scattering dots on a
 * map, and short enough to read.
 */
export function seededRng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A fresh seed for this page load. Called once, at boot. */
export function sessionSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0
}
