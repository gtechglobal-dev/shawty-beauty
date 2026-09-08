import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  HeartHandshake,
  Home,
  LoaderCircle,
  ImagePlus,
  X,
  ArrowRight,
  Plus,
  Trash2,
  AtSign,
  Phone,
  MessageCircle,
} from 'lucide-react'
import { getJson, postJson } from '../lib/api'
import { fetchLiveEvent } from '../lib/events'
import PhoneInput from '../components/PhoneInput'
import Reveal from '../components/Reveal'
import Modal from '../components/Modal'
import { phoneErrorMessage, dialForNationality } from '../lib/phone'
import { nationalities, nationalityNames } from '../lib/constants'
import { optimizeLogoBase64 } from '../lib/image'
import RichText from '../lib/RichText'
import { useRealtime } from '../lib/useRealtime'

const SPONSOR_TYPE_OPTIONS = [
  'Individual',
  'Business/Company',
  'Organization',
  'NGO/Association',
  'Other',
]

const SUPPORT_AREA_OPTIONS = [
  'Makeup Training',
  'Lashes Training',
  'Student Scholarship',
  'Training Materials',
  'Beauty Equipment',
  'Event/Class Sponsorship',
  'General Support',
  'Other',
]

const SPONSORSHIP_TYPE_OPTIONS = [
  'Financial Contribution',
  'Products/Materials',
  'Equipment',
  'Professional Services',
  'Other',
]

const USAGE_PREFERENCE_OPTIONS = [
  'For a specific student',
  'For multiple students',
  'For a specific program/class',
  'For equipment or training materials',
  'Where most needed',
]

const SOCIAL_PLATFORM_OPTIONS = [
  'Instagram',
  'Facebook',
  'TikTok',
  'X (Twitter)',
  'YouTube',
  'LinkedIn',
  'Snapchat',
  'Threads',
  'WhatsApp',
]

type RecognitionChoice = '' | 'yes' | 'no'

interface SponsorCard {
  id: string
  name: string
  contactName?: string
  email: string
  website?: string
  socials?: { platform: string; handle: string }[]
  phone?: string
  logoUrl?: string
  logoBase64?: string
  state?: string
  country?: string
  address?: string
  notes?: string
  supportAreas?: string[]
  sponsorshipType?: string
}

function logoSrc(s: SponsorCard): string {
  if (s.logoUrl) return s.logoUrl
  if (s.logoBase64) {
    return s.logoBase64.startsWith('data:') ? s.logoBase64 : `data:image/png;base64,${s.logoBase64}`
  }
  return ''
}

function formatAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '')
  const [int, dec] = cleaned.split('.')
  const intDigits = (int || '').replace(/^0+(?=\d)/, '')
  const grouped = intDigits ? intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
  return dec !== undefined && dec !== '' ? `${grouped}.${dec.slice(0, 2)}` : grouped
}

