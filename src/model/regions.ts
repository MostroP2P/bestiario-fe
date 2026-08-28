/**
 * Regions a node can name when it does not name a country.
 *
 * A region is a set of countries: a node placed in one lands somewhere inside
 * one of them, which is as precise as the claim "LATAM" deserves. Membership
 * is by ISO alpha-2 and is deliberately conservative — a country listed here
 * is one the region unambiguously contains.
 */

export const REGIONS = {
  latam: [
    'AR', 'BO', 'BR', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'GT', 'HN', 'MX',
    'NI', 'PA', 'PE', 'PY', 'SV', 'UY', 'VE',
  ],
  'south-america': ['AR', 'BO', 'BR', 'CL', 'CO', 'EC', 'GY', 'PE', 'PY', 'SR', 'UY', 'VE'],
  'central-america': ['BZ', 'CR', 'GT', 'HN', 'NI', 'PA', 'SV'],
  caribbean: ['BS', 'CU', 'DO', 'HT', 'JM', 'PR', 'TT'],
  'north-america': ['CA', 'MX', 'US'],
  europe: [
    'AT', 'BE', 'BG', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GB',
    'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LV', 'NL', 'NO', 'PL', 'PT', 'RO',
    'RS', 'SE', 'SI', 'SK', 'UA',
  ],
  africa: [
    'AO', 'CD', 'CI', 'CM', 'DZ', 'EG', 'ET', 'GH', 'KE', 'MA', 'MZ', 'NG',
    'SN', 'TN', 'TZ', 'UG', 'ZA', 'ZM', 'ZW',
  ],
  asia: [
    'CN', 'ID', 'IN', 'JP', 'KH', 'KR', 'LK', 'MM', 'MY', 'NP', 'PH', 'PK',
    'TH', 'VN',
  ],
  'middle-east': ['AE', 'IL', 'IQ', 'IR', 'JO', 'KW', 'LB', 'OM', 'QA', 'SA', 'TR', 'YE'],
  oceania: ['AU', 'FJ', 'NZ', 'PG'],
} as const satisfies Record<string, readonly string[]>

export type RegionId = keyof typeof REGIONS

/** What a node's name can call a region, in Spanish and English. */
export const REGION_ALIASES: Readonly<Record<RegionId, readonly string[]>> = {
  latam: ['latam', 'latinoamerica', 'latin america', 'america latina', 'hispanoamerica'],
  'south-america': ['sudamerica', 'sudamérica', 'south america', 'america del sur'],
  'central-america': ['centroamerica', 'central america', 'america central'],
  caribbean: ['caribe', 'caribbean'],
  'north-america': ['norteamerica', 'north america', 'america del norte'],
  europe: ['europa', 'europe'],
  africa: ['africa', 'áfrica'],
  asia: ['asia'],
  'middle-east': ['medio oriente', 'middle east', 'oriente medio'],
  oceania: ['oceania', 'oceanía'],
}
