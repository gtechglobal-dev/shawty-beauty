interface PhoneCountry {
  code: string;
  dial: string;
  min: number;
  max: number;
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { code: 'NG', dial: '234', min: 10, max: 10 },
  { code: 'GH', dial: '233', min: 9, max: 9 },
  { code: 'ZA', dial: '27', min: 9, max: 9 },
  { code: 'KE', dial: '254', min: 9, max: 9 },
  { code: 'AE', dial: '971', min: 9, max: 9 },
  { code: 'US', dial: '1', min: 10, max: 10 },
  { code: 'CA', dial: '1', min: 10, max: 10 },
  { code: 'GB', dial: '44', min: 9, max: 10 },
  { code: 'IN', dial: '91', min: 10, max: 10 },
  { code: 'FR', dial: '33', min: 9, max: 9 },
  { code: 'DE', dial: '49', min: 8, max: 11 },
];

const SORTED = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

export function isValidPhone(value: string): boolean {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return false;
  const country = SORTED.find((c) => digits.startsWith(c.dial));
  if (!country) return false;
  const national = digits.slice(country.dial.length);
  if (!national) return false;
  return national.length >= country.min && national.length <= country.max;
}

export function phoneErrorMessage(value: string): string | null {
  if (!value.trim()) return 'Phone number is required';
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return 'Please enter a valid phone number with a country code';
  const country = SORTED.find((c) => digits.startsWith(c.dial));
  if (!country) return 'Please enter a valid phone number with a country code';
  const national = digits.slice(country.dial.length);
  if (!national || national.length < country.min) {
    return `That phone number looks too short for ${country.code}`;
  }
  if (national.length > country.max) {
    return `That phone number looks too long for ${country.code}`;
  }
  return null;
}

export function normalizePhone(value: string): string {
  return (value || '').trim().replace(/\s+/g, ' ');
}