import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, LoaderCircle, CreditCard, CircleAlert, Timer } from 'lucide-react'
import { formatNgn, nationalities, nationalityNames, tickets, type Ticket } from '../lib/constants'
import { postJson } from '../lib/api'
import { fetchPaystackConfig, loadPaystackScript, type PaystackConfig } from '../lib/paystack'
import PhoneInput from '../components/PhoneInput'

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
  emergencyContact: '',
  ticketType: 'student',
  quantity: 1,
  reason: '',
  hearAbout: '',
}

const experienceOptions = ['None / Beginner', 'Some experience', 'Intermediate', 'Advanced']
const hearOptions = ['Instagram', 'Facebook', 'WhatsApp', 'Friend / Word of mouth', 'Flyer / Advert', 'Other']

export default function Register() {
  const [form, setForm] = useState<FormState>(initial)
  const [config, setConfig] = useState<PaystackConfig | null>(null)
  const [configError, setConfigError] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const navigate = useNavigate()

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const earlyBirdDeadline = new Date('2026-12-31T23:59:59').getTime()
  const earlyBirdExpired = now >= earlyBirdDeadline
  const remaining = Math.max(0, earlyBirdDeadline - now)

  useEffect(() => {
    if (earlyBirdExpired && form.ticketType === 'early-bird') {
      setForm((f) => ({ ...f, ticketType: 'student' }))
    }
  }, [earlyBirdExpired, form.ticketType])

  useEffect(() => {
    fetchPaystackConfig().then(setConfig).catch(() => {
      // Fall back to ticket data even if config endpoint fails
      setConfigError('Payment may not be configured yet.')
    })
  }, [])

  const selected = tickets.find((t) => t.id === form.ticketType)!
  const total = selected.price * form.quantity

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function handlePayWithPaystack() {
    setError('')
    setLoading(true)
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
        emergencyContact: form.emergencyContact,
        ticketType: form.ticketType,
        quantity: form.quantity,
        reason: form.reason,
        hearAbout: form.hearAbout,
      })

      // 2. Open Paystack inline checkout
      const handler = window.PaystackPop.setup({
        key: config.publicKey,
        email: form.email,
        amount: paystack.amount,
        ref: paystack.reference,
        currency: 'NGN',
        metadata: paystack.metadata,
        callback: (response: { reference: string }) => {
          // After payment, navigate to verify via callback page
          navigate(`/register/payment-callback?reference=${response.reference}`)
        },
        onClose: () => {
          setLoading(false)
          setSuccess(false)
        },
      })
