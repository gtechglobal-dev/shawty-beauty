import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface Country {
  code: string
  flag: string
  dial: string
  max: number
}

export const countries: Country[] = [
  { code: 'NG', flag: '🇳🇬', dial: '234', max: 10 },
  { code: 'GH', flag: '🇬🇭', dial: '233', max: 9 },
  { code: 'ZA', flag: '🇿🇦', dial: '27', max: 9 },
  { code: 'KE', flag: '🇰🇪', dial: '254', max: 9 },
  { code: 'AE', flag: '🇦🇪', dial: '971', max: 9 },
  { code: 'US', flag: '🇺🇸', dial: '1', max: 10 },
  { code: 'CA', flag: '🇨🇦', dial: '1', max: 10 },
  { code: 'GB', flag: '🇬🇧', dial: '44', max: 10 },
  { code: 'IN', flag: '🇮🇳', dial: '91', max: 10 },
  { code: 'FR', flag: '🇫🇷', dial: '33', max: 9 },
  { code: 'DE', flag: '🇩🇪', dial: '49', max: 11 },
]

interface Props {
  value: string
  onChange: (v: string) => void
}

export default function PhoneInput({ value, onChange }: Props) {
  const [dial, setDial] = useState('234')
  const [national, setNational] = useState('')

  useEffect(() => {
    if (!value) return
    const digits = value.replace(/\D/g, '')
    const c = countries.find((x) => digits.startsWith(x.dial)) ?? countries[0]
    setDial(c.dial)
    setNational(digits.slice(c.dial.length).slice(0, c.max))
  }, [value])

  function changeNational(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, country.max)
    setNational(digits)
    onChange(`+${dial} ${digits}`)
  }

  function changeDial(next: string) {
    const c = countries.find((x) => x.dial === next) ?? countries[0]
    const trimmed = national.slice(0, c.max)
    setDial(next)
    setNational(trimmed)
    onChange(`+${next} ${trimmed}`)
  }

  const country = countries.find((c) => c.dial === dial) ?? countries[0]
  const placeholder = country.max >= 10 ? '8012345678' : '123456789'

  return (
    <div className="flex items-stretch input-field !p-0 overflow-hidden">
      <div className="relative shrink-0">
        <select
          value={dial}
          onChange={(e) => changeDial(e.target.value)}
          aria-label="Country code"
          className="appearance-none bg-white pl-3 pr-8 h-full text-sm font-medium outline-none cursor-pointer border-r border-black/10"
        >
          {countries.map((c) => (
            <option key={c.code} value={c.dial}>
              {c.flag} +{c.dial}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-ink/50"
        />
      </div>
      <input
        type="tel"
        inputMode="numeric"
        value={national}
        onChange={(e) => changeNational(e.target.value)}
        placeholder={placeholder}
        maxLength={country.max}
        required
        aria-label="Phone number"
        className="flex-1 min-w-0 bg-white px-3 text-[0.9rem] font-sans outline-none"
      />
    </div>
  )
}