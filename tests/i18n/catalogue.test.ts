import { describe, expect, test } from 'vitest'
import { LOCALES } from '~/i18n'
import { en } from '~/i18n/en'
import type { Strings } from '~/i18n'

/**
 * The type in `strings.ts` guarantees no locale forgets a key. These check
 * what a type cannot: that nothing is blank, that every interpolation
 * actually places its value, and that no locale is quietly still English.
 */

/** Walks a catalogue, calling every function with sample values. */
function walk(strings: Strings): { path: string; value: string }[] {
  const out: { path: string; value: string }[] = []
  const visit = (node: unknown, path: string) => {
    if (typeof node === 'string') {
      out.push({ path, value: node })
      return
    }
    if (typeof node === 'function') {
      const arity = (node as (...args: unknown[]) => string).length
      const args: unknown[] = Array.from({ length: arity }, (_, i) => (i === 0 ? 7 : 3))
      const call = node as (...args: unknown[]) => string
      out.push({ path, value: call(...args) })
      return
    }
    if (Array.isArray(node)) {
      node.forEach((item, i) => visit(item, `${path}[${i}]`))
      return
    }
    if (node && typeof node === 'object') {
      for (const [key, value] of Object.entries(node)) visit(value, `${path}.${key}`)
    }
  }
  visit(strings, '')
  return out
}

const locales = Object.entries(LOCALES)

describe('every catalogue', () => {
  test.each(locales)('%s has no blank string', (tag, strings) => {
    for (const { path, value } of walk(strings)) {
      expect(value.trim().length, `${tag}${path}`).toBeGreaterThan(0)
    }
  })

  test.each(locales)('%s leaves no placeholder unfilled', (tag, strings) => {
    // A template that forgot its argument prints `${…}` or `undefined`.
    for (const { path, value } of walk(strings)) {
      expect(value, `${tag}${path}`).not.toContain('${')
      expect(value, `${tag}${path}`).not.toContain('undefined')
      expect(value, `${tag}${path}`).not.toContain('NaN')
    }
  })

  test.each(locales)('%s places every value it was given', (tag, strings) => {
    for (const { path, value } of walk(strings)) {
      const original = path
        .split(/[.[\]]/)
        .filter(Boolean)
        .reduce<unknown>((node, key) => (node as Record<string, unknown>)?.[key], strings)
      if (typeof original !== 'function') continue
      const arity = (original as (...a: unknown[]) => string).length
      // Each argument this catalogue was handed has to appear in the output.
      for (let i = 0; i < arity; i++) {
        expect(value, `${tag}${path} drops argument ${i}`).toContain(i === 0 ? '7' : '3')
      }
    }
  })

  test.each(locales)('%s has the same shape as English', (tag, strings) => {
    const paths = (s: Strings) =>
      walk(s)
        .map((entry) => entry.path)
        .sort()

    expect(paths(strings), tag).toEqual(paths(en))
  })
})

describe('a translation is a translation', () => {
  const shared = new Set([
    // Names, units and codes that are the same word everywhere.
    '.locale',
    '.header.network',
    '.rail.version',
    '.rail.relays',
    // A name, a code and a count with a separator between them: the same
    // line in every language that does not put a space before its colon.
    '.matrix.cell',
    '.fiat.p50',
    '.fiat.p90',
    '.pairs.devFees',
    '.pairs.p50',
    '.inferred.mark',
    '.map.noGeometry',
  ])

  test.each(locales.filter(([tag]) => tag !== 'en'))(
    '%s is not still English',
    (tag, strings) => {
      const english = new Map(walk(en).map((entry) => [entry.path, entry.value]))
      const same = walk(strings).filter(
        (entry) =>
          !shared.has(entry.path) &&
          entry.value === english.get(entry.path) &&
          // A one-word label may legitimately coincide; a sentence may not.
          entry.value.split(' ').length > 3,
      )

      expect(
        same.map((entry) => entry.path),
        tag,
      ).toEqual([])
    },
  )
})
