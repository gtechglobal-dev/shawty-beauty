import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, LoaderCircle, CreditCard, CircleAlert, Image as ImageIcon } from 'lucide-react'
import { formatNgn, nationalities, nationalityNames, tickets, ticketPrice, type Ticket } from '../lib/constants'
import { postJson } from '../lib/api'
import { fetchPaystackConfig, loadPaystackScript, type PaystackConfig } from '../lib/paystack'
import PhoneInput from '../components/PhoneInput'
import Reveal from '../components/Reveal'
import TicketCard from '../components/TicketCard'

interface FormState {
  fullName: string
  phone: string
  email: string
  instagram: string
  dateOfBirth: string
  state: string
  nationality: string
  address: string
  experienceLevel: string
  emergencyContactName: string
  emergencyContact: string
  ticketType: Ticket['id']
  quantity: number
  reason: string
  hearAbout: string
}

const initial: FormState = {
  fullName: '',
  phone: '',
  email: '',
  instagram: '',
  dateOfBirth: '',
  state: '',
  nationality: 'Nigerian',
  address: '',
  experienceLevel: '',
  emergencyContactName: '',
  emergencyContact: '',
  ticketType: 'student',
  quantity: 1,
  reason: '',
  hearAbout: '',
}

const experienceOptions = ['None / Beginner', 'Some experience', 'Intermediate', 'Advanced']
const hearOptions = ['Instagram', 'Facebook', 'WhatsApp', 'Friend / Word of mouth', 'Flyer / Advert', 'Other']
const PROCESSING_FEE_RATE = 0.015 // 1.5% of ticket amount
const PROCESSING_FEE_BASE = 100 // + ₦100 fixed

