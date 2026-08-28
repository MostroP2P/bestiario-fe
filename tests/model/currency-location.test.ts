import { describe, expect, test } from 'vitest'
import { currencyPlacement } from '~/model/currency-location'

describe('currencyPlacement', () => {
  test('reads the country from the ISO 4217 code, which starts with the country', () => {
    // Arrange / Act / Assert — ARS is Argentina's peso, and says so.
    expect(currencyPlacement('ARS')).toEqual({
      kind: 'country',
      alpha2: 'AR',
      via: 'name',
    })
  })

  test('places the currencies the network actually trades', () => {
    const placed = ['VES', 'COP', 'BRL', 'MXN', 'PEN', 'CLP', 'USD', 'NGN', 'IDR'].map(
      (code) => [code, currencyPlacement(code)] as const,
    )

    expect(Object.fromEntries(placed.map(([c, p]) => [c, p.kind]))).toEqual({
      VES: 'country',
      COP: 'country',
      BRL: 'country',
      MXN: 'country',
      PEN: 'country',
      CLP: 'country',
      USD: 'country',
      NGN: 'country',
      IDR: 'country',
    })
  })

  test('places a currency with no single country in its region', () => {
    expect(currencyPlacement('EUR')).toEqual({
      kind: 'region',
      region: 'europe',
      via: 'name',
    })
  })

  test('places the shared African and Caribbean currencies in their regions', () => {
    expect(currencyPlacement('XOF')).toMatchObject({ kind: 'region', region: 'africa' })
    expect(currencyPlacement('XCD')).toMatchObject({
      kind: 'region',
      region: 'caribbean',
    })
  })

  test('is case-insensitive', () => {
    expect(currencyPlacement('ars')).toMatchObject({ alpha2: 'AR' })
  })

  test('is unknown for a code whose country has no geometry', () => {
    // XXX is "no currency"; its first two letters name no country.
    expect(currencyPlacement('XXX')).toEqual({ kind: 'unknown' })
  })

  test('is unknown for something that is not a currency code', () => {
    expect(currencyPlacement('')).toEqual({ kind: 'unknown' })
    expect(currencyPlacement('BTC')).toEqual({ kind: 'unknown' })
  })
})

describe('currencyPlacement · not a country currency', () => {
  test('refuses bitcoin, which the prefix rule would read as Bhutan', () => {
    expect(currencyPlacement('BTC')).toEqual({ kind: 'unknown' })
  })

  test('refuses sats, which the prefix rule would read as Saudi Arabia', () => {
    expect(currencyPlacement('SAT')).toEqual({ kind: 'unknown' })
    expect(currencyPlacement('SATS')).toEqual({ kind: 'unknown' })
  })

  test('refuses dollar stablecoins, which are not the United States', () => {
    expect(currencyPlacement('USDT')).toEqual({ kind: 'unknown' })
    expect(currencyPlacement('USDC')).toEqual({ kind: 'unknown' })
  })
})