// Paystack inline iframe is unreliable on phones (card/bank redirects
        // need a real tab), so open a new tab on mobile devices.
        const isMobile = window.matchMedia('(max-width: 767px)').matches
        if (isMobile) {
          handler.open()
        } else {
          handler.openIframe()
        }
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
        emergencyContact: form.emergencyContact,
        ticketType: form.ticketType,
        quantity: form.quantity,
        reason: form.reason,
        hearAbout: form.hearAbout,
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
      <section className="relative overflow-hidden bg-gradient-to-br from-rose-dark via-rose to-gold">
        <div className="container py-12 md:py-16 text-center">
          <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight mb-2">
            3-Days Beginner Makeup Class
          </h1>
          <p className="text-amber-300 text-base md:text-lg font-semibold mb-3">4th – 6th February 2027</p>
          <p className="inline-block text-white text-sm md:text-base font-semibold tracking-[0.15em] uppercase">
            Registration / Ticket Purchase
          </p>
          <p className="mt-2 text-white/85 text-sm md:text-base">Hosted by Shawty</p>
        </div>
      </section>

      <div className="container section-pad grid lg:grid-cols-[1fr_380px] gap-8 lg:gap-10 items-start">
        {/* FORM */}
        <form onSubmit={handleManualRegister} className="card p-6 sm:p-8">
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

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="field-label">Full Name *</label>
              <input className="input-field" value={form.fullName}
                onChange={(e) => update('fullName', e.target.value)} required placeholder="Jane Doe" />
            </div>
            <div>
              <label className="field-label">Phone Number *</label>
              <PhoneInput value={form.phone} onChange={(v) => update('phone', v)} />
            </div>
            <div>
              <label className="field-label">Email Address *</label>
              <input type="email" className="input-field" value={form.email}
                onChange={(e) => update('email', e.target.value)} required placeholder="you@email.com" />
            </div>
            <div>
              <label className="field-label">Instagram Handle</label>
              <input className="input-field" value={form.instagram}
                onChange={(e) => update('instagram', e.target.value)} placeholder="@yourhandle" />
            </div>
            <div>
              <label className="field-label">Date of Birth *</label>
              <input type="date" className="input-field" value={form.dateOfBirth}
                onChange={(e) => update('dateOfBirth', e.target.value)} required />
            </div>
            <div>
              <label className="field-label">Nationality *</label>
              {form.nationality && !nationalityNames.includes(form.nationality) ? (
                <input className="input-field" value={form.nationality === 'Other' ? '' : form.nationality}
                  onChange={(e) => { update('state', ''); update('nationality', e.target.value) }}
                  required placeholder="Type your nationality (e.g. Tanzanian)" autoFocus />
              ) : (
                <select className="input-field" value={form.nationality}
                  onChange={(e) => { update('state', ''); update('nationality', e.target.value) }} required>
                  <option value="">Select nationality</option>
                  {nationalityNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  <option value="Other">Other</option>
                </select>
              )}
            </div>
            <div>
              <label className="field-label">State of Residence *</label>
              {nationalities[form.nationality] ? (
                <select className="input-field" value={form.state}
                  onChange={(e) => update('state', e.target.value)} required>
                  <option value="">Select state</option>
                  {nationalities[form.nationality].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input className="input-field" value={form.state}
                  onChange={(e) => update('state', e.target.value)} required placeholder="Type your state / region" />
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Address *</label>
              <input className="input-field" value={form.address}
                onChange={(e) => update('address', e.target.value)} required placeholder="Street, area, city" />
            </div>
            <div>
              <label className="field-label">Makeup Experience Level *</label>
              <select className="input-field" value={form.experienceLevel}
                onChange={(e) => update('experienceLevel', e.target.value)} required>
                <option value="">Select level</option>
                {experienceOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Emergency Contact Number *</label>
              <PhoneInput value={form.emergencyContact} onChange={(v) => update('emergencyContact', v)} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">What do you hope to learn from this program? *</label>
              <textarea className="input-field" rows={3} value={form.reason}
                onChange={(e) => update('reason', e.target.value)} required placeholder="Tell us what you'd love to take away from the class" />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">How did you hear about the program? *</label>
              <select className="input-field" value={form.hearAbout}
                onChange={(e) => update('hearAbout', e.target.value)} required>
                <option value="">Select an option</option>
                {hearOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="field-label">Ticket Type *</label>
              <div className="grid sm:grid-cols-2 gap-3">
                {tickets.map((t) => {
                  const isEarlyBird = t.id === 'early-bird'
                  const disabled = isEarlyBird && earlyBirdExpired
                  const checked = form.ticketType === t.id
                  return (
                    <label
                      key={t.id}
                      className={`flex flex-col rounded-xl border px-4 py-3 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${checked ? 'border-rose bg-rose/5 shadow-sm' : 'border-black/10 hover:border-rose/40'}`}
                    >
                      <input
                        type="radio"
                        name="ticketType"
                        value={t.id}
                        checked={checked}
                        onChange={() => update('ticketType', t.id)}
                        disabled={disabled}
                        className="sr-only"
                        required
                      />
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${checked ? 'border-rose' : 'border-ink/30'}`}>
                            {checked && <span className="w-2 h-2 rounded-full bg-rose" />}
                          </span>
                          <span className="font-semibold text-sm">{t.label}</span>
                        </span>
                        <span className="text-sm font-bold">{formatNgn(t.price)}</span>
                      </span>
                      {isEarlyBird ? (
                        earlyBirdExpired ? (
                          <span className="text-xs font-semibold text-rose-dark mt-2 ml-6">Sales ended</span>
                        ) : (
                          <span className="text-xs font-medium mt-2 ml-6">
                            <Timer size={13} className="inline -mt-0.5 mr-1 text-rose-dark" />
                            Ends in{' '}
                            <span className="font-bold text-rose-dark tabular-nums">
                              {formatCountdown(remaining)}
                            </span>
                          </span>
                        )
                      ) : (
                        <>
                          <span className="text-xs text-muted mt-1 ml-6">
                            per {t.unitName}
                          </span>
                          {t.highlighted && (
                            <span className="text-[10px] font-bold uppercase tracking-wide bg-rose text-white px-2 py-0.5 rounded-full mt-2 ml-6 w-fit">Popular</span>
                          )}
                        </>
                      )}
                    </label>
                  )
                })}
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

        {/* SUMMARY SIDEBAR */}
        <aside className="space-y-6">
          <div className="card p-6">
            <h3 className="font-semibold mb-4">Order Summary</h3>
            <div className="flex items-center justify-between text-sm mb-2">
              <span>{selected.label}</span>
              <span className="text-muted">× {form.quantity}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-4">
              <span>Amount</span>
              <span>{formatNgn(selected.price * form.quantity)}</span>
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

          <div className="card p-6 bg-blush border-rose/20">
            <h4 className="font-semibold mb-2">Good to know</h4>
            <ul className="space-y-2 text-sm text-ink/75">
              <li>• The venue is disclosed to registered students after ticket purchase.</li>
              <li>• Bring your own makeup products and tools.</li>
              <li>• Morning (9:00 AM) and Evening (3:00 PM) sections available.</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  )
}

function formatCountdown(ms: number) {
  const s = Math.floor(ms / 1000)
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`
}
