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

export const COUNTRY_CODES: CountryCode[] = [
  { code: 'FR', dialCode: '+33', flag: 'FR', name: 'France' },
  { code: 'CH', dialCode: '+41', flag: 'CH', name: 'Suisse' },
  { code: 'BE', dialCode: '+32', flag: 'BE', name: 'Belgique' },
  { code: 'LU', dialCode: '+352', flag: 'LU', name: 'Luxembourg' },
  { code: 'DE', dialCode: '+49', flag: 'DE', name: 'Allemagne' },
  { code: 'IT', dialCode: '+39', flag: 'IT', name: 'Italie' },
  { code: 'ES', dialCode: '+34', flag: 'ES', name: 'Espagne' },
  { code: 'PT', dialCode: '+351', flag: 'PT', name: 'Portugal' },
  { code: 'GB', dialCode: '+44', flag: 'GB', name: 'Royaume-Uni' },
  { code: 'NL', dialCode: '+31', flag: 'NL', name: 'Pays-Bas' },
  { code: 'US', dialCode: '+1', flag: 'US', name: 'Etats-Unis' },
  { code: 'CA', dialCode: '+1', flag: 'CA', name: 'Canada' },
  { code: 'MA', dialCode: '+212', flag: 'MA', name: 'Maroc' },
  { code: 'TN', dialCode: '+216', flag: 'TN', name: 'Tunisie' },
  { code: 'DZ', dialCode: '+213', flag: 'DZ', name: 'Algerie' },
  { code: 'SN', dialCode: '+221', flag: 'SN', name: 'Senegal' },
  { code: 'CI', dialCode: '+225', flag: 'CI', name: 'Cote d\'Ivoire' },
  { code: 'CM', dialCode: '+237', flag: 'CM', name: 'Cameroun' },
  { code: 'AT', dialCode: '+43', flag: 'AT', name: 'Autriche' },
  { code: 'IE', dialCode: '+353', flag: 'IE', name: 'Irlande' },
  { code: 'PL', dialCode: '+48', flag: 'PL', name: 'Pologne' },
  { code: 'RO', dialCode: '+40', flag: 'RO', name: 'Roumanie' },
  { code: 'GR', dialCode: '+30', flag: 'GR', name: 'Grece' },
  { code: 'SE', dialCode: '+46', flag: 'SE', name: 'Suede' },
  { code: 'NO', dialCode: '+47', flag: 'NO', name: 'Norvege' },
  { code: 'DK', dialCode: '+45', flag: 'DK', name: 'Danemark' },
  { code: 'FI', dialCode: '+358', flag: 'FI', name: 'Finlande' },
  { code: 'CZ', dialCode: '+420', flag: 'CZ', name: 'Tchequie' },
  { code: 'HU', dialCode: '+36', flag: 'HU', name: 'Hongrie' },
  { code: 'BG', dialCode: '+359', flag: 'BG', name: 'Bulgarie' },
  { code: 'HR', dialCode: '+385', flag: 'HR', name: 'Croatie' },
  { code: 'SK', dialCode: '+421', flag: 'SK', name: 'Slovaquie' },
  { code: 'SI', dialCode: '+386', flag: 'SI', name: 'Slovenie' },
  { code: 'EE', dialCode: '+372', flag: 'EE', name: 'Estonie' },
  { code: 'LV', dialCode: '+371', flag: 'LV', name: 'Lettonie' },
  { code: 'LT', dialCode: '+370', flag: 'LT', name: 'Lituanie' },
  { code: 'MT', dialCode: '+356', flag: 'MT', name: 'Malte' },
  { code: 'CY', dialCode: '+357', flag: 'CY', name: 'Chypre' },
  { code: 'TR', dialCode: '+90', flag: 'TR', name: 'Turquie' },
  { code: 'RU', dialCode: '+7', flag: 'RU', name: 'Russie' },
  { code: 'BR', dialCode: '+55', flag: 'BR', name: 'Bresil' },
  { code: 'MX', dialCode: '+52', flag: 'MX', name: 'Mexique' },
  { code: 'JP', dialCode: '+81', flag: 'JP', name: 'Japon' },
  { code: 'CN', dialCode: '+86', flag: 'CN', name: 'Chine' },
  { code: 'IN', dialCode: '+91', flag: 'IN', name: 'Inde' },
  { code: 'AU', dialCode: '+61', flag: 'AU', name: 'Australie' },
  { code: 'NZ', dialCode: '+64', flag: 'NZ', name: 'Nouvelle-Zelande' },
  { code: 'ZA', dialCode: '+27', flag: 'ZA', name: 'Afrique du Sud' },
  { code: 'AE', dialCode: '+971', flag: 'AE', name: 'Emirats arabes unis' },
  { code: 'SA', dialCode: '+966', flag: 'SA', name: 'Arabie saoudite' },
  { code: 'IL', dialCode: '+972', flag: 'IL', name: 'Israel' },
  { code: 'SG', dialCode: '+65', flag: 'SG', name: 'Singapour' },
  { code: 'KR', dialCode: '+82', flag: 'KR', name: 'Coree du Sud' },
  { code: 'MC', dialCode: '+377', flag: 'MC', name: 'Monaco' },
  { code: 'AD', dialCode: '+376', flag: 'AD', name: 'Andorre' },
  { code: 'RE', dialCode: '+262', flag: 'RE', name: 'La Reunion' },
  { code: 'GP', dialCode: '+590', flag: 'GP', name: 'Guadeloupe' },
  { code: 'MQ', dialCode: '+596', flag: 'MQ', name: 'Martinique' },
  { code: 'GF', dialCode: '+594', flag: 'GF', name: 'Guyane francaise' },
  { code: 'YT', dialCode: '+262', flag: 'YT', name: 'Mayotte' },
  { code: 'NC', dialCode: '+687', flag: 'NC', name: 'Nouvelle-Caledonie' },
  { code: 'PF', dialCode: '+689', flag: 'PF', name: 'Polynesie francaise' },
];

export const DEFAULT_COUNTRY_CODE = COUNTRY_CODES[0];
