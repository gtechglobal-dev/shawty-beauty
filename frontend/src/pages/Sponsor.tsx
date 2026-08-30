import { useState } from 'react'
import {
  CircleCheck,
  LoaderCircle,
  CircleAlert,
  Sparkles,
  Crown,
  Package,
  Wrench,
} from 'lucide-react'
import { formatNgn, sponsorPackages, type SponsorPkg } from '../lib/constants'
import { postJson } from '../lib/api'

const tiers = ['supporter', 'partner', 'featured', 'title'] as const

export default function Sponsor() {
  const [form, setForm] = useState({
    brandName: '',
    contactName: '',
    email: '',
    phone: '',
    packageType: 'supporter' as SponsorPkg['id'],
    amount: '',
    notes: '',
  })
  const [logo, setLogo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [logoInvalid, setLogoInvalid] = useState('')

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function handleLogo(file?: File) {
    if (!file) return
    if (file.size > 300000) {
      setLogoInvalid('Logo must be under 300KB. Please upload a smaller image.')
      return
    }
    setLogoInvalid('')
    const reader = new FileReader()
    reader.onload = () => setLogo(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)
    try {
      await postJson('/api/sponsors', {
        ...form,
        amount: form.amount ? Number(form.amount) : undefined,
        logoBase64: logo || undefined,
      })
      setSuccess('Thank you! Your sponsorship application has been received. Our team will reach out shortly.')
      setForm({
        brandName: '',
        contactName: '',
        email: '',
        phone: '',
        packageType: 'supporter',
        amount: '',
        notes: '',
      })
      setLogo('')
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectedPkg = sponsorPackages.find((p) => p.id === form.packageType)!

  return (
    <div>
      <section className="bg-gradient-to-br from-blush via-cream to-white border-b border-black/5">
        <div className="container py-12 md:py-16 text-center">
          <span className="eyebrow mb-4">
            <Sparkles size={14} /> Become a Sponsor
          </span>
          <h1 className="section-title text-4xl md:text-5xl mb-4">Support the Movement</h1>
          <p className="text-ink/70 max-w-2xl mx-auto">
            Position your brand in front of aspiring makeup artists and makeup lovers. Explore
            sponsorship packages designed to deliver real visibility before, during, and after the
            program.
          </p>
        </div>
      </section>

      <div className="container section-pad">
        {/* Packages */}
        <div className="grid md:grid-cols-2 gap-6">
          {tiers.map((id) => {
            const p = sponsorPackages.find((x) => x.id === id)!
            return (
              <div key={id} className={`card p-7 ${id === 'title' ? 'ring-2 ring-gold' : ''}`}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blush flex items-center justify-center">
                    {id === 'title'
                      ? <Crown className="text-gold" size={20} />
                      : <Package className="text-rose-dark" size={20} />}
                  </div>
                  <div>
                    <h3 className="font-semibold">{p.label}</h3>
                    <span className="text-xs text-muted">{p.slot || (p.price > 0 ? `₦${p.price.toLocaleString()}` : '')}</span>
                  </div>
                </div>
                {p.price > 0 && (
                  <div className="mb-3"><span className="font-display text-3xl font-bold">{formatNgn(p.price)}</span></div>
                )}
                <p className="text-sm text-muted mb-5">{p.desc}</p>
                <ul className="space-y-2 text-sm text-ink/75">
                  {p.benefits.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <CircleCheck className="text-rose shrink-0 mt-0.5" size={16} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Product & Service */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {['product', 'service'].map((id) => {
            const p = sponsorPackages.find((x) => x.id === id)!
            return (
              <div key={id} className="card p-7">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gold/15 flex items-center justify-center">
                    {id === 'product'
                      ? <Package className="text-gold" size={20} />
                      : <Wrench className="text-gold" size={20} />}
                  </div>
                  <h3 className="font-semibold">{p.label}</h3>
                </div>
                <p className="text-sm text-muted mb-4">{p.desc}</p>
                <p className="text-sm text-ink/70">Sponsors receive benefits based on their contributions and agreements.</p>
              </div>
            )
          })}
        </div>

        {/* Application form */}
        <div className="max-w-2xl mx-auto mt-14 md:mt-20">
          <div className="text-center mb-8">
            <h2 className="section-title mb-2">Apply to Sponsor</h2>
            <p className="text-ink/70">Tell us a little about your brand and we’ll get back to you.</p>
          </div>

          {success && (
            <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm flex items-start gap-2">
              <CircleCheck size={20} className="shrink-0" /> {success}
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
              <CircleAlert size={20} className="shrink-0" /> {error}
            </div>
          )}

          <form onSubmit={submit} className="card p-6 sm:p-8 space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <label className="field-label">Brand / Business Name *</label>
                <input className="input-field" value={form.brandName} required
                  onChange={(e) => update('brandName', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Contact Person *</label>
                <input className="input-field" value={form.contactName} required
                  onChange={(e) => update('contactName', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Email *</label>
                <input type="email" className="input-field" value={form.email} required
                  onChange={(e) => update('email', e.target.value)} />
              </div>
              <div>
                <label className="field-label">Phone *</label>
                <input className="input-field" value={form.phone} required
                  onChange={(e) => update('phone', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="field-label">Sponsorship Package *</label>
              <select className="input-field" value={form.packageType}
                onChange={(e) => update('packageType', e.target.value as SponsorPkg['id'])}>
                {sponsorPackages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}{p.price > 0 ? ` — ${formatNgn(p.price)}` : ''}
                  </option>
                ))}
              </select>
            </div>

            {(selectedPkg.id === 'product' || selectedPkg.id === 'service' || selectedPkg.id === 'title') && (
              <div>
                <label className="field-label">Amount / Contribution (₦)</label>
                <input type="number" min={0} className="input-field" value={form.amount} placeholder="Enter amount (for custom / in-kind sponsorships)"
                  onChange={(e) => update('amount', e.target.value)} />
              </div>
            )}

            <div>
              <label className="field-label">Notes / Details of contribution</label>
              <textarea className="input-field" rows={3} value={form.notes}
                onChange={(e) => update('notes', e.target.value)}
                placeholder="e.g. supplying products, providing photography, venue support, etc." />
            </div>

            <div>
              <label className="field-label">Brand Logo (optional, under 300KB)</label>
              <input
                type="file"
                accept="image/*"
                className="input-field"
                onChange={(e) => handleLogo(e.target.files?.[0])}
              />
              {logoInvalid && <p className="text-xs text-red-600 mt-1">{logoInvalid}</p>}
              {logo && <p className="text-xs text-green-600 mt-1">Logo attached ✓</p>}
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? <><LoaderCircle size={18} className="animate-spin" /> Submitting…</> : 'Submit Sponsorship Application'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
