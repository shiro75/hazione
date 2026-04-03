/**
 * countryCodes.ts
 * List of supported country codes for phone number input fields.
 * Each entry includes an ISO code, dial prefix, display label, and country name.
 *
 * Usage:
 *   import { COUNTRY_CODES, DEFAULT_COUNTRY_CODE } from '@/constants/countryCodes';
 */

export interface CountryCode {
  code: string;
  dialCode: string;
  flag: string;
  name: string;
}

export function isoToFlagEmoji(isoCode: string): string {
  const code = isoCode.toUpperCase();
  if (code.length !== 2) return isoCode;
  const offset = 0x1F1E6 - 65;
  const first = String.fromCodePoint(code.charCodeAt(0) + offset);
  const second = String.fromCodePoint(code.charCodeAt(1) + offset);
  return first + second;
}

export const COUNTRY_CODES: CountryCode[] = [
  { code: 'FR', dialCode: '+33', flag: '\u{1F1EB}\u{1F1F7}', name: 'France' },
  { code: 'CH', dialCode: '+41', flag: '\u{1F1E8}\u{1F1ED}', name: 'Suisse' },
  { code: 'BE', dialCode: '+32', flag: '\u{1F1E7}\u{1F1EA}', name: 'Belgique' },
  { code: 'LU', dialCode: '+352', flag: '\u{1F1F1}\u{1F1FA}', name: 'Luxembourg' },
  { code: 'DE', dialCode: '+49', flag: '\u{1F1E9}\u{1F1EA}', name: 'Allemagne' },
  { code: 'IT', dialCode: '+39', flag: '\u{1F1EE}\u{1F1F9}', name: 'Italie' },
  { code: 'ES', dialCode: '+34', flag: '\u{1F1EA}\u{1F1F8}', name: 'Espagne' },
  { code: 'PT', dialCode: '+351', flag: '\u{1F1F5}\u{1F1F9}', name: 'Portugal' },
  { code: 'GB', dialCode: '+44', flag: '\u{1F1EC}\u{1F1E7}', name: 'Royaume-Uni' },
  { code: 'NL', dialCode: '+31', flag: '\u{1F1F3}\u{1F1F1}', name: 'Pays-Bas' },
  { code: 'US', dialCode: '+1', flag: '\u{1F1FA}\u{1F1F8}', name: 'Etats-Unis' },
  { code: 'CA', dialCode: '+1', flag: '\u{1F1E8}\u{1F1E6}', name: 'Canada' },
  { code: 'MA', dialCode: '+212', flag: '\u{1F1F2}\u{1F1E6}', name: 'Maroc' },
  { code: 'TN', dialCode: '+216', flag: '\u{1F1F9}\u{1F1F3}', name: 'Tunisie' },
  { code: 'DZ', dialCode: '+213', flag: '\u{1F1E9}\u{1F1FF}', name: 'Algerie' },
  { code: 'SN', dialCode: '+221', flag: '\u{1F1F8}\u{1F1F3}', name: 'Senegal' },
  { code: 'CI', dialCode: '+225', flag: '\u{1F1E8}\u{1F1EE}', name: 'Cote d\'Ivoire' },
  { code: 'CM', dialCode: '+237', flag: '\u{1F1E8}\u{1F1F2}', name: 'Cameroun' },
  { code: 'AT', dialCode: '+43', flag: '\u{1F1E6}\u{1F1F9}', name: 'Autriche' },
  { code: 'IE', dialCode: '+353', flag: '\u{1F1EE}\u{1F1EA}', name: 'Irlande' },
  { code: 'PL', dialCode: '+48', flag: '\u{1F1F5}\u{1F1F1}', name: 'Pologne' },
  { code: 'RO', dialCode: '+40', flag: '\u{1F1F7}\u{1F1F4}', name: 'Roumanie' },
  { code: 'GR', dialCode: '+30', flag: '\u{1F1EC}\u{1F1F7}', name: 'Grece' },
  { code: 'SE', dialCode: '+46', flag: '\u{1F1F8}\u{1F1EA}', name: 'Suede' },
  { code: 'NO', dialCode: '+47', flag: '\u{1F1F3}\u{1F1F4}', name: 'Norvege' },
  { code: 'DK', dialCode: '+45', flag: '\u{1F1E9}\u{1F1F0}', name: 'Danemark' },
  { code: 'FI', dialCode: '+358', flag: '\u{1F1EB}\u{1F1EE}', name: 'Finlande' },
  { code: 'CZ', dialCode: '+420', flag: '\u{1F1E8}\u{1F1FF}', name: 'Tchequie' },
  { code: 'HU', dialCode: '+36', flag: '\u{1F1ED}\u{1F1FA}', name: 'Hongrie' },
  { code: 'BG', dialCode: '+359', flag: '\u{1F1E7}\u{1F1EC}', name: 'Bulgarie' },
  { code: 'HR', dialCode: '+385', flag: '\u{1F1ED}\u{1F1F7}', name: 'Croatie' },
  { code: 'SK', dialCode: '+421', flag: '\u{1F1F8}\u{1F1F0}', name: 'Slovaquie' },
  { code: 'SI', dialCode: '+386', flag: '\u{1F1F8}\u{1F1EE}', name: 'Slovenie' },
  { code: 'EE', dialCode: '+372', flag: '\u{1F1EA}\u{1F1EA}', name: 'Estonie' },
  { code: 'LV', dialCode: '+371', flag: '\u{1F1F1}\u{1F1FB}', name: 'Lettonie' },
  { code: 'LT', dialCode: '+370', flag: '\u{1F1F1}\u{1F1F9}', name: 'Lituanie' },
  { code: 'MT', dialCode: '+356', flag: '\u{1F1F2}\u{1F1F9}', name: 'Malte' },
  { code: 'CY', dialCode: '+357', flag: '\u{1F1E8}\u{1F1FE}', name: 'Chypre' },
  { code: 'TR', dialCode: '+90', flag: '\u{1F1F9}\u{1F1F7}', name: 'Turquie' },
  { code: 'RU', dialCode: '+7', flag: '\u{1F1F7}\u{1F1FA}', name: 'Russie' },
  { code: 'BR', dialCode: '+55', flag: '\u{1F1E7}\u{1F1F7}', name: 'Bresil' },
  { code: 'MX', dialCode: '+52', flag: '\u{1F1F2}\u{1F1FD}', name: 'Mexique' },
  { code: 'JP', dialCode: '+81', flag: '\u{1F1EF}\u{1F1F5}', name: 'Japon' },
  { code: 'CN', dialCode: '+86', flag: '\u{1F1E8}\u{1F1F3}', name: 'Chine' },
  { code: 'IN', dialCode: '+91', flag: '\u{1F1EE}\u{1F1F3}', name: 'Inde' },
  { code: 'AU', dialCode: '+61', flag: '\u{1F1E6}\u{1F1FA}', name: 'Australie' },
  { code: 'NZ', dialCode: '+64', flag: '\u{1F1F3}\u{1F1FF}', name: 'Nouvelle-Zelande' },
  { code: 'ZA', dialCode: '+27', flag: '\u{1F1FF}\u{1F1E6}', name: 'Afrique du Sud' },
  { code: 'AE', dialCode: '+971', flag: '\u{1F1E6}\u{1F1EA}', name: 'Emirats arabes unis' },
  { code: 'SA', dialCode: '+966', flag: '\u{1F1F8}\u{1F1E6}', name: 'Arabie saoudite' },
  { code: 'IL', dialCode: '+972', flag: '\u{1F1EE}\u{1F1F1}', name: 'Israel' },
  { code: 'SG', dialCode: '+65', flag: '\u{1F1F8}\u{1F1EC}', name: 'Singapour' },
  { code: 'KR', dialCode: '+82', flag: '\u{1F1F0}\u{1F1F7}', name: 'Coree du Sud' },
  { code: 'MC', dialCode: '+377', flag: '\u{1F1F2}\u{1F1E8}', name: 'Monaco' },
  { code: 'AD', dialCode: '+376', flag: '\u{1F1E6}\u{1F1E9}', name: 'Andorre' },
  { code: 'RE', dialCode: '+262', flag: '\u{1F1F7}\u{1F1EA}', name: 'La Reunion' },
  { code: 'GP', dialCode: '+590', flag: '\u{1F1EC}\u{1F1F5}', name: 'Guadeloupe' },
  { code: 'MQ', dialCode: '+596', flag: '\u{1F1F2}\u{1F1F6}', name: 'Martinique' },
  { code: 'GF', dialCode: '+594', flag: '\u{1F1EC}\u{1F1EB}', name: 'Guyane francaise' },
  { code: 'YT', dialCode: '+262', flag: '\u{1F1FE}\u{1F1F9}', name: 'Mayotte' },
  { code: 'NC', dialCode: '+687', flag: '\u{1F1F3}\u{1F1E8}', name: 'Nouvelle-Caledonie' },
  { code: 'PF', dialCode: '+689', flag: '\u{1F1F5}\u{1F1EB}', name: 'Polynesie francaise' },
];

export const DEFAULT_COUNTRY_CODE = COUNTRY_CODES[0];
