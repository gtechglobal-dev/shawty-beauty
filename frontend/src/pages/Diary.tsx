import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  MessageSquare,
  Mail,
  LoaderCircle,
  LogOut,
  KeyRound,
  ArrowLeft,
  RefreshCw,
  Phone,
  MessageCircle,
  Handshake,
  Power,
  Eye,
  EyeOff,
  ExternalLink,
  Wifi,
  WifiOff,
  Sparkles,
  Image,
  Send,
  Copy,
  Trash2,
  X,
  Download,
  ScrollText,
} from 'lucide-react'
import { getJson, patchJson, postJson, delJson } from '../lib/api'
import { isLoggedIn, clearAuthToken, storeAuthToken } from '../lib/authState'
import { useRealtime, type RealtimeEventType, type RealtimeStatus } from '../lib/useRealtime'
import { formatNgn, type StudioEvent } from '../lib/constants'
import { useToast } from '../components/Toasts'
import Modal from '../components/Modal'
import { downloadImage } from '../lib/image'
import RichText from '../lib/RichText'
import {
  EventsHome,
  EventEditor,
  EventManage,
  PACKAGE_LABELS,
  type DiaryEvent,
  type DiaryTotals,
  type SponsorRow,
} from './diary/Events'
import TickerPanel from '../components/TickerPanel'

// ---------- Types ----------

interface ContactMsg {
  id: string
  name: string
  email: string
  subject: string
  message: string
  phone?: string
  read: boolean
  createdAt: string
}

interface Subscriber {
  email: string
  createdAt: string
  sources: string[]
  unsubscribed?: boolean
}

type Section = 'events' | 'sponsors' | 'messages' | 'subscribers' | 'settings'
type SubView = 'home' | 'manage' | 'editor'

interface GroupedData {
  events: DiaryEvent[]
  totals: DiaryTotals | null
}

interface RealtimeNotice {
  text: string
  key: number
}

const NOTICE_LABEL: Partial<Record<RealtimeEventType, string>> = {
  registrations: 'Registrations updated',
  contacts: 'New contact message',
  subscribers: 'New subscriber added',
  sponsors: 'Sponsors updated',
  events: 'Event updated',
  attendance: 'Attendance marked',
}

// ---------- Diary (standalone admin area) ----------

