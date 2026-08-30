import { useState } from 'react'
import { CircleAlert, CircleCheck, LoaderCircle, Mail, Phone } from 'lucide-react'
import InstagramIcon from '../components/icons/InstagramIcon'
import { postJson } from '../lib/api'
import { siteConfig } from '../lib/constants'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [newsletter, setNewsletter] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      await postJson('/api/contact', form)
      setMsg({ type: 'ok', text: 'Your message has been sent. We’ll get back to you soon!' })
      setForm({ name: '', email: '', subject: '', message: '' })
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  async function subscribe(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMsg(null)
    try {
      const data = await postJson('/api/contact/subscribe', { email: newsletter })
      setMsg({ type: 'ok', text: data.message })
      setNewsletter('')
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <section className="bg-gradient-to-br from-blush via-cream to-white border-b border-black/5">
        <div className="container py-12 md:py-16 text-center">
          <span className="eyebrow mb-3">Contact Us</span>
          <h1 className="section-title text-4xl mb-4">Get in Touch</h1>
          <p className="text-ink/70 max-w-xl mx-auto">
            Book a makeup or lash session, ask about the 3-day class, or chat about sponsorship.
          </p>
        </div>
      </section>

      <div className="container section-pad grid lg:grid-cols-[1fr_360px] gap-8 lg:gap-10 items-start">
        <form onSubmit={submit} className="card p-6 sm:p-8 space-y-5">
          {msg && (
            <div className={`p-4 rounded-xl text-sm flex items-start gap-2 ${
              msg.type === 'ok'
                ? 'bg-green-50 border border-green-200 text-green-800'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}>
              {msg.type === 'ok' ? <CircleCheck size={20} className="shrink-0" /> : <CircleAlert size={20} className="shrink-0" />}
              {msg.text}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="field-label">Full Name *</label>
              <input className="input-field" value={form.name} required onChange={(e) => update('name', e.target.value)} />
            </div>
            <div>
              <label className="field-label">Email *</label>
              <input type="email" className="input-field" value={form.email} required onChange={(e) => update('email', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="field-label">Subject</label>
            <input className="input-field" value={form.subject} onChange={(e) => update('subject', e.target.value)} />
          </div>
          <div>
            <label className="field-label">Message *</label>
            <textarea className="input-field" rows={5} value={form.message} required onChange={(e) => update('message', e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? <><LoaderCircle size={18} className="animate-spin" /> Sending…</> : 'Send Message'}
          </button>
        </form>

        <aside className="space-y-6">
          <div className="card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blush flex items-center justify-center"><Mail className="text-rose-dark" size={18} /></div>
              <div className="min-w-0">
                <div className="text-xs text-muted">Email</div>
                <a className="text-sm font-medium break-all" href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blush flex items-center justify-center"><Phone className="text-rose-dark" size={18} /></div>
              <div className="min-w-0">
                <div className="text-xs text-muted">Phone</div>
                <a className="text-sm font-medium break-all" href={`tel:${siteConfig.phoneRaw}`}>{siteConfig.phone}</a>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blush flex items-center justify-center"><InstagramIcon className="text-rose-dark" size={18} /></div>
              <div className="min-w-0">
                <div className="text-xs text-muted">Instagram</div>
                <a className="text-sm font-medium break-all" href={siteConfig.instagram} target="_blank" rel="noreferrer">{siteConfig.instagramHandle}</a>
              </div>
            </div>
          </div>

          <div className="card p-6 bg-blush border-rose/20">
            <h3 className="font-semibold mb-2">Stay in the loop</h3>
            <p className="text-sm text-ink/70 mb-4">Subscribe for program updates, dates, and beauty tips.</p>
            <form onSubmit={subscribe} className="space-y-3">
              <input type="email" className="input-field" placeholder="you@email.com" value={newsletter}
                onChange={(e) => setNewsletter(e.target.value)} required />
              <button type="submit" className="btn btn-primary w-full" disabled={loading}>
                {loading ? '…' : 'Subscribe'}
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  )
}