export default function Register() {
  const [form, setForm] = useState<FormState>(initial)
  const [config, setConfig] = useState<PaystackConfig | null>(null)
  const [configError, setConfigError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [profilePhoto, setProfilePhoto] = useState('')
  const [photoInvalid, setPhotoInvalid] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    fetchPaystackConfig().then(setConfig).catch(() => {
      // Fall back to ticket data even if config endpoint fails
      setConfigError('Payment may not be configured yet.')
    })
  }, [])

  const selected = tickets.find((t) => t.id === form.ticketType)!
  const selectedPrice = ticketPrice(selected, now)
  const subtotal = selectedPrice * form.quantity
  const processingFee = Math.round(subtotal * PROCESSING_FEE_RATE) + PROCESSING_FEE_BASE
  const total = subtotal + processingFee

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const [sameAsPhone, setSameAsPhone] = useState(false)
  const [sameAsName, setSameAsName] = useState(false)

  function handlePhoto(file?: File) {
    if (!file) return
    if (file.size > 1500000) {
      setPhotoInvalid('Photo must be under 1.5MB. Please choose a smaller image.')
      return
    }
    if (!file.type.startsWith('image/')) {
      setPhotoInvalid('Please choose an image file.')
      return
    }
    setPhotoInvalid('')
    const reader = new FileReader()
    reader.onload = () => setProfilePhoto(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handlePayWithPaystack() {
    setError('')
    setLoading(true)
    if (!profilePhoto) {
      setError('Please upload a profile photo to complete your registration.')
      setLoading(false)
      return
    }
    try {
      await loadPaystackScript()
      if (config?.paystackEnabled !== true || !window.PaystackPop) {
        throw new Error('Paystack is not configured yet. Please contact the studio or try paying by bank transfer.')
      }

      // 1. Initialize payment on the backend (also saves pending registration)
      const { paystack } = await postJson('/api/paystack/initialize', {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        instagram: form.instagram,
        dateOfBirth: form.dateOfBirth,
        state: form.state,
        nationality: form.nationality,
        address: form.address,
        experienceLevel: form.experienceLevel,
        emergencyContactName: form.emergencyContactName,
        emergencyContact: form.emergencyContact,
        ticketType: form.ticketType,
        quantity: form.quantity,
        reason: form.reason,
        hearAbout: form.hearAbout,
        photoBase64: profilePhoto || undefined,
        origin: window.location.origin,
      })

      // 2. Open Paystack inline checkout
      const isMobile = window.matchMedia('(max-width: 767px)').matches

      if (isMobile) {
        // Mobile: redirect the current tab to Paystack (the JS callback
        // doesn't fire for handler.open(), so we rely on callback_url).
        setSuccess(true)
        window.location.href = paystack.authorization_url
        return
      }

      // Desktop: open the Paystack iframe popup
      const handler = window.PaystackPop.setup({
        key: config.publicKey,
        email: form.email,
        amount: paystack.amount,
        ref: paystack.reference,
        currency: 'NGN',
        metadata: paystack.metadata,
        callback: (response: { reference: string }) => {
          navigate(`/register/payment-callback?reference=${response.reference}`)
        },
        onClose: () => {
          setLoading(false)
          setSuccess(false)
        },
      })
      handler.openIframe()
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  async function handleManualRegister(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    if (!profilePhoto) {
      setError('Please upload a profile photo to complete your registration.')
      setLoading(false)
      return
    }
    try {
      // If paystack configured, go through paystack
      if (config?.paystackEnabled === true) {
        await handlePayWithPaystack()
        return
      }
      await postJson('/api/paystack/initialize', {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email,
        instagram: form.instagram,
        dateOfBirth: form.dateOfBirth,
        state: form.state,
        nationality: form.nationality,
        address: form.address,
        experienceLevel: form.experienceLevel,
        emergencyContactName: form.emergencyContactName,
        emergencyContact: form.emergencyContact,
        ticketType: form.ticketType,
        quantity: form.quantity,
        reason: form.reason,
        hearAbout: form.hearAbout,
        photoBase64: profilePhoto || undefined,
      })
      setLoading(false)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <section className="shadow-lg relative overflow-hidden bg-gradient-to-br from-rose-dark via-rose to-gold">
        <img src="/images/carousel/event.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/70 to-black/40" />
        <div className="container py-8 md:py-10 text-center relative">
          <Reveal variant="up">
            <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight mb-2">
              3-Days Beginner Makeup Class
            </h1>
            <p className="text-amber-300 text-base md:text-lg font-semibold mb-3">4th – 6th February 2027</p>
            <p className="inline-block text-white text-sm md:text-base font-semibold tracking-[0.15em] uppercase">
              Registration / Ticket Purchase
            </p>
            <p className="mt-2 text-white/85 text-sm md:text-base">Hosted by Shawty</p>
          </Reveal>
        </div>
        <div className="relative border-t border-white/10 bg-black/45 py-3 overflow-hidden">
          <div className="marquee">
            <div className="marquee-track items-center text-white/90">
              <span className="px-6 text-sm md:text-base font-medium tracking-wide">
                Please ensure you use a valid email address as tickets will be delivered to you via your email. Thank you! ✦
              </span>
              <span className="px-6 text-sm md:text-base font-medium tracking-wide">
                Please ensure you use a valid email address as tickets will be delivered to you via your email. Thank you! ✦
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="container section-pad grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-10 items-start min-w-0">
        {/* FORM */}
        <Reveal variant="up">
        <form onSubmit={handleManualRegister} className="card p-6 sm:p-8 min-w-0">
          <h2 className="font-display text-xl md:text-2xl font-bold mb-5">
            Provide the following Info
          </h2>

          {success && !loading && (
            <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm flex items-start gap-2">
              <CircleCheck size={20} className="shrink-0" />
              <div>
                <strong>Thank you!</strong> Your registration has been received. If you completed
                payment, we’ll confirm your seat shortly. For bank transfer, use the confirmation
                details provided after your payment.
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <CircleAlert size={20} className="shrink-0" />
              {error}
            </div>
          )}

          {configError && (
            <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
              <CreditCard size={20} className="shrink-0" />
              {configError} Your registration can still be submitted and we’ll confirm payment separately.
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-5 min-w-0">
            <div className="min-w-0">
              <label className="field-label">Full Name *</label>
              <input className="input-field" value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)} required placeholder="Jane Doe" />
            </div>
            <div className="min-w-0">
              <label className="field-label">Phone Number *</label>
              <PhoneInput value={form.phone} onChange={(v) => update('phone', v)} />
            </div>
            <div className="min-w-0">
              <label className="field-label">Email Address *</label>
              <input type="email" className="input-field" value={form.email}
                onChange={(e) => update('email', e.target.value)} required placeholder="you@email.com" />
            </div>
            <div className="min-w-0">
              <label className="field-label">Instagram Handle</label>
              <input className="input-field" value={form.instagram}
                onChange={(e) => update('instagram', e.target.value)} placeholder="@yourhandle" />
            </div>
            <div className="min-w-0">
              <label className="field-label">Date of Birth *</label>
              <input type="date" className="input-field" value={form.dateOfBirth}
                onChange={(e) => update('dateOfBirth', e.target.value)} required />
            </div>
            <div className="min-w-0">
              <label className="field-label">Nationality *</label>
              {form.nationality && !nationalityNames.includes(form.nationality) ? (
                <input className="input-field" value={form.nationality === 'Other' ? '' : form.nationality}
                  onChange={(e) => { update('state', ''); update('nationality', e.target.value) }}
                  required placeholder="Type your nationality (e.g. Tanzanian)" autoFocus />
              ) : (
                <select className="input-field w-full min-w-0" value={form.nationality}
                  onChange={(e) => { update('state', ''); update('nationality', e.target.value) }} required>
                  <option value="">Select nationality</option>
                  {nationalityNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  <option value="Other">Other</option>
                </select>
              )}
            </div>
            <div className="min-w-0">
              <label className="field-label">State of Residence *</label>
              {nationalities[form.nationality] ? (
                <select className="input-field w-full min-w-0" value={form.state}
                  onChange={(e) => update('state', e.target.value)} required>
                  <option value="">Select state</option>
                  {nationalities[form.nationality].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input className="input-field" value={form.state}
                  onChange={(e) => update('state', e.target.value)} required placeholder="Type your state / region" />
              )}
            </div>
            <div className="sm:col-span-2 min-w-0">
              <label className="field-label">Address *</label>
              <input className="input-field" value={form.address}
                onChange={(e) => update('address', e.target.value)} required placeholder="Street, area, city" />
            </div>
            <div className="min-w-0">
              <label className="field-label">Makeup Experience Level *</label>
              <select className="input-field w-full min-w-0" value={form.experienceLevel}
                onChange={(e) => update('experienceLevel', e.target.value)} required>
                <option value="">Select level</option>
                {experienceOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="min-w-0">
              <label className="field-label">Emergency Contact Number *</label>
              <PhoneInput
                value={form.emergencyContact}
                onChange={(v) => {
                  setSameAsPhone(false)
                  update('emergencyContact', v)
                }}
              />
              <label className="flex items-center gap-2 mt-2 text-xs text-ink/75 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sameAsPhone}
                  onChange={(e) => {
                    const on = e.target.checked
                    setSameAsPhone(on)
                    if (on) update('emergencyContact', form.phone)
                  }}
                  className="accent-rose w-4 h-4"
                />
                Same as Phone Number
              </label>
            </div>
            <div className="min-w-0">
              <label className="field-label">Emergency Contact Name *</label>
              <input
                className="input-field"
                value={form.emergencyContactName}
                onChange={(e) => {
                  setSameAsName(false)
                  update('emergencyContactName', e.target.value)
                }}
                required
                placeholder="Name of emergency contact"
              />
              <label className="flex items-center gap-2 mt-2 text-xs text-ink/75 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sameAsName}
                  onChange={(e) => {
                    const on = e.target.checked
                    setSameAsName(on)
                    if (on) update('emergencyContactName', form.fullName)
                  }}
                  className="accent-rose w-4 h-4"
                />
                Same as Full Name
              </label>
            </div>
            <div className="sm:col-span-2 min-w-0">
              <label className="field-label">What do you hope to learn from this program? *</label>
              <textarea className="input-field" rows={3} value={form.reason}
                onChange={(e) => update('reason', e.target.value)} required placeholder="Tell us what you'd love to take away from the class" />
            </div>
            <div className="sm:col-span-2 min-w-0">
              <label className="field-label">How did you hear about the program? *</label>
              <select className="input-field w-full min-w-0" value={form.hearAbout}
                onChange={(e) => update('hearAbout', e.target.value)} required>
                <option value="">Select an option</option>
                {hearOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2 min-w-0">
              <label className="field-label">Profile Photo * (under 1.5MB)</label>
              <div className="flex items-center gap-4">
                <label className="flex-1 cursor-pointer min-w-0">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { setPhotoInvalid(''); handlePhoto(e.target.files?.[0]) }}
                  />
                  <div className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-6 text-sm transition-colors ${profilePhoto ? 'border-rose bg-rose/5 text-rose-dark' : 'border-ink/20 text-muted hover:border-rose/40 hover:text-rose-dark'}`}>
                    {profilePhoto ? <CircleCheck size={18} /> : <ImageIcon size={18} />}
                    {profilePhoto ? 'Photo attached — tap to change' : 'Tap to upload a photo (required)'}
                  </div>
                </label>
                {profilePhoto && (
                  <img src={profilePhoto} alt="preview" className="w-16 h-16 rounded-xl object-cover border border-black/10 shrink-0" />
                )}
              </div>
              {photoInvalid && <p className="text-xs text-red-600 mt-1">{photoInvalid}</p>}
              {!profilePhoto && <p className="text-xs text-muted mt-1">A recent photo is required to verify your identity at the venue.</p>}
            </div>

            <div className="sm:col-span-2">
              <label className="field-label">Ticket Type *</label>
              <div className="grid sm:grid-cols-2 gap-3">
                {tickets.map((t) => (
                  <label key={t.id} className="cursor-pointer block h-full">
                    <input
                      type="radio"
                      name="ticketType"
                      value={t.id}
                      checked={form.ticketType === t.id}
                      onChange={() => update('ticketType', t.id)}
                      className="sr-only"
                      required
                    />
                    <TicketCard t={t} now={now} showRadio selected={form.ticketType === t.id} className="h-full" />
                  </label>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="field-label">Quantity *</label>
              <input type="number" min={1} max={10} className="input-field w-full sm:max-w-44" value={form.quantity}
                onChange={(e) => update('quantity', Math.max(1, Number(e.target.value)))}
                placeholder="Number of tickets" />
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-black/8">
            <div className="flex items-center justify-between text-sm text-muted mb-1">
              <span>Ticket amount ({form.quantity} × {formatNgn(selectedPrice)})</span>
              <span>{formatNgn(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-muted mb-3">
              <span>Processing fee (1.5% + ₦100)</span>
              <span>{formatNgn(processingFee)}</span>
            </div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-ink/70">Total</span>
              <span className="font-display text-2xl font-bold">{formatNgn(total)}</span>
            </div>
            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? <><LoaderCircle size={18} className="animate-spin" /> Processing…</> : 'Proceed to Payment'}
            </button>
            <p className="text-xs text-muted text-center mt-3">
              Secure payment via Paystack. {config?.paystackEnabled ? '' : 'If payment isn’t available yet, your registration will still be recorded.'}
            </p>
          </div>
        </form>
        </Reveal>

        {/* SUMMARY SIDEBAR */}
        <Reveal variant="right" delay={150}>
        <aside className="space-y-6 min-w-0">
          <div className="card p-6 card-hover">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="flex items-center justify-between text-sm mb-2">
              <span>{selected.label}</span>
              <span className="text-muted">× {form.quantity}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span>Ticket amount</span>
              <span>{formatNgn(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-4">
              <span>Processing fee (1.5% + ₦100)</span>
              <span>{formatNgn(processingFee)}</span>
            </div>
            <div className="flex items-center justify-between text-sm font-semibold border-t border-black/8 pt-3">
              <span>Total</span>
              <span>{formatNgn(total)}</span>
            </div>
            <ul className="space-y-2 text-sm text-ink/70 border-t border-black/8 pt-4">
              {selected.includes.map((inc) => (
                <li key={inc} className="flex items-start gap-2">
                  <CircleCheck className="text-rose shrink-0 mt-0.5" size={15} />
                  {inc}
                </li>
              ))}
            </ul>
          </div>

          <div className="card p-6 bg-blush border-rose/20 card-hover">
            <h4 className="font-semibold mb-2">Good to know</h4>
            <ul className="space-y-2 text-sm text-ink/75">
              <li>• The venue is disclosed to registered students after ticket purchase.</li>
              <li>• Bring your own makeup products and tools.</li>
              <li>• Morning (9:00 AM) and Evening (3:00 PM) sections available.</li>
            </ul>
          </div>
        </aside>
        </Reveal>
      </div>
    </div>
  )
}