export default function Sponsor() {
  const [form, setForm] = useState({
    sponsorType: '',
    fullName: '',
    phone: '',
    email: '',
    website: '',
    country: 'Nigerian',
    state: '',
    address: '',
    supportAreas: [] as string[],
    sponsorshipType: '',
    amount: '',
    usagePreference: '',
    message: '',
    publicRecognition: '' as RecognitionChoice,
    displayName: '',
  })
  const [consent, setConsent] = useState(false)
  const [socials, setSocials] = useState<{ platform: string; handle: string }[]>([{ platform: '', handle: '' }])
  const [formError, setFormError] = useState('')
  const [websiteError, setWebsiteError] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState('')
  const [eventId, setEventId] = useState('')
  const [logoBase64, setLogoBase64] = useState('')
  const [logoError, setLogoError] = useState('')
  const [sponsors, setSponsors] = useState<SponsorCard[]>([])
  const [sponsorsLoading, setSponsorsLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewSponsor, setViewSponsor] = useState<SponsorCard | null>(null)
  const [previewImage, setPreviewImage] = useState('')
  const [contactAction, setContactAction] = useState<{ name: string; phone: string } | null>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const successRef = useRef<HTMLDivElement>(null)

  function loadSponsors(silent = false) {
    if (!silent) setSponsorsLoading(true)
    return getJson('/api/sponsors')
      .then((data) => setSponsors(data.sponsors || []))
      .catch(() => setSponsors([]))
      .finally(() => setSponsorsLoading(false))
  }

  useEffect(() => {
    fetchLiveEvent().then((ev) => setEventId(ev.id)).catch(() => {})
    loadSponsors()
  }, [])

  // New/updated sponsors from the Diary land on this page in real time, with a
  // polling fallback when the socket can't connect.
  useRealtime((type) => {
    if (type === 'sponsors' || type === 'poll') loadSponsors(true)
  }, { pollMs: 30000 })

  useEffect(() => {
    if (submitted) {
      const t = window.setTimeout(() => {
        successRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
      return () => window.clearTimeout(t)
    }
  }, [submitted])

  useEffect(() => {
    if (!previewImage) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewImage('')
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [previewImage])

  useEffect(() => {
    if (!contactAction) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContactAction(null)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [contactAction])

  function openForm() {
    setShowForm(true)
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleLogo(file?: File) {
    if (!file) return
    if (file.size > 2000000) {
      setLogoError('Image must be under 2MB. Please choose a smaller file.')
      return
    }
    if (!file.type.startsWith('image/')) {
      setLogoError('Please choose an image file (JPG, PNG, WebP).')
      return
    }
    setLogoError('')
    const reader = new FileReader()
    reader.onerror = () => setLogoError('We could not read that file. Please try again.')
    reader.onload = () => {
      optimizeLogoBase64(reader.result as string, { maxBytes: 300 * 1024, maxDim: 900 })
        .then(setLogoBase64)
        .catch(() => setLogoError('We could not optimize that image. Please try a different one.'))
    }
    reader.readAsDataURL(file)
  }

  function setSponsorshipType(value: string) {
    setForm((f) => ({
      ...f,
      sponsorshipType: value,
      amount: value === 'Financial Contribution' ? f.amount : '',
    }))
  }

  function setRecognition(value: RecognitionChoice) {
    setForm((f) => ({
      ...f,
      publicRecognition: value,
      displayName: value === 'yes' ? f.displayName : '',
    }))
    if (value !== 'yes') {
      setLogoBase64('')
      setLogoError('')
    }
  }

  function toggleArea(area: string) {
    setForm((f) => ({
      ...f,
      supportAreas: f.supportAreas.includes(area)
        ? f.supportAreas.filter((a) => a !== area)
        : [...f.supportAreas, area],
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    let websiteClean = form.website.trim()
    if (websiteClean && !/^[a-z][a-z0-9+.-]*:\/\//i.test(websiteClean)) {
      websiteClean = 'https://' + websiteClean
    }
    if (websiteClean) {
      let parsed: URL | null = null
      try {
        parsed = new URL(websiteClean)
      } catch {
        parsed = null
      }
      const valid = parsed !== null && (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      if (!valid) {
        setWebsiteError('Please enter a valid website address, e.g. www.example.com or https://example.com/page')
        document.getElementById('sponsor-website')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
      update('website', websiteClean)
    }
    setWebsiteError('')
    const phoneErr = phoneErrorMessage(form.phone)
    if (phoneErr) {
      setFormError(phoneErr)
      return
    }
    if (form.supportAreas.length === 0) {
      setFormError('Please select at least one area you would like to support.')
      return
    }
    if (!form.message.trim()) {
      setFormError('Please tell us about your organization, who you are, and the services you render.')
      return
    }
    if (!consent) {
      setFormError('Please accept the confirmation statement to continue.')
      return
    }
    setLoading(true)
    try {
      const res = await postJson('/api/sponsors', {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        website: websiteClean || undefined,
        socials: socials
          .filter((s) => s.platform && s.handle.trim())
          .map((s) => ({ platform: s.platform, handle: s.handle.trim() })),
        sponsorType: form.sponsorType,
        country: form.country,
        state: form.state,
        address: form.address,
        supportAreas: form.supportAreas,
        sponsorshipType: form.sponsorshipType,
        amount: form.sponsorshipType === 'Financial Contribution' ? Number(form.amount.replace(/[^\d.]/g, '')) : undefined,
        usagePreference: form.usagePreference,
        message: form.message,
        publicRecognition: form.publicRecognition === 'yes',
        displayName: form.publicRecognition === 'yes' ? form.displayName.trim() : '',
        logoBase64: form.publicRecognition === 'yes' ? logoBase64 : undefined,
        consent,
        eventId: eventId || undefined,
      })
      setSubmitted(res.reference || '')
    } catch (err: any) {
      const message = err.message || 'Something went wrong. Please try again.'
      setFormError(message)
      if (/image|logo|upload/i.test(message)) {
        setLogoError(message)
        document.getElementById('sponsor-logo')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } finally {
      setLoading(false)
    }
  }

  function ChoiceCard({
    checked,
    onSelect,
    children,
    name,
    value,
    type = 'radio',
  }: {
    checked: boolean
    onSelect: () => void
    children: React.ReactNode
    name: string
    value: string
    type?: 'radio' | 'checkbox'
  }) {
    return (
      <label
        className={`cursor-pointer rounded-xl border p-4 flex items-center gap-3 text-sm transition-all duration-200 min-w-0 ${
          checked
            ? 'border-rose bg-blush shadow-sm'
            : 'border-black/10 hover:border-rose/50'
        }`}
      >
        <input
          type={type}
          name={name}
          value={value}
          checked={checked}
          onChange={onSelect}
          className="accent-rose mt-0.5"
        />
        <span className="text-ink/80">{children}</span>
      </label>
    )
  }

  function SectionHeading({ n, title }: { n: number; title: string }) {
    return (
      <h3 className="flex items-center gap-3 text-sm font-semibold uppercase tracking-wide text-rose-deep mt-8 first:mt-0">
        <span className="w-7 h-7 rounded-full bg-rose-deep text-cream text-xs flex items-center justify-center font-bold">
          {n}
        </span>
        {title}
      </h3>
    )
  }

  const amountVisible = form.sponsorshipType === 'Financial Contribution'
  const nameVisible = form.publicRecognition === 'yes'

  return (
    <div className="container section-pad">
        <Reveal variant="zoom">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <span className="eyebrow mb-3">Sponsorship</span>
            <h2 className="section-title mb-3">MEET OUR SPONSORS</h2>
            <p className="text-ink/70 max-w-2xl mx-auto">
              A heartfelt thank you to the individuals and organizations making Shawty Beauty Studio’s mission possible.
            </p>
          </div>

          {sponsorsLoading ? (
            <div className="flex justify-center py-16"><LoaderCircle className="animate-spin text-rose-deep" size={28} /></div>
          ) : sponsors.length === 0 ? (
            <div className="card p-10 text-center text-muted max-w-xl mx-auto">
              This showcase is filling up. Be the first to partner with us and have your brand featured here!
            </div>
          ) : (
            <div className="flex flex-wrap justify-center gap-3">
              {sponsors.map((s) => (
                <div key={s.id} className="card overflow-hidden text-center min-w-[140px] max-w-[160px] flex-1">
                  <div className="h-24 bg-blush/40 flex items-center justify-center overflow-hidden p-2">
                    {s.logoUrl || s.logoBase64 ? (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(logoSrc(s))}
                        aria-label={`View ${s.name} logo`}
                        className="w-full h-24 bg-blush/40 flex items-center justify-center overflow-hidden p-2 group cursor-zoom-in"
                      >
                        <img
                          src={logoSrc(s)}
                          alt={`${s.name} logo`}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-auto max-w-full object-contain transition-transform duration-500 group-hover:scale-110"
                        />
                      </button>
                    ) : (
                      <div className="h-24 bg-blush/40 flex items-center justify-center overflow-hidden p-2">
                        <span className="font-display text-3xl font-bold text-rose-deep">{s.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-semibold text-xs">{s.name}</div>
                    {(s.state || s.country) && (
                      <div className="text-[11px] text-muted mt-0.5">
                        {(s.state ? s.state + (s.country ? ', ' : '') : '') + (s.country || '')}
                      </div>
                    )}
                    <button
                      onClick={() => setViewSponsor(s)}
                      className="mt-2 text-[11px] font-semibold text-rose-dark hover:text-rose transition-colors inline-flex items-center gap-1"
                    >
                      View Details <ArrowRight size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-10">
            <button onClick={openForm} className="btn btn-primary inline-flex items-center gap-2">
              <HeartHandshake size={18} /> Partner with us today <ArrowRight size={16} />
            </button>
          </div>

          <Modal open={viewSponsor !== null} onClose={() => setViewSponsor(null)}>
            {viewSponsor && (
              <div>
                <div className="flex items-center gap-4 mb-5">
                  <div className="w-16 h-16 rounded-2xl bg-blush flex items-center justify-center overflow-hidden">
                    {viewSponsor.logoUrl || viewSponsor.logoBase64 ? (
                      <button
                        type="button"
                        onClick={() => setPreviewImage(logoSrc(viewSponsor))}
                        aria-label={`View ${viewSponsor.name} logo`}
                        className="h-full w-full flex items-center justify-center cursor-zoom-in"
                      >
                        <img
                          src={logoSrc(viewSponsor)}
                          alt={`${viewSponsor.name} logo`}
                          className="h-full w-auto max-w-full object-contain"
                        />
                      </button>
                    ) : (
                      <span className="font-display text-3xl font-bold text-rose-deep">{viewSponsor.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-xl font-bold leading-tight">{viewSponsor.name}</h3>
                    {viewSponsor.contactName && viewSponsor.contactName !== viewSponsor.name && (
                      <div className="text-sm text-muted mt-0.5">{viewSponsor.contactName}</div>
                    )}
                    {(viewSponsor.state || viewSponsor.country) && (
                      <div className="text-xs text-muted mt-0.5">
                        {(viewSponsor.state ? viewSponsor.state + (viewSponsor.country ? ', ' : '') : '') + (viewSponsor.country || '')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  {viewSponsor.sponsorshipType && (
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide font-semibold">Sponsorship</span>
                      <p className="text-ink/80 mt-0.5">{viewSponsor.sponsorshipType}</p>
                    </div>
                  )}
                  {viewSponsor.supportAreas && viewSponsor.supportAreas.length > 0 && (
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide font-semibold">What they support</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {viewSponsor.supportAreas.map((a) => (
                          <span key={a} className="tag-chip text-[11px] !py-1">{a}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {viewSponsor.notes && (
                    <div>
                      <span className="text-xs text-muted uppercase tracking-wide font-semibold">About them</span>
                      <RichText className="text-ink/80 mt-0.5 leading-relaxed block" text={viewSponsor.notes} />
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-5 border-t border-black/5 space-y-2">
                  <span className="text-xs text-muted uppercase tracking-wide font-semibold">Contact</span>
                  <div className="flex flex-col gap-1.5">
                    {viewSponsor.website && (
                      <a className="text-sm font-medium text-rose-dark hover:text-rose transition-colors break-all" href={viewSponsor.website} target="_blank" rel="noreferrer">
                        {viewSponsor.website} ↗
                      </a>
                    )}
                    {viewSponsor.email && (
                      <a className="text-sm font-medium text-rose-dark hover:text-rose transition-colors break-all" href={`mailto:${viewSponsor.email}`}>{viewSponsor.email}</a>
                    )}
                    {viewSponsor.phone && (
                      <button
                        type="button"
                        onClick={() => setContactAction({ name: viewSponsor.name || 'this sponsor', phone: viewSponsor.phone! })}
                        className="text-sm font-medium text-rose-dark hover:text-rose transition-colors text-left"
                      >
                        {viewSponsor.phone}
                      </button>
                    )}
                    {viewSponsor.address && (
                      <span className="text-sm text-ink/70">{viewSponsor.address}</span>
                    )}
                  </div>
                </div>

                {viewSponsor.socials && viewSponsor.socials.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {viewSponsor.socials.map((s, i) => (
                      <span key={i} className="tag-chip !py-1 text-[11px]">{s.platform} · @{s.handle}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Modal>

          {contactAction && (
            <div
              className="fixed inset-0 z-[85] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
              onClick={() => setContactAction(null)}
              role="dialog"
              aria-modal="true"
              aria-label="Contact by phone or WhatsApp"
            >
              <div className="card bg-white rounded-3xl p-6 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
                <h4 className="font-semibold text-lg text-center">Get in touch with {contactAction.name}?</h4>
                <p className="text-sm text-muted text-center mt-1.5">{contactAction.phone}</p>
                <div className="grid grid-cols-2 gap-3 mt-6">
                  <a
                    href={`tel:${contactAction.phone.replace(/\s+/g, '')}`}
                    onClick={() => setContactAction(null)}
                    className="btn btn-outline flex items-center justify-center gap-2"
                  >
                    <Phone size={16} /> Call
                  </a>
                  <a
                    href={`https://wa.me/${contactAction.phone.replace(/[^\d]/g, '').replace(/^0/, '234')}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setContactAction(null)}
                    className="btn flex items-center justify-center gap-2 bg-green-500 text-white hover:bg-green-600"
                  >
                    <MessageCircle size={16} /> WhatsApp
                  </a>
                </div>
                <button
                  type="button"
                  onClick={() => setContactAction(null)}
                  className="w-full mt-4 text-xs text-muted hover:text-ink transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {previewImage && (
            <div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/85 p-6"
              onClick={() => setPreviewImage('')}
              role="dialog"
              aria-modal="true"
              aria-label="Sponsor logo preview"
            >
              <button
                type="button"
                onClick={() => setPreviewImage('')}
                aria-label="Close preview"
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 text-white hover:bg-white/30 transition-colors flex items-center justify-center"
              >
                <X size={18} />
              </button>
              <img
                src={previewImage}
                alt="Sponsor logo"
                onClick={(e) => e.stopPropagation()}
                decoding="async"
                className="max-h-[85vh] max-w-[92vw] object-contain rounded-xl bg-white p-4 shadow-2xl"
              />
            </div>
          )}

          {showForm && (
          <div ref={formRef} className="mt-12 scroll-mt-8 min-w-0">
            <div className="max-w-2xl mx-auto min-w-0">
          {submitted ? (
            <div ref={successRef} className="card p-8 sm:p-10 text-center scroll-mt-24">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-5">
                <HeartHandshake size={32} />
              </div>
              <h2 className="section-title mb-3">Thank you for supporting Shawty Beauty Studio!</h2>
              <p className="text-ink/70 mb-6">
                Your sponsorship has been received successfully. Our team will contact you regarding
                the next steps.
              </p>
              <div className="inline-flex flex-col items-center gap-1 rounded-xl bg-blush px-6 py-4">
                <span className="text-xs text-ink/60 uppercase tracking-wide font-semibold">
                  Sponsorship Reference
                </span>
                <span className="font-mono text-xl font-bold text-rose-deep">{submitted}</span>
              </div>
              <div className="mt-6">
                <Link to="/" className="btn btn-primary inline-flex items-center gap-2">
                  <Home size={16} /> Back to Home
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="card p-6 sm:p-8 min-w-0 overflow-hidden">
              <div className="text-center mb-8">
                <span className="eyebrow mb-3">Sponsorship</span>
                <h2 className="section-title mb-2">SUPPORT SHAWTY BEAUTY STUDIO</h2>
                <p className="font-display text-lg font-semibold text-rose-deep mb-2">
                  Empower. Sponsor. Make an Impact.
                </p>
                <p className="text-ink/70 text-sm">
                  Your support helps Shawty Beauty Studio train and empower aspiring makeup and lash
                  artists. Every contribution — whether financial, material, or professional — makes
                  a difference. Fill in the details below to get started.
                </p>
              </div>

              <SectionHeading n={1} title="Sponsor Information" />
              <div className="mt-4 space-y-5">
                <div>
                  <label className="field-label">Sponsor Type *</label>
                  <div className="grid sm:grid-cols-2 gap-3 mt-2">
                    {SPONSOR_TYPE_OPTIONS.map((o) => (
                      <ChoiceCard key={o} name="sponsorType" value={o}
                        checked={form.sponsorType === o}
                        onSelect={() => update('sponsorType', o)}>
                        {o}
                      </ChoiceCard>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label">Full Name / Organization / Brand Name *</label>
                  <input className="input-field" value={form.fullName} required
                    onChange={(e) => update('fullName', e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-2 gap-5 min-w-0">
                  <div>
                    <label className="field-label">Phone Number *</label>
                    <div className="mt-2">
                      <PhoneInput value={form.phone} onChange={(v) => update('phone', v)} dial={dialForNationality(form.country)} />
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Email Address *</label>
                    <input type="email" className="input-field" value={form.email} required
                      onChange={(e) => update('email', e.target.value)} />
                  </div>
                  <div>
                    <label className="field-label">Website Address <span className="text-muted font-normal">(optional)</span></label>
                    <input id="sponsor-website" type="text" inputMode="url" className="input-field" value={form.website} placeholder="e.g. www.example.com"
                      onChange={(e) => { update('website', e.target.value); if (websiteError) setWebsiteError('') }} />
                    {websiteError && <p className="mt-1.5 text-sm text-red-600" role="alert">{websiteError}</p>}
                  </div>
                  <div className="sm:col-span-2">
                    <label className="field-label">Social Media Handles <span className="text-muted font-normal">(optional)</span></label>
                    <p className="text-xs text-muted mt-1 mb-3">
                      Select the platforms you're on and add your username or handle for each.
                    </p>
                    <div className="space-y-2.5 min-w-0">
                      {socials.map((s, i) => (
                        <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 min-w-0">
                          <select
                            className="input-field flex-1 min-w-0 w-full sm:w-auto"
                            value={s.platform}
                            onChange={(e) => setSocials((arr) => arr.map((x, j) => (j === i ? { ...x, platform: e.target.value } : x)))}
                          >
                            <option value="">Platform</option>
                            {SOCIAL_PLATFORM_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                          </select>
                          <div className="relative flex-1 min-w-0 w-full">
                            <AtSign size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                            <input
                              className="input-field !pl-8 w-full min-w-0"
                              value={s.handle}
                              placeholder="Your username / handle"
                              onChange={(e) => setSocials((arr) => arr.map((x, j) => (j === i ? { ...x, handle: e.target.value } : x)))}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setSocials((arr) => arr.filter((_, j) => j !== i))}
                            className="shrink-0 p-2.5 rounded-lg border border-black/10 text-ink/50 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors self-start sm:self-center"
                            title="Remove platform"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSocials((arr) => [...arr, { platform: '', handle: '' }])}
                      className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-deep hover:underline cursor-pointer"
                    >
                      <Plus size={15} /> Add another platform
                    </button>
                  </div>
                  <div className="min-w-0">
                    <label className="field-label">Country / Nationality *</label>
                    {form.country && !nationalityNames.includes(form.country) ? (
                      <input className="input-field" value={form.country === 'Other' ? '' : form.country}
                        onChange={(e) => { update('state', ''); update('country', e.target.value) }}
                        required placeholder="Type your country" />
                    ) : (
                      <select className="input-field w-full min-w-0" value={form.country}
                        onChange={(e) => { update('state', ''); update('country', e.target.value) }} required>
                        <option value="">Select country</option>
                        {nationalityNames.map((n) => <option key={n} value={n}>{n}</option>)}
                        <option value="Other">Other</option>
                      </select>
                    )}
                  </div>
                  <div className="min-w-0">
                    <label className="field-label">State / Region *</label>
                    {nationalities[form.country] ? (
                      <select className="input-field w-full min-w-0" value={form.state}
                        onChange={(e) => update('state', e.target.value)} required>
                        <option value="">Select state</option>
                        {nationalities[form.country].map((s) => <option key={s} value={s}>{s}</option>)}
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
                </div>
              </div>

              <SectionHeading n={2} title="Sponsorship Details" />
              <div className="mt-4 space-y-5">
                <div>
                  <label className="field-label">What would you like to support? *</label>
                  <div className="grid sm:grid-cols-2 gap-3 mt-2">
                    {SUPPORT_AREA_OPTIONS.map((o) => (
                      <ChoiceCard key={o} name="supportAreas" value={o} type="checkbox"
                        checked={form.supportAreas.includes(o)}
                        onSelect={() => toggleArea(o)}>
                        {o}
                      </ChoiceCard>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label">Sponsorship Type *</label>
                  <div className="grid sm:grid-cols-2 gap-3 mt-2">
                    {SPONSORSHIP_TYPE_OPTIONS.map((o, i) => (
                      <ChoiceCard key={o} name="sponsorshipType" value={o}
                        checked={form.sponsorshipType === o}
                        onSelect={() => setSponsorshipType(o)}>
                        <span>
                          {o}
                          {i === 0 && <span className="block text-xs text-muted font-normal">State the amount you would like to contribute</span>}
                        </span>
                      </ChoiceCard>
                    ))}
                  </div>
                </div>
                {amountVisible && (
<div>
                      <label className="field-label">Amount (₦) *</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/60 font-medium">₦</span>
                        <input type="text" inputMode="numeric" className="input-field"
                          style={{ paddingLeft: '2.5rem' }}
                          value={form.amount} placeholder="e.g. 50,000" maxLength={15} required
                          onChange={(e) => update('amount', formatAmountInput(e.target.value))} />
                      </div>
                    </div>
                )}
              </div>

              <SectionHeading n={3} title="Sponsorship Preference" />
              <div className="mt-4 space-y-5">
                <div>
                  <label className="field-label">How would you like your sponsorship to be used? *</label>
                  <div className="grid sm:grid-cols-2 gap-3 mt-2">
                    {USAGE_PREFERENCE_OPTIONS.map((o) => (
                      <ChoiceCard key={o} name="usagePreference" value={o}
                        checked={form.usagePreference === o}
                        onSelect={() => update('usagePreference', o)}>
                        {o}
                      </ChoiceCard>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="field-label">TELL US ABOUT YOUR ORGANIZATION / WHO YOU ARE / SERVICES RENDERED *</label>
                  <textarea className="input-field" rows={3} value={form.message}
                    onChange={(e) => update('message', e.target.value)}
                    placeholder="Tell us about your organization, who you are, and the services you render."
                    required />
                </div>
              </div>

              <SectionHeading n={4} title="Sponsor Recognition" />
              <div className="mt-4 space-y-5">
                <div>
                  <label className="field-label">
                    Would you like to be recognized publicly as a Shawty Beauty Studio sponsor? *
                  </label>
                  <div className="grid sm:grid-cols-2 gap-3 mt-2">
                    <ChoiceCard name="publicRecognition" value="yes"
                      checked={form.publicRecognition === 'yes'}
                      onSelect={() => setRecognition('yes')}>
                      Yes
                    </ChoiceCard>
                    <ChoiceCard name="publicRecognition" value="no"
                      checked={form.publicRecognition === 'no'}
                      onSelect={() => setRecognition('no')}>
                      No, I prefer to remain anonymous
                    </ChoiceCard>
                  </div>
                </div>
                {nameVisible && (
                  <div>
                    <label className="field-label">Name to Display *</label>
                    <input className="input-field" value={form.displayName} required
                      placeholder="The name that will appear in our sponsor recognition"
                      onChange={(e) => update('displayName', e.target.value)} />
                  </div>
                )}
                {nameVisible && (
                  <div id="sponsor-logo">
                    <label className="field-label">
                      {form.sponsorType === 'Individual'
                        ? 'Identification Document (optional)'
                        : 'Organization Logo / Brand Identification (optional)'}
                    </label>
                    <p className="text-sm text-muted mb-2">
                      {form.sponsorType === 'Individual'
                        ? 'Upload a valid identification document (e.g. national ID, driver’s license, passport) or any document relating to your brand.'
                        : 'Upload your organization’s logo or any brand identification document so we can feature it in our sponsor recognition.'}
                    </p>
                    {logoBase64 ? (
                      <div className="relative inline-block">
                        <img src={logoBase64} alt="Brand identification" className="h-32 w-auto rounded-xl border border-black/10 object-contain bg-white p-2" />
                        <button
                          type="button"
                          onClick={() => { setLogoBase64(''); setLogoError('') }}
                          aria-label="Remove image"
                          className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-rose-deep text-white flex items-center justify-center hover:bg-rose-dark transition-colors"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/20 hover:border-rose/60 cursor-pointer p-8 text-center transition-colors">
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                          onChange={(e) => handleLogo(e.target.files?.[0])} />
                        <span className="w-10 h-10 rounded-full bg-blush text-rose-deep flex items-center justify-center">
                          <ImagePlus size={18} />
                        </span>
                        <span className="text-sm text-ink/70 font-medium">
                          {form.sponsorType === 'Individual' ? 'Upload identification document' : 'Upload logo'}
                        </span>
                        <span className="text-xs text-muted">JPG, PNG or WebP · max 2MB · auto-optimized</span>
                      </label>
                    )}
                    {logoError && <div className="mt-2 text-sm text-red-600">{logoError}</div>}
                  </div>
                )}
              </div>

              <SectionHeading n={5} title="Confirmation" />
              <div className="mt-4">
                <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-black/10 p-4 text-sm text-ink/70 hover:border-rose/50 transition-all duration-200">
                  <input type="checkbox" checked={consent}
                    onChange={(e) => setConsent(e.target.checked)} required
                    className="accent-rose mt-0.5" />
                  <span>
                    I confirm that the information provided is accurate, and I am authorized to
                    submit this sponsorship on behalf of the stated organization (if applicable). I
                    understand that my sponsorship details are saved and used only for Shawty Beauty
                    Studio sponsorship purposes. *
                  </span>
                </label>
              </div>

              {formError && (
                <div className="mt-5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3">
                  {formError}
                </div>
              )}

              <button type="submit" className="btn btn-primary w-full mt-6" disabled={loading}>
                {loading ? <><LoaderCircle size={18} className="animate-spin" /> Submitting…</> : 'Submit Sponsorship'}
              </button>
            </form>
          )}
          </div>
          </div>
          )}
        </div>
        </Reveal>
      </div>
  )
}