export default function Diary() {
  const [searchParams, setSearchParams] = useSearchParams()
  const resetToken = searchParams.get('reset') || ''

  const [token, setToken] = useState(localStorage.getItem('sbs_admin_token') || '')
  const [screen, setScreen] = useState<'login' | 'forgot' | 'reset'>(resetToken ? 'reset' : 'login')
  const [section, setSection] = useState<Section>(() => {
    const s = searchParams.get('section')
    return s === 'sponsors' || s === 'messages' || s === 'subscribers' || s === 'settings' ? s : 'events'
  })
  const [subView, setSubView] = useState<SubView>(() => {
    const s = searchParams.get('sub')
    return s === 'manage' || s === 'editor' ? s : 'home'
  })
  const [selectedEventId, setSelectedEventId] = useState<string | null>(searchParams.get('event'))
  const [editingEvent, setEditingEvent] = useState<DiaryEvent | null>(null)

  const [username, setUsername] = useState('Shawty')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [authLoading, setAuthLoading] = useState(false)

  const [grouped, setGrouped] = useState<GroupedData>({ events: [], totals: null })
  const [contacts, setContacts] = useState<ContactMsg[]>([])
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [sponsors, setSponsors] = useState<SponsorRow[]>([])
  const [sponsorDetails, setSponsorDetails] = useState<SponsorRow | null>(null)
  const [sponsorToggle, setSponsorToggle] = useState<SponsorRow | null>(null)
  const [sponsorDeleteTarget, setSponsorDeleteTarget] = useState<SponsorRow | null>(null)
  const [sponsorContactAction, setSponsorContactAction] = useState<{ kind: 'call' | 'whatsapp' | 'email'; phone: string; email: string } | null>(null)
  const [sponsorEmailOpen, setSponsorEmailOpen] = useState(false)
  const [sponsorEmailSubject, setSponsorEmailSubject] = useState('')
  const [sponsorEmailMessage, setSponsorEmailMessage] = useState('')
  const [sponsorLogoPreview, setSponsorLogoPreview] = useState<string>('')
  const [contactAction, setContactAction] = useState<{ kind: 'call' | 'whatsapp'; phone: string } | null>(null)
  const [contactDetails, setContactDetails] = useState<ContactMsg | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ContactMsg | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sponsorDeleting, setSponsorDeleting] = useState(false)
  const [reloadTick, setReloadTick] = useState(0)
  const [notice, setNotice] = useState<RealtimeNotice | null>(null)
  const noticeTimer = useRef<number | undefined>(undefined)

  const toast = useToast()
  const headers = { Authorization: `Bearer ${token}` }

  // Sponsor logo lightbox: Escape closes and the page stays locked while open.
  useEffect(() => {
    if (!sponsorLogoPreview) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSponsorLogoPreview('')
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [sponsorLogoPreview])

  const sponsorLogoSrc = (s: SponsorRow | null): string => {
    if (!s) return ''
    if (s.logoUrl) return s.logoUrl
    if (!s.logoBase64) return ''
    return s.logoBase64.startsWith('data:') ? s.logoBase64 : `data:image/png;base64,${s.logoBase64}`
  }

  const rtStatus = useRealtime((type) => handleRealtime(type), { pollMs: 15000 })

  // Flashing next to the wrong edge on light mode: silence the notice pill a
  // moment after it appears so it never blocks the tab rail.
  useEffect(() => {
    if (!notice) return
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2600)
    return () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current)
    }
  }, [notice])

  useEffect(() => {
    if (token) reloadAll(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Any realtime push bumps the tick; the effect below refreshes quietly.
  useEffect(() => {
    if (reloadTick > 0 && token) reloadAll(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadTick])

  // Keep the current page/view in the URL (e.g. /diary?sub=manage&event=...)
  // so an F5 refresh lands back on the same screen instead of resetting
  // to the Events home. Only updated once authenticated, so things like the
  // ?reset= password token in the URL survive untouched on the login screen.
  useEffect(() => {
    if (!token) return
    const q = window.location.search
    const params = new URLSearchParams(q)
    if (section === 'events') params.delete('section')
    else params.set('section', section)
    if (subView === 'home') params.delete('sub')
    else params.set('sub', subView)
    if (selectedEventId) params.set('event', selectedEventId)
    else params.delete('event')
    const next = params.toString()
    if (q.replace(/^\?/, '') !== next) {
      setSearchParams(params, { replace: true })
    }
  }, [token, section, subView, selectedEventId, setSearchParams])

  // Editor view: re-hydrate the event being edited from the freshly loaded
  // list so refreshing the edit screen keeps working (the editor opens with
  // the full event, not a blank form).
  useEffect(() => {
    if (!token || subView !== 'editor' || !selectedEventId) return
    const found = grouped.events.find((e) => e.id === selectedEventId)
    if (found && (!editingEvent || editingEvent.id !== found.id)) {
      setEditingEvent(found)
    }
  }, [token, subView, selectedEventId, grouped.events, editingEvent])

  function handleRealtime(type: RealtimeEventType) {
    if (type === 'hello') return
    if (type === 'poll') {
      // Socket is down — silently refresh instead of flashing a notice banner.
      setReloadTick((t) => t + 1)
      return
    }
    setReloadTick((t) => t + 1)
    const text = NOTICE_LABEL[type]
    if (text) setNotice({ text, key: Date.now() })
  }

  async function reloadEvents(silent = false) {
    if (!silent) setLoading(true)
    try {
      const data = await getJson('/api/admin/events', headers)
      setGrouped({
        events: data.events || [],
        totals: data.totals || null,
      })
    } catch (err: any) {
      toast.push(err.message || 'Failed to load events', 'err')
      if (/unauthorized|invalid token/i.test(err.message)) signOut()
    } finally {
      setLoading(false)
    }
  }

  async function reloadAll(silent = false) {
    if (!silent) setLoading(true)
    try {
      await reloadEvents(true)
      if (section === 'messages') {
        const c = await getJson('/api/admin/contacts', headers)
        setContacts(c.contacts || [])
      }
      if (section === 'subscribers') {
        const s = await getJson('/api/admin/subscribers', headers)
        setSubscribers(s.subscribers || [])
      }
      if (section === 'sponsors') {
        const sp = await getJson('/api/admin/sponsors', headers)
        setSponsors(sp.sponsors || [])
      }
    } finally {
      setLoading(false)
    }
  }

  function signOut() {
    setToken('')
    clearAuthToken()
    setPassword('')
    setScreen('login')
    setSubView('home')
  }

  // ---------- Auth actions ----------

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true)
    try {
      const data = await postJson('/api/auth/login', { username, password })
      setToken(data.token)
      storeAuthToken(data.token)
    } catch (err: any) {
      toast.push(err.message || 'Login failed', 'err')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleForgot() {
    setAuthLoading(true)
    try {
      await postJson('/api/auth/forgot-password', { origin: window.location.origin })
      toast.push('Reset link has been sent to the registered email.')
    } catch (err: any) {
      toast.push(err.message || 'Could not send reset link.', 'err')
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true)
    if (newPassword !== confirmPassword) {
      toast.push('Passwords do not match.', 'err')
      setAuthLoading(false)
      return
    }
    try {
      await postJson('/api/auth/reset-password', { token: resetToken, newPassword })
      toast.push('Password updated. Sign in with your new password.')
      setNewPassword('')
      setConfirmPassword('')
      setPassword('')
      setScreen('login')
    } catch (err: any) {
      toast.push(err.message || 'Reset failed. The link may be invalid or expired.', 'err')
    } finally {
      setAuthLoading(false)
    }
  }

  // ---------- Event actions ----------

  async function handleCreateBlank() {
    setEditingEvent(null)
    setSubView('editor')
  }

  function handleEdit(id: string) {
    const ev = grouped.events.find((e) => e.id === id)
    if (!ev) return
    setEditingEvent(ev)
    setSubView('editor')
  }

  function handleManage(id: string) {
    setSelectedEventId(id)
    setSubView('manage')
  }

  async function handleDuplicate(id: string) {
    setSaving(true)
    try {
      await postJson('/api/admin/events', { fromEventId: id }, headers)
      await reloadEvents()
      toast.push('Event duplicated.')
    } catch (err: any) {
      toast.push(err.message || 'Failed to duplicate event', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function handleSetLive(id: string) {
    setSaving(true)
    try {
      const data = await postJson(`/api/admin/events/${id}/live`, {}, headers)
      await reloadEvents()
      toast.push(data.message || 'Event is now live on the site.')
    } catch (err: any) {
      toast.push(err.message || 'Failed to make event live', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function handleEnd(id: string) {
    setSaving(true)
    try {
      const data = await postJson(`/api/admin/events/${id}/end`, {}, headers)
      await reloadEvents()
      toast.push(data.message || 'Event ended.')
    } catch (err: any) {
      if (/unauthorized|invalid token/i.test(err.message || '')) {
        toast.push('Your session has expired. Please sign in again.', 'err')
        signOut()
        return
      }
      toast.push(err.message || 'Failed to end event', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const ev = grouped.events.find((e) => e.id === id)
    if (!confirm(`Delete "${ev?.title || 'this event'}"? Its registrations stay saved but won't be grouped under it.`)) return
    setSaving(true)
    try {
      await fetch(`/api/admin/events/${encodeURIComponent(id)}`, { method: 'DELETE', headers })
      await reloadEvents()
      toast.push('Event deleted.')
    } catch (err: any) {
      toast.push(err.message || 'Failed to delete', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEvent(data: Omit<StudioEvent, 'id' | 'createdAt' | 'updatedAt'>) {
    setSaving(true)
    try {
      let id = editingEvent?.id
      if (!id) {
        const created = await postJson('/api/admin/events', { title: data.title }, headers)
        id = created.event.id
      }
      await fetch(`/api/admin/events/${encodeURIComponent(id!)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(data),
      })
      await reloadEvents()
      setSubView('home')
      setEditingEvent(null)
      toast.push('Event saved.')
    } catch (err: any) {
      toast.push(err.message || 'Failed to save event', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function markContactRead(id: string) {
    try {
      await patchJson(`/api/admin/contacts/${id}/read`, {}, headers)
      setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, read: true } : c)))
    } catch (err: any) {
      toast.push(err.message || 'Failed to mark message as read', 'err')
    }
  }

  async function deleteContact(id: string) {
    setDeleting(true)
    try {
      await delJson(`/api/admin/contacts/${id}`, headers)
      setContacts((cs) => cs.filter((c) => c.id !== id))
      if (contactDetails?.id === id) setContactDetails(null)
      setDeleteTarget(null)
      toast.push('Message deleted.')
    } catch (err: any) {
      setDeleteTarget(null)
      toast.push(err.message || 'Failed to delete message', 'err')
    } finally {
      setDeleting(false)
    }
  }

  async function sendSponsorEmail() {
    if (!sponsorEmailSubject.trim() || !sponsorEmailMessage.trim()) {
      toast.push('Add both a subject and a message.', 'err')
      return
    }
    setSaving(true)
    try {
      const data = await postJson('/api/admin/broadcast', {
        subject: sponsorEmailSubject,
        message: sponsorEmailMessage,
        scope: 'sponsors',
      }, headers)
      toast.push(
        data.total > 0
          ? `Email sent to ${data.sent} of ${data.total} sponsor${data.total === 1 ? '' : 's'}${data.failed ? ` (${data.failed} failed)` : ''}.`
          : 'No sponsor emails to send.',
      )
      setSponsorEmailOpen(false)
      setSponsorEmailSubject('')
      setSponsorEmailMessage('')
    } catch (err: any) {
      toast.push(err.message || 'Failed to send email', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSponsor(target: SponsorRow) {
    setSponsorDeleting(true)
    try {
      await delJson(`/api/admin/sponsors/${target.id}`, headers)
      setSponsors((list) => list.filter((x) => x.id !== target.id))
      if (sponsorDetails?.id === target.id) setSponsorDetails(null)
      setSponsorDeleteTarget(null)
      toast.push('Sponsor deleted.')
    } catch (err: any) {
      setSponsorDeleteTarget(null)
      toast.push(err.message || 'Failed to delete sponsor', 'err')
    } finally {
      setSponsorDeleting(false)
    }
  }

  async function toggleSponsorActive(target: SponsorRow) {
    setSaving(true)
    try {
      const data = await patchJson(`/api/admin/sponsors/${target.id}`, { deactivated: !target.deactivated }, headers)
      setSponsors((list) => list.map((x) => (x.id === target.id ? { ...x, deactivated: data.sponsor?.deactivated } : x)))
      if (sponsorDetails?.id === target.id) {
        setSponsorDetails((d) => (d ? { ...d, deactivated: data.sponsor?.deactivated } : d))
      }
      toast.push(data.sponsor?.deactivated ? 'Sponsor deactivated. It is hidden from the Sponsors page.' : 'Sponsor reactivated. It is visible again on the Sponsors page.')
    } catch (err: any) {
      toast.push(err.message || 'Failed to update sponsor', 'err')
    } finally {
      setSaving(false)
      setSponsorToggle(null)
    }
  }

  // ---------- Auth screens ----------

  if (!token) {
    return (
      <div className="silk-dark relative min-h-screen flex flex-col">
        <header className="relative z-20 flex items-center justify-between px-5 py-4">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3">
            <span className="relative">
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose to-rose-deep flex items-center justify-center text-white font-display text-lg font-bold">D</span>
              <span className="absolute -inset-1 rounded-xl border border-pinkgold/50" />
            </span>
            <span>
              <span className="font-display text-white font-semibold leading-tight block">Shawty&rsquo;s Diary</span>
              <span className="text-[10px] tracking-[0.24em] uppercase text-white/40">Studio owner&rsquo;s area</span>
            </span>
          </button>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs font-medium text-white/50 hover:text-white bg-white/5 border border-white/10 px-3 py-2 rounded-full transition-colors"
          >
            <ExternalLink size={13} /> View main site
          </Link>
        </header>

        <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-20">
          <div className="w-full max-w-md">
            <button onClick={() => setScreen('login')} className="mx-auto flex items-center gap-2 text-white/60 hover:text-white text-xs tracking-wide uppercase mb-6">
              <Sparkles size={13} /> Private · sign in to manage the studio
            </button>

            {screen === 'login' && (
              <form onSubmit={handleLogin} className="card p-8 sm:p-10">
                <div className="text-center mb-6">
                  <span className="inline-flex justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-rose to-rose-deep items-center text-white font-display text-2xl font-bold shadow-[0_10px_24px_-10px_rgba(145,78,108,0.6)]">
                    S
                  </span>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold mt-4">Welcome back, boss</h1>
                  <p className="text-sm text-muted mt-1">Control every happening, form and submission</p>
                  <div className="flex justify-center mt-3"><span className="ornament">✦</span></div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="field-label">Username</label>
                    <input className="input-field" value={username} onChange={(e) => setUsername(e.target.value)} required />
                  </div>
                  <div>
                    <label className="field-label">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        className="input-field pr-11"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute right-0 top-0 h-full flex items-center px-3.5 text-muted hover:text-rose-deep transition-colors"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary w-full" disabled={authLoading}>
                    {authLoading ? <LoaderCircle size={18} className="animate-spin" /> : 'Enter the Diary'}
                  </button>
                </div>

                <button type="button" onClick={() => setScreen('forgot')} className="mt-5 w-full text-center text-sm font-medium text-rose-deep hover:text-rose-dark flex items-center justify-center gap-1.5">
                  <KeyRound size={14} /> Forgot password?
                </button>
              </form>
            )}

            {screen === 'forgot' && (
              <div className="card p-8 sm:p-10">
                <div className="text-center mb-6">
                  <span className="inline-flex justify-center w-14 h-14 rounded-2xl bg-blush items-center text-rose-deep"><KeyRound size={24} /></span>
                  <h1 className="font-display text-2xl font-bold mt-4">Reset your password</h1>
                  <p className="text-sm text-muted mt-2 max-w-xs mx-auto">
                    We&rsquo;ll send a secure reset link to the registered email of this project.
                  </p>
                </div>

                <button onClick={handleForgot} disabled={authLoading} className="btn btn-primary w-full" type="button">
                  {authLoading ? <LoaderCircle size={18} className="animate-spin" /> : 'Send Reset Link'}
                </button>
                <button type="button" onClick={() => setScreen('login')} className="mt-4 w-full text-center text-sm font-medium text-ink/60 hover:text-rose-deep flex items-center justify-center gap-1.5">
                  <ArrowLeft size={14} /> Back to login
                </button>
              </div>
            )}

            {screen === 'reset' && (
              <form onSubmit={handleReset} className="card p-8 sm:p-10">
                <div className="text-center mb-6">
                  <span className="inline-flex justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-rose to-pinkgold items-center text-white"><KeyRound size={24} /></span>
                  <h1 className="font-display text-2xl font-bold mt-4">Set a new password</h1>
                  <p className="text-sm text-muted mt-1">Use a strong password you&rsquo;ll remember.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="field-label">New password</label>
                    <input type="password" className="input-field" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 6 characters" required />
                  </div>
                  <div>
                    <label className="field-label">Confirm password</label>
                    <input type="password" className="input-field" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                  </div>
                  <button type="submit" className="btn btn-primary w-full" disabled={authLoading}>
                    {authLoading ? <LoaderCircle size={18} className="animate-spin" /> : 'Save New Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ---------- Dashboard ----------

  const managingEvent = selectedEventId ? grouped.events.find((e) => e.id === selectedEventId) : null
  const unreadMessages = grouped.totals?.unreadMessages || 0
  const isLiveEvent = grouped.events.some((e) => e.status === 'live')
  const liveEventTitle = grouped.events.find((e) => e.status === 'live')?.title

  // Newest-first from the API → oldest-first for display, so freshly added
  // items land at the BOTTOM of each list instead of jumping to the top.
  const orderedEvents = [...grouped.events].reverse()
  const orderedContacts = [...contacts].reverse()
  const orderedSponsors = [...sponsors].reverse()
  const orderedSubscribers = [...subscribers].reverse()

  const goSection = (s: Section) => {
    setSection(s)
    if (s === 'messages') { getJson('/api/admin/contacts', headers).then((d) => setContacts(d.contacts || [])).catch(() => {}) }
    if (s === 'subscribers') { getJson('/api/admin/subscribers', headers).then((d) => setSubscribers(d.subscribers || [])).catch(() => {}) }
    if (s === 'sponsors') { getJson('/api/admin/sponsors', headers).then((d) => setSponsors(d.sponsors || [])).catch(() => {}) }
  }

  async function copyAllEmails() {
    const list = subscribers.map((s) => s.email).filter(Boolean)
    if (list.length === 0) {
      toast.push('No emails to copy.', 'err')
      return
    }
    try {
      await navigator.clipboard.writeText(list.join(', '))
      toast.push(`Copied ${list.length} email${list.length === 1 ? '' : 's'}.`)
    } catch {
      // Clipboard API may be unavailable (non-secure context) — fall back to
      // a temporary textarea + execCommand for maximum compatibility.
      const ta = document.createElement('textarea')
      ta.value = list.join(', ')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        toast.push(`Copied ${list.length} email${list.length === 1 ? '' : 's'}.`)
      } catch {
        toast.push('Could not copy emails.', 'err')
      }
      document.body.removeChild(ta)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-blush/40 to-cream text-ink">
      {/* Sticky top bar */}
      <header className="silk-dark sticky top-0 z-40 border-b border-pinkgold/20 shadow-[0_10px_30px_-18px_rgba(0,0,0,0.5)]">
        <div className="container h-16 md:h-[72px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="relative shrink-0">
              <span className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose to-rose-deep flex items-center justify-center text-white font-display text-xl font-bold">D</span>
              <span className="absolute -inset-1 rounded-2xl border border-pinkgold/50" />
            </span>
            <div className="min-w-0">
              <h1 className="font-display text-base md:text-xl font-bold text-white leading-tight truncate">Shawty&rsquo;s Diary</h1>
              <ConnectionPill status={rtStatus} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn() && (
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white/50 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                <span className={`w-1.5 h-1.5 rounded-full ${isLiveEvent ? 'bg-red-400 animate-pulse' : 'bg-white/30'}`} />
                {isLiveEvent ? `Live · ${liveEventTitle ?? 'event'}` : 'No live event'}
              </span>
            )}
            <Link
              to="/"
              className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-white bg-white/5 border border-white/10 px-3 py-2 rounded-full transition-colors"
            >
              <ExternalLink size={13} /> <span className="hidden sm:inline">View</span> main site
            </Link>
            <button onClick={() => reloadAll()} className="flex items-center gap-2 p-2 text-muted hover:text-white bg-white/5 border border-white/10 rounded-full transition-colors" title="Refresh everything now">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={signOut} className="flex items-center gap-2 text-sm font-medium text-muted hover:text-white bg-white/5 border border-white/10 px-3 py-2 rounded-full transition-colors" title="Log out of the Diary">
              <LogOut size={15} /> <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Sticky tab rail — big, tappable, mobile-first */}
      <nav className="sticky top-16 md:top-[72px] z-30 bg-cream/90 backdrop-blur-md border-b border-black/5">
        <div className="container flex gap-1.5 py-2 overflow-x-auto no-scrollbar">
          <TabPill
            active={section === 'events' && subView === 'home'}
            onClick={() => setSection('events')}
            icon={CalendarDays}
            label="Events"
          />
          <TabPill
            active={section === 'sponsors'}
            onClick={() => goSection('sponsors')}
            icon={Handshake}
            label="Sponsors"
            count={sponsors.length}
          />
          <TabPill
            active={section === 'messages'}
            onClick={() => goSection('messages')}
            icon={MessageSquare}
            label="Messages"
            badge={unreadMessages}
          />
          <TabPill
            active={section === 'subscribers'}
            onClick={() => goSection('subscribers')}
            icon={Mail}
            label="Emails"
            count={subscribers.length}
          />
          <TabPill
            active={section === 'settings'}
            onClick={() => goSection('settings')}
            icon={ScrollText}
            label="Scrolling Text"
          />
        </div>
      </nav>

      {/* Breadcrumb / context strip */}
      {(subView !== 'home' || section !== 'events') && (
        <div className="container pt-4 pb-0 text-sm text-muted flex items-center gap-1.5 flex-wrap">
          {subView === 'manage' && managingEvent && (
            <>
              <button onClick={() => { setSubView('home'); setSelectedEventId(null) }} className="hover:text-rose-deep font-medium">All events</button>
              <span className="text-ink/30">/</span>
              <span className="font-medium text-ink/80 truncate">{managingEvent.title}</span>
            </>
          )}
          {subView === 'editor' && (
            <>
              <button onClick={() => { setSubView('home'); setEditingEvent(null) }} className="hover:text-rose-deep font-medium">All events</button>
              <span className="text-ink/30">/</span>
              <span className="font-medium text-ink/80">{editingEvent ? 'Edit event' : 'New event'}</span>
            </>
          )}
        </div>
      )}

      <main className="container py-5 md:py-7 pb-24">
        {section === 'events' && subView === 'editor' && (
          <EventEditor
            initial={editingEvent}
            saving={saving}
            onSave={handleSaveEvent}
            onCancel={() => { setSubView('home'); setEditingEvent(null) }}
          />
        )}

        {section === 'events' && subView === 'manage' && managingEvent && (
          <EventManage
            event={managingEvent}
            headers={headers}
            saving={saving}
            reloadKey={reloadTick}
            onBack={() => { setSubView('home'); setSelectedEventId(null) }}
            onEdit={() => handleEdit(managingEvent.id)}
            onSetLive={async () => { await handleSetLive(managingEvent.id) }}
            onEnd={async () => { await handleEnd(managingEvent.id) }}
          />
        )}

        {section === 'events' && subView === 'home' && (
          <EventsHome
            events={orderedEvents}
            totals={grouped.totals}
            loading={loading}
            saving={saving}
            headers={headers}
            onNew={handleCreateBlank}
            onEdit={handleEdit}
            onManage={handleManage}
            onDuplicate={(id) => { void handleDuplicate(id) }}
            onSetLive={(id) => { void handleSetLive(id) }}
            onEnd={(id) => { void handleEnd(id) }}
            onDelete={(id) => { void handleDelete(id) }}
            onOpenMessages={() => setSection('messages')}
            onOpenSubscribers={() => setSection('subscribers')}
          />
        )}

        {/* ---------- SPONSORS ---------- */}
        {section === 'sponsors' && (
          <div className="card overflow-hidden">
            <div className="p-6 flex items-center justify-between flex-wrap gap-3 border-b border-black/5">
              <div>
                <h3 className="font-semibold text-lg">All sponsors ({sponsors.length})</h3>
                <p className="text-sm text-muted">
                  Sponsorships support the brand, not a single event. Deactivated sponsors are hidden from the public “Our Sponsors” page.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setSponsorEmailOpen(true)} className="flex items-center gap-1.5 btn btn-outline !py-2" title="Email every sponsor">
                  <Send size={14} /> Send Email to Sponsors
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted text-xs bg-blush/30 border-b-2 border-pinkgold/40">
                    <th className="px-6 py-2.5">Logo / Docs</th>
                    <th className="px-6 py-2.5">Brand / Name</th>
                    <th className="px-6 py-2.5">Contact</th>
                    <th className="px-6 py-2.5">Package</th>
                    <th className="px-6 py-2.5">Amount</th>
                    <th className="px-6 py-2.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedSponsors.map((sp) => (
                    <tr key={sp.id} className="border-b border-pinkgold/25 align-top group hover:bg-blush/15">
                      <td className="px-6 py-3">
                        {sp.logoUrl || sp.logoBase64 ? (
                          <img
                            src={sp.logoUrl || (sp.logoBase64!.startsWith('data:') ? sp.logoBase64! : `data:image/png;base64,${sp.logoBase64!}`)}
                            alt={`${sp.brandName} logo`}
                            className="w-12 h-12 rounded-lg object-contain bg-white border border-pinkgold/30 p-1"
                          />
                        ) : (
                          <span className="w-12 h-12 rounded-lg border border-dashed border-pinkgold/50 bg-blush/30 flex items-center justify-center text-rose-deep/50">
                            <Image size={18} />
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="font-medium">{sp.brandName}</div>
                        {sp.reference && <div className="text-xs text-muted">{sp.reference}</div>}
                      </td>
                      <td className="px-6 py-3">
                        <div className="text-xs font-medium">{sp.contactName}</div>
                        <div className="text-xs text-muted">{sp.email}</div>
                        {sp.phone && <div className="text-xs text-muted">{sp.phone}</div>}
                        {sp.website && (
                          <a
                            href={sp.website}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-rose-deep hover:underline break-all"
                          >
                            <ExternalLink size={10} /> {sp.website.replace(/^https?:\/\//, '')}
                          </a>
                        )}
                        <button
                          onClick={() => setSponsorDetails(sp)}
                          className="mt-2 flex items-center gap-1 text-xs font-semibold text-rose-deep hover:underline cursor-pointer"
                        >
                          <Eye size={13} /> View Details
                        </button>
                      </td>
                      <td className="px-6 py-3">{PACKAGE_LABELS[sp.packageType] || sp.packageType}</td>
                      <td className="px-6 py-3">{sp.amount > 0 ? formatNgn(sp.amount) : 'In-kind'}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSponsorToggle(sp)}
                            className={`flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                              sp.deactivated
                                ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                                : 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                            }`}
                            title={sp.deactivated ? 'Reactivate sponsor' : 'Deactivate sponsor'}
                          >
                            <Power size={12} /> {sp.deactivated ? 'Reactivate' : 'Deactivate'}
                          </button>
                          <button
                            onClick={() => setSponsorDeleteTarget(sp)}
                            title="Delete sponsor"
                            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sponsors.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-12 text-center text-muted">No sponsors yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------- MESSAGES ---------- */}
        {section === 'messages' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Contact messages ({contacts.length})</h3>
                <p className="text-sm text-muted">Messages from the Contact page.</p>
              </div>
              <button onClick={() => reloadAll()} className="btn btn-outline !py-2">Refresh</button>
            </div>
            {orderedContacts.map((c) => (
              <div key={c.id} className="card p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-medium">{c.name} <span className="text-muted text-xs">· {c.email}</span></div>
                    {c.phone && <div className="text-sm text-ink/70">{c.phone}</div>}
                  </div>
                  <div className="flex items-center gap-2">
                    {!c.read && <span className="tag-chip !bg-green-100 !text-green-700">Unread</span>}
                    <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleString()}</span>
                    <button
                      onClick={() => setDeleteTarget(c)}
                      title="Delete message"
                      className="w-8 h-8 rounded-full bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <a
                  onClick={() => {
                    setContactDetails(c)
                    if (!c.read) markContactRead(c.id)
                  }}
                  className="text-emerald-600 hover:underline cursor-pointer text-xs mt-3 inline-block"
                >
                  View details
                </a>
              </div>
            ))}
            {contacts.length === 0 && <div className="card p-10 text-center text-muted">No messages yet.</div>}
          </div>
        )}

        {/* ---------- SUBSCRIBERS ---------- */}
        {section === 'subscribers' && (
          <div className="card overflow-hidden">
            <div className="p-6 flex items-center justify-between flex-wrap gap-3 border-b border-black/5">
              <div>
                <h3 className="font-semibold text-lg">All registered emails ({subscribers.length})</h3>
                <p className="text-sm text-muted">Every email on the platform — newsletter, registration, sponsor &amp; contact messages — deduplicated.</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={copyAllEmails} className="btn btn-outline !py-2" title="Copy all emails to the clipboard, comma-separated"><Copy size={14} /> Copy all emails</button>
                <button onClick={() => reloadAll()} className="btn btn-outline !py-2">Refresh</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted text-xs border-b border-black/8">
                    <th className="px-6 py-2">Email</th>
                    <th className="px-6 py-2">Source</th>
                    <th className="px-6 py-2">First seen</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedSubscribers.map((s, i) => (
                    <tr key={`${s.email}-${i}`} className="border-b border-black/5">
                      <td className="px-6 py-3 font-medium">
                        {s.email}
                        {s.unsubscribed && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 align-middle">unsubscribed</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {(s.sources || ['newsletter']).map((src) => (
                            <span key={src} className="text-xs px-2 py-0.5 rounded-full bg-blush text-rose-deep capitalize">{src}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-muted">{new Date(s.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                  {subscribers.length === 0 && <tr><td colSpan={3} className="px-6 py-12 text-center text-muted">No emails registered yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------- SCROLLING TEXT (homepage ticker) ---------- */}
        {section === 'settings' && <TickerPanel token={token} />}
      </main>

      {/* Transient realtime notice */}
      {notice && (
        <div key={notice.key} className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-pop-in">
          <div className="flex items-center gap-2 text-sm font-semibold text-white bg-ink/90 backdrop-blur px-4 py-2.5 rounded-full shadow-[0_12px_30px_-12px_rgba(42,27,34,0.5)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {notice.text}
          </div>
        </div>
      )}

      {/* Floating quick access to the live site for the signed-in owner */}
      <Link
        to="/"
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-br from-rose to-rose-deep px-4 py-3 rounded-full shadow-[0_14px_30px_-12px_rgba(145,78,108,0.7)] hover:scale-[1.03] active:scale-95 transition-transform"
      >
        <ExternalLink size={15} /> Live site
      </Link>

      {contactAction && (
        <Modal open onClose={() => setContactAction(null)}>
          <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${contactAction.kind === 'whatsapp' ? 'bg-green-100 text-green-600' : 'bg-blush text-rose-deep'}`}>
            {contactAction.kind === 'whatsapp' ? <MessageCircle size={26} /> : <Phone size={26} />}
          </div>
          <h3 className="text-lg font-bold text-center">{contactAction.kind === 'whatsapp' ? 'Message on WhatsApp?' : 'Call?'}</h3>
          <p className="text-sm text-muted text-center mt-2">
            {contactAction.kind === 'whatsapp'
              ? `Open WhatsApp to message ${contactAction.phone}?`
              : `Start a call to ${contactAction.phone}?`}
          </p>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setContactAction(null)} className="btn btn-light flex-1">Cancel</button>
            <button
              onClick={() => {
                if (contactAction.kind === 'whatsapp') {
                  window.open(`https://wa.me/${contactAction.phone.replace(/\D/g, '')}`, '_blank', 'noopener')
                } else {
                  window.location.href = `tel:${contactAction.phone.replace(/\s+/g, '')}`
                }
                setContactAction(null)
              }}
              className={`btn flex-1 ${contactAction.kind === 'whatsapp' ? 'bg-green-500 text-white hover:bg-green-600' : 'btn-primary'}`}
            >
              Proceed
            </button>
          </div>
        </Modal>
      )}

      {sponsorContactAction && (
        <Modal open onClose={() => setSponsorContactAction(null)}>
          <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${
            sponsorContactAction.kind === 'whatsapp' ? 'bg-green-100 text-green-600'
              : sponsorContactAction.kind === 'email' ? 'bg-rose/15 text-rose-deep'
              : 'bg-blush text-rose-deep'
          }`}>
            {sponsorContactAction.kind === 'whatsapp' ? <MessageCircle size={26} />
              : sponsorContactAction.kind === 'email' ? <Mail size={26} />
              : <Phone size={26} />}
          </div>
          <h3 className="text-lg font-bold text-center">
            {sponsorContactAction.kind === 'whatsapp' ? 'Message on WhatsApp?'
              : sponsorContactAction.kind === 'email' ? 'Send an email?'
              : 'Call?'}
          </h3>
          <p className="text-sm text-muted text-center mt-2">
            {sponsorContactAction.kind === 'whatsapp'
              ? `Open WhatsApp to message ${sponsorContactAction.phone}?`
              : sponsorContactAction.kind === 'email'
                ? `Open your email app to write to ${sponsorContactAction.email}?`
                : `Start a call to ${sponsorContactAction.phone}?`}
          </p>
          <div className="flex gap-3 mt-6">
            <button onClick={() => setSponsorContactAction(null)} className="btn btn-light flex-1">Cancel</button>
            <button
              onClick={() => {
                const a = sponsorContactAction
                if (a.kind === 'whatsapp') {
                  window.open(`https://wa.me/${a.phone.replace(/\D/g, '')}`, '_blank', 'noopener')
                } else if (a.kind === 'email') {
                  window.location.href = `mailto:${a.email}`
                } else {
                  window.location.href = `tel:${a.phone.replace(/\s+/g, '')}`
                }
                setSponsorContactAction(null)
              }}
              className={`btn flex-1 ${sponsorContactAction.kind === 'whatsapp' ? 'bg-green-500 text-white hover:bg-green-600' : 'btn-primary'}`}
            >
              Proceed
            </button>
          </div>
        </Modal>
      )}

      {contactDetails && (
        <Modal open wide onClose={() => setContactDetails(null)}>
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-blush flex items-center justify-center">
              <MessageSquare className="text-rose-dark" size={26} />
            </div>
            <h3 className="font-display text-2xl font-bold mt-3">{contactDetails.name}</h3>
            <p className="text-xs text-muted mt-1">{new Date(contactDetails.createdAt).toLocaleString()}</p>
          </div>

          <div className="flex items-center justify-center gap-2 mb-6">
            {contactDetails.phone && (
              <>
                <button
                  onClick={() => setContactAction({ kind: 'call', phone: contactDetails.phone! })}
                  title="Call"
                  className="w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-ink/70 hover:text-ink transition-colors"
                >
                  <Phone size={16} />
                </button>
                <button
                  onClick={() => setContactAction({ kind: 'whatsapp', phone: contactDetails.phone! })}
                  title="Message on WhatsApp"
                  className="w-10 h-10 rounded-full bg-green-500 text-white hover:bg-green-600 flex items-center justify-center transition-colors"
                >
                  <MessageCircle size={16} />
                </button>
              </>
            )}
            <a
              href={`mailto:${contactDetails.email}`}
              title="Send email"
              className="w-10 h-10 rounded-full bg-rose text-white hover:bg-rose-deep flex items-center justify-center transition-colors"
            >
              <Mail size={16} />
            </a>
          </div>

          <div className="pt-5 border-t border-black/5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">Contact details</h4>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Name</div>
                <div className="font-medium">{contactDetails.name}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Email</div>
                <div className="font-medium break-words">{contactDetails.email}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Phone</div>
                <div className="font-medium">{contactDetails.phone || '—'}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Subject</div>
                <div className="font-medium">{contactDetails.subject}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Date submitted</div>
                <div className="font-medium">{new Date(contactDetails.createdAt).toLocaleString()}</div>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-5 border-t border-black/5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">Message</h4>
            <p className="text-sm text-ink/75 whitespace-pre-wrap">{contactDetails.message}</p>
          </div>
        </Modal>
      )}

      {sponsorDetails && (
        <Modal open wide onClose={() => setSponsorDetails(null)}>
          <div className="text-center mb-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-blush flex items-center justify-center">
              <Handshake className="text-rose-dark" size={26} />
            </div>
            {(sponsorDetails.logoUrl || sponsorDetails.logoBase64) && (
              <div className="mt-4 flex flex-col items-center gap-2">
                <button
                  onClick={() => setSponsorLogoPreview(sponsorLogoSrc(sponsorDetails))}
                  title="View full image"
                  className="rounded-xl border border-black/10 bg-white p-2 cursor-zoom-in transition-transform hover:scale-105"
                >
                  <img
                    src={sponsorLogoSrc(sponsorDetails)}
                    alt={`${sponsorDetails.brandName} brand identification`}
                    className="h-28 w-auto object-contain max-w-full"
                  />
                </button>
                <button
                  onClick={() => downloadImage(sponsorLogoSrc(sponsorDetails), `${sponsorDetails.brandName} logo`)}
                  title="Download image"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-dark hover:text-rose transition-colors"
                >
                  <Download size={14} /> Download image
                </button>
              </div>
            )}
            <h3 className="font-display text-2xl font-bold mt-3">{sponsorDetails.brandName}</h3>
            {sponsorDetails.reference && <p className="text-xs text-muted mt-1">{sponsorDetails.reference}</p>}
            <div className="flex items-center justify-center gap-2 mt-3">
              {sponsorDetails.phone && (
                <>
                  <button
                    onClick={() => setSponsorContactAction({ kind: 'call', phone: sponsorDetails.phone!, email: sponsorDetails.email })}
                    title="Call"
                    className="w-10 h-10 rounded-full bg-black/5 hover:bg-black/10 flex items-center justify-center text-ink/70 hover:text-ink transition-colors"
                  >
                    <Phone size={16} />
                  </button>
                  <button
                    onClick={() => setSponsorContactAction({ kind: 'whatsapp', phone: sponsorDetails.phone!, email: sponsorDetails.email })}
                    title="Message on WhatsApp"
                    className="w-10 h-10 rounded-full bg-green-500 text-white hover:bg-green-600 flex items-center justify-center transition-colors"
                  >
                    <MessageCircle size={16} />
                  </button>
                </>
              )}
              <button
                onClick={() => setSponsorContactAction({ kind: 'email', phone: sponsorDetails.phone || '', email: sponsorDetails.email })}
                title="Send email"
                className="w-10 h-10 rounded-full bg-rose text-white hover:bg-rose-deep flex items-center justify-center transition-colors cursor-pointer"
              >
                <Mail size={16} />
              </button>
            </div>
            <div className="flex justify-center gap-1.5 mt-2">
              {sponsorDetails.deactivated && <span className="tag-chip !bg-red-100 !text-red-600">Deactivated</span>}
              <span className="tag-chip">{sponsorDetails.status}</span>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm border-t border-black/5 pt-5">
            <DetailField label="Full name / Organization" value={sponsorDetails.brandName} />
            <DetailField label="Contact person" value={sponsorDetails.contactName} />
            <DetailField label="Sponsor type" value={sponsorDetails.sponsorType || '—'} />
            <DetailField label="Email" value={sponsorDetails.email} />
            <DetailField label="Phone" value={sponsorDetails.phone} />
            <DetailField label="Package" value={PACKAGE_LABELS[sponsorDetails.packageType] || sponsorDetails.packageType} />
            <DetailField label="Amount" value={sponsorDetails.amount > 0 ? formatNgn(sponsorDetails.amount) : 'In-kind'} />
            <DetailField label="Country" value={sponsorDetails.country || '—'} />
            <DetailField label="State / Region" value={sponsorDetails.state || '—'} />
            <DetailField label="Date submitted" value={sponsorDetails.createdAt ? new Date(sponsorDetails.createdAt).toLocaleString() : '—'} />
          </div>

          {(sponsorDetails.socials?.length || sponsorDetails.website) && (
            <div className="mt-5 pt-5 border-t border-black/5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">Online presence</h4>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {sponsorDetails.website && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">Website</div>
                    <a
                      href={sponsorDetails.website}
                      target="_blank"
                      rel="noreferrer"
                      className="text-rose-deep font-medium hover:underline inline-flex items-center gap-1 break-all"
                    >
                      <ExternalLink size={12} /> {sponsorDetails.website}
                    </a>
                  </div>
                )}
                {sponsorDetails.socials?.map((s, i) => (
                  <div key={i}>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{s.platform}</div>
                    <div className="font-medium break-words">@{s.handle}</div>
                  </div>
                ))}
                {!sponsorDetails.socials?.length && <DetailField label="Social media" value="Not provided" />}
              </div>
            </div>
          )}

          {(sponsorDetails.supportAreas?.length || sponsorDetails.sponsorshipType) && (
            <div className="mt-5 pt-5 border-t border-black/5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">Sponsorship details</h4>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                <DetailField label="Supporting" value={sponsorDetails.supportAreas?.join(', ') || '—'} />
                <DetailField label="Sponsorship type" value={sponsorDetails.sponsorshipType || '—'} />
                <DetailField label="Usage preference" value={sponsorDetails.usagePreference || '—'} />
                <DetailField
                  label="Recognition"
                  value={sponsorDetails.publicRecognition ? (sponsorDetails.displayName || 'Yes') : 'No — anonymous'}
                />
              </div>
              {sponsorDetails.address && <DetailField label="Address" value={sponsorDetails.address} />}
              {sponsorDetails.notes && (
                <div className="mt-5 pt-5 border-t border-black/5">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">Message</h4>
                  <RichText className="text-sm text-ink/80 leading-relaxed block" text={sponsorDetails.notes} />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={() => setSponsorDetails(null)} className="btn btn-light flex-1">Close</button>
            <button
              onClick={() => { const t = sponsorDetails; setSponsorDetails(null); setSponsorToggle(t) }}
              className={`btn flex-1 ${sponsorDetails.deactivated ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-red-500 text-white hover:bg-red-600'}`}
            >
              {sponsorDetails.deactivated ? 'Reactivate' : 'Deactivate'}
            </button>
          </div>
        </Modal>
      )}

      {sponsorLogoPreview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true" onClick={() => setSponsorLogoPreview('')}>
          <button
            onClick={() => setSponsorLogoPreview('')}
            aria-label="Close preview"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
          <img
            src={sponsorLogoPreview}
            alt="Sponsor logo preview"
            className="max-w-full max-h-[82vh] object-contain rounded-xl bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => {
              e.stopPropagation()
              downloadImage(sponsorLogoPreview, 'sponsor-logo')
            }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-semibold hover:bg-rose-deep transition-colors"
          >
            <Download size={16} /> Download image
          </button>
        </div>
      )}

      {sponsorToggle && (
        <Modal open onClose={() => setSponsorToggle(null)}>
          <div className="text-center mb-4">
            <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4 ${sponsorToggle.deactivated ? 'bg-green-100 text-green-600' : 'bg-red-50 text-red-600 border border-red-100'}`}>
              <Power size={24} />
            </div>
            <h3 className="text-lg font-bold">{sponsorToggle.deactivated ? 'Reactivate this sponsor?' : 'Deactivate this sponsor?'}</h3>
            <p className="text-sm text-muted mt-2">
              {sponsorToggle.deactivated
                ? `"${sponsorToggle.brandName}" will be shown again on the public Sponsors page.`
                : `"${sponsorToggle.brandName}" will be hidden from the public Sponsors page until you reactivate it.`}
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setSponsorToggle(null)} className="btn btn-light flex-1" disabled={saving}>Cancel</button>
            <button
              onClick={() => toggleSponsorActive(sponsorToggle)}
              className={`btn flex-1 ${sponsorToggle.deactivated ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-red-500 text-white hover:bg-red-600'}`}
              disabled={saving}
            >
              {saving ? <LoaderCircle size={18} className="animate-spin" /> : (sponsorToggle.deactivated ? 'Reactivate' : 'Deactivate')}
            </button>
          </div>
        </Modal>
      )}

      {sponsorDeleteTarget && (
        <Modal open onClose={() => !sponsorDeleting && setSponsorDeleteTarget(null)}>
          <div className="text-center mb-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
              <Trash2 className="text-red-600" size={28} />
            </div>
            <h3 className="text-xl font-bold">Delete this sponsor?</h3>
            <p className="text-sm text-muted mt-2 max-w-sm mx-auto">
              This will permanently remove{" "}
              <span className="font-medium text-ink">{sponsorDeleteTarget.brandName}</span> and all of
              their sponsorship details. This cannot be undone.
            </p>
          </div>
          <div className="rounded-xl bg-blush/50 border border-rose/10 px-4 py-3 text-sm text-ink/70 mb-5">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">Sponsor</span>
            {sponsorDeleteTarget.brandName}
            {sponsorDeleteTarget.email && <span className="block text-xs text-muted mt-0.5">{sponsorDeleteTarget.email}</span>}
          </div>
          <div className="flex gap-3">
            <button onClick={() => !sponsorDeleting && setSponsorDeleteTarget(null)} className="btn btn-light flex-1" disabled={sponsorDeleting}>Cancel</button>
            <button
              onClick={() => deleteSponsor(sponsorDeleteTarget)}
              className="btn flex-1 bg-red-500 text-white hover:bg-red-600"
              disabled={sponsorDeleting}
            >
              {sponsorDeleting ? <><LoaderCircle size={18} className="animate-spin" /> Deleting…</> : 'Delete sponsor'}
            </button>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal open onClose={() => !deleting && setDeleteTarget(null)}>
          <div className="text-center mb-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
              <Trash2 className="text-red-600" size={28} />
            </div>
            <h3 className="text-xl font-bold">Delete this message?</h3>
            <p className="text-sm text-muted mt-2 max-w-sm mx-auto">
              This will permanently remove the message from{" "}
              <span className="font-medium text-ink">{deleteTarget.name}</span> and it cannot be
              undone.
            </p>
          </div>
          <div className="rounded-xl bg-blush/50 border border-rose/10 px-4 py-3 text-sm text-ink/70 mb-5">
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">Subject</span>
            {deleteTarget.subject || 'General message'}
          </div>
          <div className="flex gap-3">
            <button onClick={() => !deleting && setDeleteTarget(null)} className="btn btn-light flex-1" disabled={deleting}>Cancel</button>
            <button
              onClick={() => deleteContact(deleteTarget.id)}
              className="btn flex-1 bg-red-500 text-white hover:bg-red-600"
              disabled={deleting}
            >
              {deleting ? <><LoaderCircle size={18} className="animate-spin" /> Deleting…</> : 'Delete message'}
            </button>
          </div>
        </Modal>
      )}

      {sponsorEmailOpen && (
        <Modal open wide onClose={() => setSponsorEmailOpen(false)}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <h3 className="text-lg font-bold">Email to Sponsors</h3>
              <p className="text-sm text-muted mt-1">
                Reaches every sponsor on the platform ({sponsors.length} sponsor{sponsors.length === 1 ? '' : 's'}), excluding anyone who unsubscribed.
              </p>
            </div>
            <button onClick={() => setSponsorEmailOpen(false)} className="p-1.5 rounded-full hover:bg-black/5 text-ink/60" title="Close">
              <X size={18} />
            </button>
          </div>
          <div className="space-y-4 mt-4">
            <div>
              <label className="field-label">Subject</label>
              <input
                className="input-field"
                placeholder="e.g. Thank you for supporting Shawty Beauty Studio"
                value={sponsorEmailSubject}
                onChange={(e) => setSponsorEmailSubject(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Message</label>
              <textarea
                className="input-field min-h-32 resize-y"
                placeholder="Write your message to the sponsors…"
                value={sponsorEmailMessage}
                onChange={(e) => setSponsorEmailMessage(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setSponsorEmailOpen(false)} className="btn btn-light flex-1">Cancel</button>
              <button onClick={sendSponsorEmail} className="btn btn-primary flex-1" disabled={saving}>
                {saving ? <LoaderCircle size={18} className="animate-spin" /> : 'Send to all sponsors'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ---------- Helpers ----------

function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="font-medium break-words">{value || '—'}</div>
    </div>
  )
}

function ConnectionPill({ status }: { status: RealtimeStatus }) {
  const map = {
    open: { dot: 'bg-emerald-400', text: 'ONLINE', cls: 'text-emerald-300' },
    connecting: { dot: 'bg-amber-400 animate-pulse', text: 'CONNECTING', cls: 'text-amber-300' },
    closed: { dot: 'bg-white/30', text: 'OFFLINE', cls: 'text-white/50' },
  }[status]
  const Icon = status === 'closed' ? WifiOff : Wifi
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest ${map.cls}`}>
      <Icon size={11} />
      <span className={`w-1.5 h-1.5 rounded-full ${map.dot}`} />
      {map.text}
    </span>
  )
}

function TabPill({ active, onClick, icon: Icon, label, count, badge }: {
  active: boolean
  onClick: () => void
  icon: typeof CalendarDays
  label: string
  count?: number
  badge?: number
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap relative transition-all cursor-pointer ${
        active
          ? 'bg-white text-rose-deep shadow-[0_6px_18px_-8px_rgba(145,78,108,0.45)] border border-pinkgold/30'
          : 'text-ink/55 hover:text-ink bg-transparent'
      }`}
    >
      <Icon size={15} /> {label}
      {typeof count === 'number' && count > 0 && !active && (
        <span className="text-[10px] font-bold bg-blush text-rose-deep px-1.5 py-0.5 rounded-full">{count}</span>
      )}
      {typeof badge === 'number' && badge > 0 && (
        <span className={`absolute -top-1 -right-1 text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${active ? 'bg-red-500 text-white' : 'bg-red-500 text-white'} animate-pulse`}>
          {badge}
        </span>
      )}
    </button>
  )
}