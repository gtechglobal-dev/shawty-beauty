export interface PhoneCountry {
  code: string
  flag: string
  dial: string
  min: number
  max: number
}

export const phoneCountries: PhoneCountry[] = [
  { code: 'NG', flag: '🇳🇬', dial: '234', min: 10, max: 10 },
  { code: 'GH', flag: '🇬🇭', dial: '233', min: 9, max: 9 },
  { code: 'ZA', flag: '🇿🇦', dial: '27', min: 9, max: 9 },
  { code: 'KE', flag: '🇰🇪', dial: '254', min: 9, max: 9 },
  { code: 'AE', flag: '🇦🇪', dial: '971', min: 9, max: 9 },
  { code: 'US', flag: '🇺🇸', dial: '1', min: 10, max: 10 },
  { code: 'CA', flag: '🇨🇦', dial: '1', min: 10, max: 10 },
  { code: 'GB', flag: '🇬🇧', dial: '44', min: 9, max: 10 },
  { code: 'IN', flag: '🇮🇳', dial: '91', min: 10, max: 10 },
  { code: 'FR', flag: '🇫🇷', dial: '33', min: 9, max: 9 },
  { code: 'DE', flag: '🇩🇪', dial: '49', min: 8, max: 11 },
]

const sortedCountries = [...phoneCountries].sort((a, b) => b.dial.length - a.dial.length)

export function parsePhone(value: string): { country: PhoneCountry; national: string; digits: string } | null {
  const digits = (value || '').replace(/\D/g, '')
  if (!digits) return null
  const country = sortedCountries.find((c) => digits.startsWith(c.dial))
  if (!country) return null
  return { country, national: digits.slice(country.dial.length), digits }
}

export function isValidPhone(value: string): boolean {
  const parsed = parsePhone(value)
  if (!parsed || !parsed.national) return false
  return parsed.national.length >= parsed.country.min && parsed.national.length <= parsed.country.max
}

export function phoneErrorMessage(value: string): string | null {
  if (!value.trim()) return 'Phone number is required'
  const parsed = parsePhone(value)
  if (!parsed || !parsed.national) return 'Please enter a valid phone number with a country code'
  if (parsed.national.length < parsed.country.min) {
    return `That phone number looks too short for ${parsed.country.code}`
  }
  if (parsed.national.length > parsed.country.max) {
    return `That phone number looks too long for ${parsed.country.code}`
  }
  return null
}