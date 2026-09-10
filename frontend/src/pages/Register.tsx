import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { CircleCheck, LoaderCircle, CreditCard, Image as ImageIcon, ArrowRight, ArrowLeft } from 'lucide-react'
import { formatNgn, nationalities, nationalityNames, defaultEvent, type StudioEvent } from '../lib/constants'
import { resolveRegisterEvent, ticketPrice } from '../lib/events'
import { postJson } from '../lib/api'
import { fetchPaystackConfig, loadPaystackScript, type PaystackConfig } from '../lib/paystack'
import { useToast } from '../components/Toasts'
import PhoneInput from '../components/PhoneInput'
import Reveal from '../components/Reveal'
import TicketCard from '../components/TicketCard'
import { isValidPhone, phoneErrorMessage } from '../lib/phone'

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
  ticketType: string
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

const STORAGE_KEY = 'shawyty_register_draft_v1'

interface Draft {
  form: FormState
  sameAsPhone: boolean
  sameAsName: boolean
  profilePhoto: string
  step: 'form' | 'review'
}

function loadDraft(): Partial<Draft> | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Partial<Draft>) : null
  } catch {
    return null
  }
}

function saveDraft(d: Draft) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(d))
  } catch {
    /* storage may be unavailable — ignore */
  }
}

function clearDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export default function Register() {
  const [searchParams] = useSearchParams()
  const ticketParam = searchParams.get('ticket')
  const eventParam = searchParams.get('event')

  const [ev, setEv] = useState<StudioEvent>(defaultEvent)
  const draft = useMemo(() => loadDraft(), [])
  const [form, setForm] = useState<FormState>(() => {
    const base = draft?.form ? { ...initial, ...draft.form } : { ...initial }
    const valid = defaultEvent.tickets.some((t) => t.id === ticketParam)
    if (valid) base.ticketType = ticketParam!
    return base
  })
  const [config, setConfig] = useState<PaystackConfig | null>(null)
  const [configError, setConfigError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [step, setStep] = useState<'form' | 'review'>(draft?.step ?? 'form')
  const [transitioning, setTransitioning] = useState(false)
  const scrollAfterStepRef = useRef(false)
  const formRef = useRef<HTMLFormElement>(null)
  const reviewRef = useRef<HTMLDivElement>(null)
  const loaderRef = useRef<HTMLDivElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const [now, setNow] = useState(() => Date.now())
  const [sameAsPhone, setSameAsPhone] = useState(draft?.sameAsPhone ?? false)
  const [sameAsName, setSameAsName] = useState(draft?.sameAsName ?? false)
  const [profilePhoto, setProfilePhoto] = useState(draft?.profilePhoto ?? '')
  const [photoInvalid, setPhotoInvalid] = useState('')
  const toast = useToast()
  const navigate = useNavigate()

  // Resolve the event: honor ?event=, otherwise the live event
  useEffect(() => {
    let active = true
    ;(async () => {
      const resolved = await resolveRegisterEvent(eventParam)
      if (!active) return
      setEv(resolved)
      setForm((f) => {
        const fresh = { ...f }
        if (ticketParam && resolved.tickets.some((t) => t.id === ticketParam)) {
          fresh.ticketType = ticketParam
        }
        if (!resolved.tickets.some((t) => t.id === fresh.ticketType)) {
          fresh.ticketType = resolved.tickets[0]?.id || initial.ticketType
        }
        return fresh
      })
    })()
    return () => {
      active = false
    }
  }, [eventParam, ticketParam])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    saveDraft({ form, sameAsPhone, sameAsName, profilePhoto, step })
  }, [form, sameAsPhone, sameAsName, profilePhoto, step])

  useEffect(() => {
    fetchPaystackConfig().then(setConfig).catch(() => {
      setConfigError('Payment may not be configured yet.')
    })
  }, [])

  useEffect(() => {
    if (success && !loading) {
      const t = window.setTimeout(() => {
        successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 80)
      return () => window.clearTimeout(t)
    }
  }, [success, loading])

  const tickets = ev.tickets
  const selected = tickets.find((t) => t.id === form.ticketType) ?? tickets[0]
  const selectedPrice = selected ? ticketPrice(selected, now) : 0
  const subtotal = selectedPrice * form.quantity
  const processingFee = Math.round(subtotal * PROCESSING_FEE_RATE) + PROCESSING_FEE_BASE
  const total = subtotal + processingFee
  const ended = ev.status === 'finished'

  // Redirect away from finished events — registration is closed
  if (ended) {
    useEffect(() => {
      navigate('/program')
    }, [navigate])
    return null
  }

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  type FieldKey = keyof FormState
  type Errors = Partial<Record<FieldKey | 'photo', string>>
  const [errors, setErrors] = useState<Errors>({})
  const [touched, setTouched] = useState<Partial<Record<FieldKey | 'photo', boolean>>>({})

  function validateField(k: FieldKey): string {
    const v = String(form[k])
    switch (k) {
      case 'fullName': return v.trim() ? '' : 'Please enter your full name'
      case 'phone': return phoneErrorMessage(v) || ''
      case 'email': return /^\S+@\S+\.\S+$/.test(v) ? '' : 'Please enter a valid email address'
      case 'dateOfBirth': return v ? '' : 'Select your date of birth'
      case 'nationality': return v ? '' : 'Select your nationality'
      case 'state': return v.trim() ? '' : 'State of residence is required'
      case 'address': return v.trim() ? '' : 'Please enter your address'
      case 'experienceLevel': return v ? '' : 'Select your experience level'
      case 'emergencyContactName': return sameAsName || v.trim() ? '' : 'Emergency contact name is required'
      case 'emergencyContact': return !v ? '' : isValidPhone(v) ? '' : 'Please enter a valid emergency contact number'
      case 'reason': return v.trim() ? '' : 'Tell us what you hope to learn'
      case 'hearAbout': return v ? '' : 'Select how you heard about the program'
      case 'quantity': return Number(v) >= 1 && Number(v) <= 10 ? '' : 'Quantity must be between 1 and 10'
      default: return ''
    }
  }

  function showError(k: FieldKey | 'photo'): string {
    return errors[k] && touched[k] ? (errors[k] as string) : ''
  }

  function touch(k: FieldKey | 'photo') {
    setTouched((t) => ({ ...t, [k]: true }))
    setErrors((e) => {
      const msg = k === 'photo' ? (profilePhoto ? '' : 'Please upload a profile photo') : validateField(k)
      return e[k] === msg ? e : { ...e, [k]: msg }
    })
  }

  function change(k: FieldKey, v: FormState[FieldKey]) {
    update(k, v)
    if (touched[k]) {
      setErrors((e) => {
        const msg = validateField(k)
        return e[k] === msg ? e : { ...e, [k]: msg }
      })
    }
  }

  function touchedCls(k: FieldKey): string {
    return showError(k) ? ' !border-red-400' : ''
  }

  function fieldErr(k: FieldKey | 'photo') {
    const m = showError(k)
    return m ? <p className="text-xs text-red-600 mt-1">{m}</p> : null
  }

  function scrollToEl(el: HTMLElement | null) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      })
    })
  }

  useEffect(() => {
    if (transitioning) {
      scrollToEl(loaderRef.current)
    }
  }, [transitioning])

  useEffect(() => {
    if (scrollAfterStepRef.current && step === 'review' && !transitioning) {
      scrollAfterStepRef.current = false
      scrollToEl(reviewRef.current)
    }
  }, [step, transitioning])

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

  function validateContactInfo(): boolean {
    const phoneErr = phoneErrorMessage(form.phone)
    if (phoneErr) {
      toast.push(phoneErr, 'err')
      return false
    }
    if (form.emergencyContact && !isValidPhone(form.emergencyContact)) {
      toast.push('Please enter a valid emergency contact number with its country code', 'err')
      return false
    }
    return true
  }

  async function handlePayWithPaystack() {
    if (!validateContactInfo()) return
    setLoading(true)
    if (!profilePhoto) {
      toast.push('Please upload a profile photo to complete your registration.', 'err')
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
        eventId: ev.id,
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
      toast.push(err.message || 'Something went wrong. Please try again.', 'err')
      setLoading(false)
    }
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    const all: FieldKey[] = [
      'fullName', 'phone', 'email', 'dateOfBirth', 'nationality', 'state',
      'address', 'experienceLevel', 'emergencyContactName', 'emergencyContact',
      'reason', 'hearAbout', 'quantity',
    ]
    const next: Errors = {}
    all.forEach((k) => {
      const m = validateField(k)
      if (m) next[k] = m
    })
    if (!profilePhoto) next.photo = 'Please upload a profile photo'
    setErrors(next)
    setTouched(Object.fromEntries(all.map((k) => [k, true])) as Partial<Record<FieldKey | 'photo', boolean>>)
    setTouched((t) => ({ ...t, photo: true }))
    if (Object.keys(next).length > 0) {
      scrollToEl(formRef.current)
      return
    }
    setStep('review')
    scrollAfterStepRef.current = true
    setTransitioning(true)
    window.setTimeout(() => setTransitioning(false), 1500)
  }

  function handleBack() {
    setStep('form')
    scrollToEl(formRef.current)
  }

  async function handleProceedToPayment() {
    setLoading(true)
    try {
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
        eventId: ev.id,
      })
      clearDraft()
      setLoading(false)
      setSuccess(true)
      setStep('form')
    } catch (err: any) {
      toast.push(err.message || 'Something went wrong. Please try again.', 'err')
      setLoading(false)
    }
  }

  const details = [
    { label: 'Full Name', value: form.fullName },
    { label: 'Phone Number', value: form.phone },
    { label: 'Email Address', value: form.email },
    { label: 'Instagram Handle', value: form.instagram || '—' },
    { label: 'Date of Birth', value: form.dateOfBirth },
    { label: 'Nationality', value: form.nationality },
    { label: 'State of Residence', value: form.state },
    { label: 'Address', value: form.address },
    { label: 'Makeup Experience Level', value: form.experienceLevel },
    { label: 'Emergency Contact', value: form.emergencyContactName ? `${form.emergencyContactName} — ${form.emergencyContact || '—'}` : '—' },
    { label: 'What you hope to learn', value: form.reason },
    { label: 'How did you hear about it', value: form.hearAbout },
  ]

  return (
    <div>
      <section className="shadow-lg relative overflow-hidden bg-gradient-to-br from-rose-deep via-rose-dark via-45% to-pinkgold">
        <img src="/images/carousel/event.jpg" alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#2f0f19]/95 via-[#6a2a3d]/80 to-[#8a3547]/60" />
        <div className="container py-8 md:py-10 text-center relative">
          <Reveal variant="up">
            <h1 className="font-display text-3xl md:text-5xl font-bold text-white leading-tight mb-2">
              {ev.title}
            </h1>
            <p className="text-pinkgold text-base md:text-lg font-semibold mb-3">{ev.datesLabel}</p>
            <p className="inline-block text-white text-sm md:text-base font-semibold tracking-[0.15em] uppercase">
              {ended ? 'Past Event · This Event Has Ended' : 'Registration / Ticket Purchase'}
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

      <div className={`container section-pad ${ended ? 'max-w-3xl' : 'max-w-4xl'} items-start`}>
        {ended ? (
          <>
            <Reveal variant="up">
              <div className="card p-8 sm:p-12 text-center overflow-hidden relative">
                <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] bg-[#7a3045]/8 text-[#7a3045] px-4 py-1.5 rounded-full mb-6">
                  Past Event · Registration Closed
                </span>
                <h2 className="font-display text-3xl md:text-4xl font-bold leading-tight">This event has ended</h2>
                <p className="text-ink/70 text-base md:text-lg mt-4 max-w-xl mx-auto leading-relaxed">
                  Thanks for stopping by — the {ev.title} is finished. Keep an eye out for our next
                  happening; we can’t wait to have you in the studio.
                </p>
                <p className="text-muted text-sm mt-3">
                  <span className="font-semibold text-rose-deep">Coming soon:</span> watch this space for
                  future events, dates and ticketing.
                </p>
                <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
                  <Link to="/program" className="btn btn-outline">See our events <ArrowRight size={16} /></Link>
                  <Link to="/services" className="btn btn-primary">Explore services <ArrowRight size={16} /></Link>
                </div>
              </div>
            </Reveal>
          </>
        ) : transitioning ? (
        <Reveal variant="up">
          <div ref={loaderRef} className="card p-12 sm:p-16 text-center scroll-mt-24 min-w-0 flex flex-col items-center justify-center gap-5" aria-live="polite">
            <span className="relative w-20 h-20">
              <span className="absolute inset-0 rounded-full border-4 border-rose/15 border-t-rose animate-spin" />
              <span className="absolute inset-2 rounded-full bg-gradient-to-br from-rose to-rose-deep flex items-center justify-center text-white font-display text-3xl font-bold">
                S
              </span>
            </span>
            <p className="text-ink/80 font-medium">Preparing your registration…</p>
            <p className="text-xs text-muted">Just a moment while we get everything ready.</p>
          </div>
        </Reveal>
        ) : step === 'review' ? (
        <Reveal variant="up">
        <div ref={reviewRef} className="card p-6 sm:p-8 min-w-0 scroll-mt-24">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-bold">Confirm Your Details</h2>
              <p className="text-sm text-muted mt-1">Review everything below before proceeding to payment.</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose border border-rose/30 bg-rose/5 rounded-full px-3 py-1.5">
              Step 2 of 2
            </span>
          </div>

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 min-w-0">
            {details.map((d) => (
              <div key={d.label} className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{d.label}</p>
                <p className="text-sm text-ink/90 mt-0.5 break-words">{d.value}</p>
              </div>
            ))}
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Profile Photo</p>
              {profilePhoto ? (
                <img src={profilePhoto} alt="preview" className="w-16 h-16 rounded-xl object-cover border border-[#321d24]/15 mt-1" />
              ) : (
                <p className="text-sm text-red-600 mt-1">Missing — go back and upload a photo</p>
              )}
            </div>
          </div>

          <div className="mt-7 pt-6 border-t border-[#321d24]/10">
            <h3 className="font-semibold mb-3">Order Summary</h3>
            {selected && (
              <div className="flex items-center justify-between text-sm mb-2">
                <span>{selected.label} × {form.quantity}</span>
                <span className="text-muted">{formatNgn(subtotal)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm mb-2 text-muted">
              <span>Processing fee (1.5% + ₦100)</span>
              <span>{formatNgn(processingFee)}</span>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#321d24]/10">
              <span className="text-ink/70">Total</span>
              <span className="font-display text-2xl font-bold">{formatNgn(total)}</span>
            </div>
          </div>

          {selected && selected.includes.length > 0 && (
            <div className="mt-7 pt-6 border-t border-[#321d24]/10">
              <h3 className="font-semibold mb-3">What's included</h3>
              <ul className="space-y-2 text-sm text-ink/70">
                {selected.includes.map((inc) => (
                  <li key={inc} className="flex items-start gap-2">
                    <CircleCheck className="text-rose shrink-0 mt-0.5" size={15} />
                    {inc}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(ev.venueNote || ev.bring || ev.timeLabel) && (
            <div className="mt-7 pt-6 border-t border-[#321d24]/10">
              <h3 className="font-semibold mb-3">Good to know</h3>
              <ul className="space-y-2 text-sm text-ink/75">
                {ev.venueNote && <li>• {ev.venueNote}</li>}
                {ev.bring && <li>• {ev.bring}</li>}
                {ev.timeLabel && <li>• Sessions at: {ev.timeLabel}</li>}
              </ul>
            </div>
          )}

          <div className="mt-8 flex flex-row items-stretch gap-2">
            <button type="button" onClick={handleBack} className="btn btn-outline flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[11px] whitespace-nowrap sm:text-[13px] sm:px-2 sm:py-2.5">
              <ArrowLeft size={13} /> Back to Edit
            </button>
            <button type="button" onClick={handleProceedToPayment} disabled={loading} className="btn btn-primary flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[11px] whitespace-nowrap sm:text-[13px] sm:px-2 sm:py-2.5">
              {loading ? <><LoaderCircle size={13} className="animate-spin" /> Processing…</> : "Proceed to Payment"}
            </button>
          </div>
          <p className="text-xs text-muted text-center mt-3">
            Secure payment via Paystack. {config?.paystackEnabled ? '' : 'If payment isn’t available yet, your registration will still be recorded.'}
          </p>
        </div>
        </Reveal>
        ) : (
        <>
        {/* FORM */}
        <Reveal variant="up">
        <form ref={formRef} onSubmit={handleNext} className="card p-6 sm:p-8 min-w-0 scroll-mt-24">
          <div className="flex items-start justify-between gap-4 mb-5">
            <h2 className="font-display text-xl md:text-2xl font-bold">
              Provide the following Info
            </h2>
            <span className="hidden sm:inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-rose border border-rose/30 bg-rose/5 rounded-full px-3 py-1.5">
              Step 1 of 2
            </span>
          </div>

          {success && !loading && (
            <div ref={successRef} className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm flex items-start gap-2 scroll-mt-24">
              <CircleCheck size={20} className="shrink-0" />
              <div>
                <strong>Thank you!</strong> Your registration has been received. If you completed
                payment, we’ll confirm your seat shortly. For bank transfer, use the confirmation
                details provided after your payment.
              </div>
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
              <input className={`input-field${touchedCls('fullName')}`} value={form.fullName}
                onChange={(e) => change('fullName', e.target.value)} onBlur={() => touch('fullName')} placeholder="Jane Doe" />
              {fieldErr('fullName')}
            </div>
            <div className="min-w-0" onBlur={() => touch('phone')}>
              <label className="field-label">Phone Number *</label>
              <PhoneInput value={form.phone} onChange={(v) => change('phone', v)} />
              {fieldErr('phone')}
            </div>
            <div className="min-w-0">
              <label className="field-label">Email Address *</label>
              <input type="email" className={`input-field${touchedCls('email')}`} value={form.email}
                onChange={(e) => change('email', e.target.value)} onBlur={() => touch('email')} placeholder="you@email.com" />
              {fieldErr('email')}
            </div>
            <div className="min-w-0">
              <label className="field-label">Instagram Handle</label>
              <input className="input-field" value={form.instagram}
                onChange={(e) => update('instagram', e.target.value)} placeholder="@yourhandle" />
            </div>
            <div className="min-w-0">
              <label className="field-label">Date of Birth *</label>
              <input type="date" className={`input-field${touchedCls('dateOfBirth')}`} value={form.dateOfBirth}
                onChange={(e) => change('dateOfBirth', e.target.value)} onBlur={() => touch('dateOfBirth')} />
              {fieldErr('dateOfBirth')}
            </div>
            <div className="min-w-0">
              <label className="field-label">Nationality *</label>
              {form.nationality && !nationalityNames.includes(form.nationality) ? (
                <input className={`input-field${touchedCls('nationality')}`} value={form.nationality === 'Other' ? '' : form.nationality}
                  onChange={(e) => { update('state', ''); change('nationality', e.target.value) }}
                  onBlur={() => touch('nationality')}
                  placeholder="Type your nationality (e.g. Tanzanian)" autoFocus />
              ) : (
                <select className={`input-field w-full min-w-0${touchedCls('nationality')}`} value={form.nationality}
                  onChange={(e) => { update('state', ''); change('nationality', e.target.value) }} onBlur={() => touch('nationality')}>
                  <option value="">Select nationality</option>
                  {nationalityNames.map((n) => <option key={n} value={n}>{n}</option>)}
                  <option value="Other">Other</option>
                </select>
              )}
              {fieldErr('nationality')}
            </div>
            <div className="min-w-0">
              <label className="field-label">State of Residence *</label>
              {nationalities[form.nationality] ? (
                <select className={`input-field w-full min-w-0${touchedCls('state')}`} value={form.state}
                  onChange={(e) => change('state', e.target.value)} onBlur={() => touch('state')}>
                  <option value="">Select state</option>
                  {nationalities[form.nationality].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <input className={`input-field${touchedCls('state')}`} value={form.state}
                  onChange={(e) => change('state', e.target.value)} onBlur={() => touch('state')} placeholder="Type your state / region" />
              )}
              {fieldErr('state')}
            </div>
            <div className="sm:col-span-2 min-w-0">
              <label className="field-label">Address *</label>
              <input className={`input-field${touchedCls('address')}`} value={form.address}
                onChange={(e) => change('address', e.target.value)} onBlur={() => touch('address')} placeholder="Street, area, city" />
              {fieldErr('address')}
            </div>
            <div className="min-w-0">
              <label className="field-label">Makeup Experience Level *</label>
              <select className={`input-field w-full min-w-0${touchedCls('experienceLevel')}`} value={form.experienceLevel}
                onChange={(e) => change('experienceLevel', e.target.value)} onBlur={() => touch('experienceLevel')}>
                <option value="">Select level</option>
                {experienceOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              {fieldErr('experienceLevel')}
            </div>
            <div className="min-w-0" onBlur={() => touch('emergencyContact')}>
              <label className="field-label">Emergency Contact Number *</label>
              <PhoneInput
                value={form.emergencyContact}
                onChange={(v) => {
                  setSameAsPhone(false)
                  change('emergencyContact', v)
                }}
              />
              {fieldErr('emergencyContact')}
              <label className="flex items-center gap-2 mt-2 text-xs text-ink/75 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sameAsPhone}
                  onChange={(e) => {
                    const on = e.target.checked
                    setSameAsPhone(on)
                    if (on) {
                      update('emergencyContact', form.phone)
                      setTouched((t) => ({ ...t, emergencyContact: true }))
                      setErrors((er) => ({ ...er, emergencyContact: '' }))
                    }
                  }}
                  className="accent-rose w-4 h-4"
                />
                Same as Phone Number
              </label>
            </div>
            <div className="min-w-0">
              <label className="field-label">Emergency Contact Name *</label>
              <input
                className={`input-field${touchedCls('emergencyContactName')}`}
                value={form.emergencyContactName}
                onChange={(e) => {
                  setSameAsName(false)
                  change('emergencyContactName', e.target.value)
                }}
                onBlur={() => touch('emergencyContactName')}
                placeholder="Name of emergency contact"
              />
              {fieldErr('emergencyContactName')}
              <label className="flex items-center gap-2 mt-2 text-xs text-ink/75 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={sameAsName}
                  onChange={(e) => {
                    const on = e.target.checked
                    setSameAsName(on)
                    if (on) {
                      update('emergencyContactName', form.fullName)
                      setTouched((t) => ({ ...t, emergencyContactName: true }))
                      setErrors((er) => ({ ...er, emergencyContactName: '' }))
                    }
                  }}
                  className="accent-rose w-4 h-4"
                />
                Same as Full Name
              </label>
            </div>
            <div className="sm:col-span-2 min-w-0">
              <label className="field-label">What do you hope to learn from this program? *</label>
              <textarea className={`input-field${touchedCls('reason')}`} rows={3} value={form.reason}
                onChange={(e) => change('reason', e.target.value)} onBlur={() => touch('reason')} placeholder="Tell us what you'd love to take away from the class" />
              {fieldErr('reason')}
            </div>
            <div className="sm:col-span-2 min-w-0">
              <label className="field-label">How did you hear about the program? *</label>
              <select className={`input-field w-full min-w-0${touchedCls('hearAbout')}`} value={form.hearAbout}
                onChange={(e) => change('hearAbout', e.target.value)} onBlur={() => touch('hearAbout')}>
                <option value="">Select an option</option>
                {hearOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
              {fieldErr('hearAbout')}
            </div>

            <div className="sm:col-span-2 min-w-0">
              <label className="field-label">Profile Photo * (under 1.5MB)</label>
              <div className="flex items-center gap-4">
                <label className="flex-1 cursor-pointer min-w-0">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { setPhotoInvalid(''); setTouched((t) => ({ ...t, photo: true })); handlePhoto(e.target.files?.[0]) }}
                  />
                  <div className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-6 text-sm transition-colors ${profilePhoto ? 'border-rose bg-rose/5 text-rose-dark' : showError('photo') || photoInvalid ? 'border-red-400 text-red-600' : 'border-ink/20 text-muted hover:border-rose/40 hover:text-rose-dark'}`}>
                    {profilePhoto ? <CircleCheck size={18} /> : <ImageIcon size={18} />}
                    {profilePhoto ? 'Photo attached — tap to change' : 'Tap to upload a photo (required)'}
                  </div>
                </label>
                {profilePhoto && (
                  <img src={profilePhoto} alt="preview" className="w-16 h-16 rounded-xl object-cover border border-[#321d24]/15 shrink-0" />
                )}
              </div>
              {photoInvalid && <p className="text-xs text-red-600 mt-1">{photoInvalid}</p>}
              {fieldErr('photo')}
              {!profilePhoto && !photoInvalid && <p className="text-xs text-muted mt-1">A recent photo is required to verify your identity at the venue.</p>}
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
                    />
                    <TicketCard t={t} now={now} showRadio selected={form.ticketType === t.id} className="h-full" />
                  </label>
                ))}
              </div>
              {selected && (
                <p className="mt-3 text-sm text-red-600 font-bold uppercase flex items-center gap-1.5">
                  <CircleCheck size={15} className="text-red-500" /> {selected.label.toUpperCase()} TICKET SELECTED
                </p>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="field-label">Quantity *</label>
              <input type="number" min={1} max={10} className={`input-field w-full sm:max-w-44${touchedCls('quantity')}`} value={form.quantity}
                onChange={(e) => change('quantity', Math.max(1, Number(e.target.value)))}
                onBlur={() => touch('quantity')}
                placeholder="Number of tickets" />
              {fieldErr('quantity')}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[#321d24]/10">
            <button type="submit" className="btn btn-primary w-full">
              Next <ArrowRight size={18} />
            </button>
          </div>
        </form>
        </Reveal>
        </>
        )}
      </div>
    </div>
  )
}