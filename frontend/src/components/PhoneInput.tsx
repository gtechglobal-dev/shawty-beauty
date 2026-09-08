import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { phoneCountries, type PhoneCountry } from '../lib/phone'

interface Props {
  value: string
  onChange: (v: string) => void
  required?: boolean
}

export default function PhoneInput({ value, onChange, required = true }: Props) {
  const [dial, setDial] = useState('234')
  const [national, setNational] = useState('')

  useEffect(() => {
    if (!value) return
    const digits = value.replace(/\D/g, '')
    const sorted = [...phoneCountries].sort((a, b) => b.dial.length - a.dial.length)
    const c = sorted.find((x) => digits.startsWith(x.dial)) ?? phoneCountries[0]
    setDial(c.dial)
    setNational(digits.slice(c.dial.length).slice(0, c.max))
  }, [value])

  function changeNational(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, country.max)
    setNational(digits)
    onChange(`+${dial} ${digits}`)
  }

  function changeDial(next: string) {
    const c = phoneCountries.find((x) => x.dial === next) ?? phoneCountries[0]
    const trimmed = national.slice(0, c.max)
    setDial(next)
    setNational(trimmed)
    onChange(`+${next} ${trimmed}`)
  }

  const country: PhoneCountry = phoneCountries.find((c) => c.dial === dial) ?? phoneCountries[0]
  const placeholder = country.max >= 10 ? '8012345678' : '123456789'

  return (
    <div className="flex items-stretch input-field !p-0 overflow-hidden min-w-0">
      <div className="relative shrink-0">
        <select
          value={dial}
          onChange={(e) => changeDial(e.target.value)}
          aria-label="Country code"
          className="appearance-none bg-white pl-2 pr-7 py-3 h-full text-[0.9rem] font-medium outline-none cursor-pointer border-r border-black/10"
        >
          {phoneCountries.map((c) => (
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
        required={required}
        aria-label="Phone number"
        className="flex-1 min-w-0 bg-white px-3 py-3 text-[0.9rem] font-sans outline-none"
      />
    </div>
  )
}