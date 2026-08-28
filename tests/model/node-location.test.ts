import { describe, expect, test } from 'vitest'
import { buildCountryIndex, intlResolver, resolvePlacement } from '~/model/node-location'

describe('resolvePlacement · flags', () => {
  test('reads the country from a flag emoji in the name', () => {
    // Arrange
    const name = 'Mostro 🇦🇷'

    // Act
    const placement = resolvePlacement(name)

    // Assert
    expect(placement).toEqual({ kind: 'country', alpha2: 'AR', via: 'flag' })
  })

  test('prefers the flag over a country name in the same string', () => {
    expect(resolvePlacement('Mostro Venezuela 🇧🇷')).toEqual({
      kind: 'country',
      alpha2: 'BR',
      via: 'flag',
    })
  })

  test('takes the first flag when a name carries several', () => {
    expect(resolvePlacement('🇨🇴 🇵🇪 nodo andino')).toMatchObject({ alpha2: 'CO' })
  })

  test('ignores a regional-indicator pair that is not a country', () => {
    // AA is not assigned, so this must fall through rather than invent a place.
    expect(resolvePlacement('nodo 🇦🇦')).toEqual({ kind: 'unknown' })
  })

  test('ignores a country with no geometry at this atlas resolution', () => {
    // Monaco has an ISO code but no 110m polygon; placing it would be a lie.
    expect(resolvePlacement('mostro 🇲🇨')).toEqual({ kind: 'unknown' })
  })
})

describe('resolvePlacement · country names', () => {
  test('reads a Spanish country name', () => {
    expect(resolvePlacement('Mostro España')).toEqual({
      kind: 'country',
      alpha2: 'ES',
      via: 'name',
    })
  })

  test('reads an English country name', () => {
    expect(resolvePlacement('Mostro Spain')).toEqual({
      kind: 'country',
      alpha2: 'ES',
      via: 'name',
    })
  })

  test('matches regardless of case and accents', () => {
    expect(resolvePlacement('NODO peru')).toMatchObject({ alpha2: 'PE' })
  })

  test('prefers the longest matching name', () => {
    // "Dominica" is a substring of "República Dominicana" and must not win.
    expect(resolvePlacement('mostro República Dominicana')).toMatchObject({ alpha2: 'DO' })
  })

  test('does not match a country name embedded in a longer word', () => {
    expect(resolvePlacement('chadwick.network')).toEqual({ kind: 'unknown' })
  })
})

describe('resolvePlacement · regions', () => {
  test('reads a region when there is no flag and no country', () => {
    expect(resolvePlacement('Mostro LATAM')).toEqual({
      kind: 'region',
      region: 'latam',
      via: 'name',
    })
  })

  test('reads a Spanish region name', () => {
    expect(resolvePlacement('nodo de Europa')).toEqual({
      kind: 'region',
      region: 'europe',
      via: 'name',
    })
  })

  test('prefers a country over a region', () => {
    expect(resolvePlacement('Mostro Brasil · LATAM')).toMatchObject({
      kind: 'country',
      alpha2: 'BR',
    })
  })
})

describe('resolvePlacement · nothing to go on', () => {
  test('is unknown for a name that names no place', () => {
    expect(resolvePlacement('mostro.network')).toEqual({ kind: 'unknown' })
  })

  test('is unknown for an empty name', () => {
    expect(resolvePlacement('')).toEqual({ kind: 'unknown' })
  })
})

describe('buildCountryIndex', () => {
  test('is empty when the runtime resolves no names, so nothing matches by name', () => {
    // Arrange — a runtime with no ICU data for these locales.
    const resolve = () => undefined

    // Act
    const index = buildCountryIndex(resolve)

    // Assert
    expect(index).toEqual([])
  })

  test('orders names longest first, so the more specific one wins', () => {
    const resolve = (_locale: string, alpha2: string) =>
      alpha2 === 'AR' ? 'Argentina' : alpha2 === 'CL' ? 'Chile' : undefined

    const index = buildCountryIndex(resolve)

    expect(index).toEqual([
      ['argentina', 'AR'],
      ['chile', 'CL'],
    ])
  })

  test('keeps the first locale to name a country', () => {
    const resolve = (locale: string, alpha2: string) =>
      alpha2 === 'ES' ? (locale === 'es' ? 'España' : 'Spain') : undefined

    const index = buildCountryIndex(resolve)

    expect(index.map(([name]) => name)).toEqual(['espana', 'spain'])
  })
})

describe('intlResolver', () => {
  test('names a country this runtime knows', () => {
    expect(intlResolver('en', 'AR')).toBe('Argentina')
  })

  test('is undefined when the runtime hands back the code it was given', () => {
    // AA is unassigned: DisplayNames echoes it back rather than naming it,
    // and an echoed code is not a name.
    expect(intlResolver('en', 'AA')).toBeUndefined()
  })

  test('is undefined when the runtime throws on the input', () => {
    expect(intlResolver('en', 'not-a-region')).toBeUndefined()
  })
})

describe('resolvePlacement · domain suffixes', () => {
  test('reads the country from a ccTLD', () => {
    expect(resolvePlacement('satoshi.br')).toEqual({
      kind: 'country',
      alpha2: 'BR',
      via: 'tld',
    })
  })

  test('reads a ccTLD under a subdomain', () => {
    expect(resolvePlacement('relay.mostro.mx')).toMatchObject({ alpha2: 'MX', via: 'tld' })
  })

  test('reads a regional gTLD', () => {
    expect(resolvePlacement('p2p.lat')).toEqual({
      kind: 'region',
      region: 'latam',
      via: 'tld',
    })
  })

  test('ignores a ccTLD that is predominantly a vanity suffix', () => {
    // .io is the British Indian Ocean Territory. Nobody registering it means
    // that, and a node in the Indian Ocean would be an invented fact.
    expect(resolvePlacement('mostro.io')).toEqual({ kind: 'unknown' })
  })

  test('ignores the other common vanity suffixes', () => {
    for (const name of ['mostro.co', 'mostro.me', 'mostro.tv', 'mostro.ai', 'bit.ly']) {
      expect(resolvePlacement(name)).toEqual({ kind: 'unknown' })
    }
  })

  test('ignores a gTLD that names no place', () => {
    expect(resolvePlacement('mostro.network')).toEqual({ kind: 'unknown' })
  })

  test('ignores a two-letter suffix that is not a country', () => {
    expect(resolvePlacement('mostro.zz')).toEqual({ kind: 'unknown' })
  })

  test('prefers a flag over a domain suffix', () => {
    expect(resolvePlacement('🇻🇪 nodo.mx')).toEqual({
      kind: 'country',
      alpha2: 'VE',
      via: 'flag',
    })
  })

  test('prefers a spelled-out country over a domain suffix', () => {
    // The name is a deliberate statement; the domain is a side effect of
    // where someone could buy a registration.
    expect(resolvePlacement('Mostro Argentina · satoshi.br')).toEqual({
      kind: 'country',
      alpha2: 'AR',
      via: 'name',
    })
  })

  test('prefers a domain suffix over a named region, being more specific', () => {
    expect(resolvePlacement('nodo LATAM · andes.pe')).toEqual({
      kind: 'country',
      alpha2: 'PE',
      via: 'tld',
    })
  })

  test('does not read a bare word as a suffix', () => {
    expect(resolvePlacement('mostro br')).toEqual({ kind: 'unknown' })
  })
})
