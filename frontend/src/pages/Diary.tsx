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
  Trash2,
  X,
  Download,
  ScrollText,
  Copy,
} from 'lucide-react'
import { getJson, patchJson, postJson, putJson, delJson } from '../lib/api'
import { isLoggedIn, clearAuthToken, storeAuthToken } from '../lib/authState'
import { useRealtime, type RealtimeEventType, type RealtimeStatus } from '../lib/useRealtime'
import { formatNgn, type StudioEvent } from '../lib/constants'
import { useToast } from '../components/Toasts'
import Modal from '../components/Modal'
import EmailComposer from '../components/EmailComposer'
import DraggableFab from '../components/layout/DraggableFab'
import MobileBottomNav from '../components/layout/MobileBottomNav'
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

interface SentEmailSummary {
  id: string
  subject: string
  scope: 'event' | 'sponsors' | 'global'
  eventId?: string
  eventTitle?: string
  createdAt: string
  total: number
  sent: number
  failed: number
  preview: string
  recipientEmails: string[]
}

interface SentEmailRecipient {
  email: string
  name?: string
  status: 'sent' | 'failed'
  error?: string
}

interface SentEmailDetail {
  id: string
  subject: string
  scope: string
  eventId?: string
  eventTitle?: string
  createdAt: string
  blocks: { type: 'text' | 'image'; text?: string; width?: string }[]
  recipients: SentEmailRecipient[]
}

type Section = 'events' | 'sponsors' | 'messages' | 'sentEmails' | 'settings'
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
    return s === 'sponsors' || s === 'messages' || s === 'sentEmails' || s === 'settings' ? s : 'events'
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
  const [navVisible, setNavVisible] = useState(true)
  const navHideTimer = useRef<number | undefined>(undefined)

  const [grouped, setGrouped] = useState<GroupedData>({ events: [], totals: null })
  const [contacts, setContacts] = useState<ContactMsg[]>([])
  const [sentEmails, setSentEmails] = useState<SentEmailSummary[]>([])
  const [sentEmailDetails, setSentEmailDetails] = useState<SentEmailDetail | null>(null)
  const [allSubscribers, setAllSubscribers] = useState<{ email: string; createdAt: string; sources: string[]; unsubscribed?: boolean }[]>([])
  const [emailDeleteTarget, setEmailDeleteTarget] = useState<string | null>(null)
  const [emailDeleting, setEmailDeleting] = useState(false)
  const [sentEmailDeleteTarget, setSentEmailDeleteTarget] = useState<string | null>(null)
  const [sentEmailDeleting, setSentEmailDeleting] = useState(false)
  const [sponsors, setSponsors] = useState<SponsorRow[]>([])
  const [sponsorDetails, setSponsorDetails] = useState<SponsorRow | null>(null)
  const [sponsorToggle, setSponsorToggle] = useState<SponsorRow | null>(null)
  const [sponsorDeleteTarget, setSponsorDeleteTarget] = useState<SponsorRow | null>(null)
  const [sponsorContactAction, setSponsorContactAction] = useState<{ kind: 'call' | 'whatsapp' | 'email'; phone: string; email: string } | null>(null)
  const [sponsorEmailOpen, setSponsorEmailOpen] = useState(false)
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

  // Bottom nav on phones: keep it visible while touching the page, then tuck
  // it out of the way after 15s of no touch so it doesn't block the screen.
  useEffect(() => {
    if (!token) return
    const hide = () => setNavVisible(false)
    const show = () => {
      setNavVisible(true)
      window.clearTimeout(navHideTimer.current)
      navHideTimer.current = window.setTimeout(hide, 15000)
    }
    window.addEventListener('touchstart', show, { passive: true })
    window.addEventListener('pointerdown', show)
    show()
    return () => {
      window.removeEventListener('touchstart', show)
      window.removeEventListener('pointerdown', show)
      window.clearTimeout(navHideTimer.current)
    }
  }, [token])

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
      if (section === 'sentEmails') {
        const s = await getJson('/api/admin/sent-emails', headers)
        setSentEmails(s.sentEmails || [])
        const subs = await getJson('/api/admin/subscribers', headers)
        setAllSubscribers(subs.subscribers || [])
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

  async function handleSetStatus(id: string, status: string) {
    setSaving(true)
    try {
      const data = await putJson(`/api/admin/events/${id}`, { status }, headers)
      await reloadEvents()
      toast.push(data.event?.title ? `${data.event.title} → ${status}.` : `Event status set to ${status}.`)
    } catch (err: any) {
      if (/unauthorized|invalid token/i.test(err.message || '')) {
        toast.push('Your session has expired. Please sign in again.', 'err')
        signOut()
        return
      }
      toast.push(err.message || 'Failed to update event status', 'err')
    } finally {
      setSaving(false)
    }
  }

  async function handleEnd(id: string) {
    setSaving(true)
    try {
      const data = await postJson(`/api/admin/events/${id}/end`, {}, headers)
      await reloadEvents()
      toast.push(data.message || 'Event finished.')
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
        </header>

        <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-20">
          <div className="w-full max-w-md">
            <button onClick={() => setScreen('login')} className="mx-auto flex items-center gap-2 text-white/60 hover:text-white text-[10px] sm:text-xs tracking-wide uppercase mb-6 whitespace-nowrap">
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
        <MobileBottomNav />
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

  const goSection = (s: Section) => {
    setSection(s)
    if (s === 'messages') { getJson('/api/admin/contacts', headers).then((d) => setContacts(d.contacts || [])).catch(() => {}) }
    if (s === 'sentEmails') {
      refreshSentEmails(true)
      getJson('/api/admin/subscribers', headers).then((d) => setAllSubscribers(d.subscribers || [])).catch(() => {})
    }
    if (s === 'sponsors') { getJson('/api/admin/sponsors', headers).then((d) => setSponsors(d.sponsors || [])).catch(() => {}) }
  }

  async function refreshSentEmails(silent = false) {
    if (!silent) setLoading(true)
    try {
      const s = await getJson('/api/admin/sent-emails', headers)
      setSentEmails(s.sentEmails || [])
    } catch (err: any) {
      toast.push(err.message || 'Failed to load sent emails', 'err')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function openSentEmail(id: string) {
    try {
      const d = await getJson(`/api/admin/sent-emails/${id}`, headers)
      setSentEmailDetails(d.email || null)
    } catch (err: any) {
      toast.push(err.message || 'Failed to load email details', 'err')
    }
  }

  async function copyAllEmails() {
    const emails = allSubscribers.map((s) => s.email)
    if (emails.length === 0) {
      toast.push('No registered emails to copy.', 'err')
      return
    }
    try {
      await navigator.clipboard.writeText(emails.join(', '))
      toast.push(`Copied ${emails.length} email${emails.length === 1 ? '' : 's'}.`)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = emails.join(', ')
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try {
        document.execCommand('copy')
        toast.push(`Copied ${emails.length} email${emails.length === 1 ? '' : 's'}.`)
      } catch {
        toast.push('Could not copy emails.', 'err')
      }
      document.body.removeChild(ta)
    }
  }

  async function deleteRegisteredEmail(email: string) {
    setEmailDeleting(true)
    try {
      await delJson(`/api/admin/subscribers/email?email=${encodeURIComponent(email)}`, headers)
      setEmailDeleteTarget(null)
      toast.push(`Removed ${email}`)
      const subs = await getJson('/api/admin/subscribers', headers)
      setAllSubscribers(subs.subscribers || [])
    } catch (err: any) {
      toast.push(err.message || 'Failed to remove email', 'err')
    } finally {
      setEmailDeleting(false)
    }
  }

  async function deleteSentEmail(id: string) {
    setSentEmailDeleting(true)
    try {
      await delJson(`/api/admin/sent-emails/${id}`, headers)
      setSentEmailDeleteTarget(null)
      toast.push('Sent email deleted.')
      const s = await getJson('/api/admin/sent-emails', headers)
      setSentEmails(s.sentEmails || [])
    } catch (err: any) {
      toast.push(err.message || 'Failed to delete', 'err')
    } finally {
      setSentEmailDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-blush/40 to-cream text-ink pb-[calc(3rem+env(safe-area-inset-bottom))] md:pb-0">
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
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-white bg-white/10 border border-white/20 px-3 py-1.5 rounded-full">
                <span className={`w-1.5 h-1.5 rounded-full ${isLiveEvent ? 'bg-red-400 animate-pulse' : 'bg-emerald-400'}`} />
                {isLiveEvent ? `Live · ${liveEventTitle ?? 'event'}` : 'No live event'}
              </span>
            )}
            <button onClick={() => reloadAll()} className="flex items-center gap-2 p-2 text-white bg-white/10 border border-white/20 rounded-full hover:bg-white/20 transition-colors" title="Refresh everything now">
              <RefreshCw size={15} className={`${loading ? 'animate-spin' : ''} text-white`} />
            </button>
            <button onClick={signOut} className="flex items-center gap-1.5 text-[11px] leading-none font-semibold text-white bg-white/10 border border-white/20 px-2.5 py-2 rounded-full hover:bg-white/20 transition-colors whitespace-nowrap" title="Log out of the Diary">
              <LogOut size={13} className="text-white" /> Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Sticky tab rail — hidden on phones, which get the permanent bottom nav instead */}
      <nav className="hidden md:block sticky top-[72px] z-30 bg-cream/90 backdrop-blur-md border-b border-black/5">
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
            active={section === 'sentEmails'}
            onClick={() => goSection('sentEmails')}
            icon={Mail}
            label="Sent Emails"
            count={sentEmails.length}
          />
          <TabPill
            active={section === 'settings'}
            onClick={() => goSection('settings')}
            icon={ScrollText}
            label="Scrolling Text"
          />
        </div>
      </nav>

      {/* Permanent phone bottom nav: each Diary section as icon + label; hides after 15s idle */}
      <nav className={`md:hidden fixed inset-x-0 bottom-0 z-40 backdrop-blur-xl bg-ink/95 border-t border-white/10 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] transition-transform duration-300 ease-out ${
        navVisible ? 'translate-y-0' : 'translate-y-full'
      }`}>
        <div className="flex items-stretch justify-around gap-1">
          <BottomTab active={section === 'events' && subView === 'home'} onClick={() => setSection('events')} icon={CalendarDays} label="Events" />
          <BottomTab active={section === 'sponsors'} onClick={() => goSection('sponsors')} icon={Handshake} label="Sponsors" count={sponsors.length} />
          <BottomTab active={section === 'messages'} onClick={() => goSection('messages')} icon={MessageSquare} label="Messages" badge={unreadMessages} />
          <BottomTab active={section === 'sentEmails'} onClick={() => goSection('sentEmails')} icon={Mail} label="Sent Emails" count={sentEmails.length} />
          <BottomTab active={section === 'settings'} onClick={() => goSection('settings')} icon={ScrollText} label="ScrollText" />
          <Link
            to="/"
            className="flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1 text-white/45 hover:text-white/80"
          >
            <ExternalLink size={18} strokeWidth={2} />
            <span className="text-[9px] leading-none font-semibold tracking-wide text-white/50">Main site</span>
          </Link>
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
            onManage={handleManage}
            onDuplicate={(id) => { void handleDuplicate(id) }}
            onSetStatus={(id, status) => { void handleSetStatus(id, status) }}
            onDelete={(id) => { void handleDelete(id) }}
            onOpenMessages={() => setSection('messages')}
            onOpenSubscribers={() => setSection('sentEmails')}
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
                  <tr className="text-center text-muted text-xs bg-blush/30 border-b-2 border-pinkgold/40">
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
                    <tr key={sp.id} className="border-b border-pinkgold/25 align-middle group hover:bg-blush/15">
                      <td className="px-6 py-3">
                        {sp.logoUrl || sp.logoBase64 ? (
                          <img
                            src={sp.logoUrl || (sp.logoBase64!.startsWith('data:') ? sp.logoBase64! : `data:image/png;base64,${sp.logoBase64!}`)}
                            alt={`${sp.brandName} logo`}
                            className="w-12 h-12 rounded-lg object-contain bg-white border border-pinkgold/30 p-1 mx-auto"
                          />
                        ) : (
                          <span className="w-12 h-12 rounded-lg border border-dashed border-pinkgold/50 bg-blush/30 flex items-center justify-center text-rose-deep/50 mx-auto">
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
                        <button
                          onClick={() => setSponsorDetails(sp)}
                          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                        >
                          <Eye size={13} /> View Details
                        </button>
                      </td>
                      <td className="px-6 py-3">{PACKAGE_LABELS[sp.packageType] || sp.packageType}</td>
                      <td className="px-6 py-3">{sp.amount > 0 ? formatNgn(sp.amount) : 'In-kind'}</td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-center gap-2">
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

        {/* ---------- SENT EMAILS ---------- */}
        {section === 'sentEmails' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-lg">Sent emails ({sentEmails.length})</h3>
                <p className="text-sm text-muted">Every broadcast sent from the Diary, with delivery stats. Click one to view full details.</p>
              </div>
              <button onClick={() => refreshSentEmails()} className="btn btn-outline !py-2">Refresh</button>
            </div>
            <div className="card overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium">
                    Registered emails ({allSubscribers.length})
                  </div>
                  <p className="text-sm text-muted">Newsletter, registration, sponsor &amp; contact emails, deduplicated. Expand to view or remove addresses.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => copyAllEmails()} className="btn btn-outline !py-2" title="Copy all registered emails to the clipboard, comma-separated">
                    <Copy size={14} /> Copy all emails
                  </button>
                </div>
              </div>
              <details className="group border-t border-black/5">
                <summary className="flex items-center justify-between px-4 py-2.5 text-sm font-medium cursor-pointer select-none hover:bg-black/2 transition-colors">
                  <span>{allSubscribers.length > 0 ? 'Show all emails' : 'No emails yet'}</span>
                  <span className="text-muted group-open:rotate-180 transition-transform">▾</span>
                </summary>
                {allSubscribers.length > 0 && (
                  <div className="max-h-72 overflow-y-auto border-t border-black/5">
                    {allSubscribers.map((s) => (
                      <div key={s.email} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-black/5 text-sm last:border-b-0 hover:bg-black/2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{s.email}</div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {(s.sources || []).map((src) => (
                              <span key={src} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blush text-rose-deep capitalize">{src}</span>
                            ))}
                            <span className="text-[10px] text-muted">{new Date(s.createdAt).toLocaleString()}</span>
                            {s.unsubscribed && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">unsubscribed</span>}
                          </div>
                        </div>
                        <button
                          onClick={() => setEmailDeleteTarget(s.email)}
                          title="Remove from registered list"
                          className="shrink-0 w-8 h-8 rounded-full bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            </div>

            {sentEmails.length === 0 && (
              <div className="card p-10 text-center text-muted">
                <Mail size={22} className="mx-auto mb-2 opacity-40" />
                No emails sent yet.
              </div>
            )}
            {sentEmails.map((e) => (
              <div
                key={e.id}
                onClick={() => openSentEmail(e.id)}
                className="card p-5 cursor-pointer hover:border-rose/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-muted flex items-center gap-1.5 mb-1 flex-wrap">
                      <Mail size={11} className="text-rose-deep" />
                      Sent {new Date(e.createdAt).toLocaleString()}
                      {e.eventTitle && <span className="tag-chip !py-0.5">{e.eventTitle}</span>}
                    </div>
                    <h4 className="font-semibold leading-snug">{e.subject}</h4>
                    {e.preview && <p className="text-sm text-ink/70 mt-1 line-clamp-2">{e.preview}</p>}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {e.recipientEmails.slice(0, 3).map((em) => (
                        <span key={em} className="text-[11px] px-2 py-0.5 rounded-full bg-ink/5 text-ink/70">{em}</span>
                      ))}
                      {e.total > 3 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-blush text-rose-deep font-medium">+{e.total - 3} more</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <button
                      onClick={(ev) => { ev.stopPropagation(); setSentEmailDeleteTarget(e.id) }}
                      title="Delete this email"
                      className="w-8 h-8 rounded-full bg-red-500/10 text-red-600 hover:bg-red-500 hover:text-white flex items-center justify-center transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                    <div className="text-xs text-muted mt-1">{e.total} recipient{e.total === 1 ? '' : 's'}</div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-green-600">✓ {e.sent} delivered</span>
                      {e.failed > 0 && <span className="text-xs font-semibold text-red-600">✗ {e.failed} failed</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
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

      {/* Floating quick access to the live site — draggable anywhere on the screen */}
      <DraggableFab storageKey="sbs-fab-live">
        <Link
          to="/"
          className="flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-br from-rose to-rose-deep px-4 py-3 rounded-full shadow-[0_14px_30px_-12px_rgba(145,78,108,0.7)] hover:scale-[1.03] active:scale-95 transition-transform select-none"
          title="Go to the live site"
          draggable={false}
        >
          <ExternalLink size={15} /> Live site
        </Link>
      </DraggableFab>

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

      {sentEmailDetails && (
        <Modal open wide onClose={() => setSentEmailDetails(null)}>
          <div className="text-center mb-6">
            <div className="w-14 h-14 mx-auto rounded-full bg-blush flex items-center justify-center">
              <Mail className="text-rose-deep" size={22} />
            </div>
            <div className="text-[10px] font-bold uppercase tracking-wide text-muted mt-3 flex items-center justify-center gap-1.5 flex-wrap">
              Sent {new Date(sentEmailDetails.createdAt).toLocaleString()}
              {sentEmailDetails.eventTitle && <span className="tag-chip !py-0.5">{sentEmailDetails.eventTitle}</span>}
              <span className="tag-chip !py-0.5 capitalize">{sentEmailDetails.scope}</span>
            </div>
            <h3 className="font-display text-xl font-bold mt-2">{sentEmailDetails.subject}</h3>
            <div className="flex items-center justify-center gap-3 mt-3 flex-wrap">
              <span className="text-xs font-semibold text-ink/70">{sentEmailDetails.recipients.length} recipient{sentEmailDetails.recipients.length === 1 ? '' : 's'}</span>
              <span className="text-xs font-semibold text-green-600">✓ {sentEmailDetails.recipients.filter((r) => r.status === 'sent').length} delivered</span>
              {sentEmailDetails.recipients.some((r) => r.status === 'failed') && (
                <span className="text-xs font-semibold text-red-600">
                  ✗ {sentEmailDetails.recipients.filter((r) => r.status === 'failed').length} failed
                </span>
              )}
            </div>
          </div>

          {sentEmailDetails.blocks.length > 0 && (
            <div className="rounded-2xl border border-rose/10 bg-blush/30 p-5 mb-6 max-h-72 overflow-y-auto">
              {sentEmailDetails.blocks.map((b, i) => {
                if (b.type === 'image') {
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted mb-3">
                      <Image size={14} /> Image attached ({b.width || 'full'})
                    </div>
                  )
                }
                return (
                  <p key={i} className="text-sm text-ink/80 whitespace-pre-line mb-3 last:mb-0">
                    {b.text}
                  </p>
                )
              })}
            </div>
          )}

          <div className="mb-5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-2">Recipients ({sentEmailDetails.recipients.length})</h4>
            <div className="rounded-xl border border-black/5 overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                {sentEmailDetails.recipients.map((r) => (
                  <div key={r.email} className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-black/5 text-sm last:border-b-0">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{r.email}</div>
                      {r.name && <div className="text-xs text-muted truncate">Name: {r.name}</div>}
                      {r.status === 'failed' && r.error && (
                        <div className="text-xs text-red-600 truncate">{r.error}</div>
                      )}
                    </div>
                    <span className={`shrink-0 text-xs font-semibold ${r.status === 'sent' ? 'text-green-600' : 'text-red-600'}`}>
                      {r.status === 'sent' ? '✓ delivered' : '✗ failed'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button onClick={() => setSentEmailDetails(null)} className="btn btn-light w-full">Close</button>
        </Modal>
      )}

      {emailDeleteTarget && (
        <Modal open onClose={() => !emailDeleting && setEmailDeleteTarget(null)}>
          <div className="text-center mb-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
              <Trash2 className="text-red-600" size={28} />
            </div>
            <h3 className="text-lg font-bold">Remove this email?</h3>
            <p className="text-sm text-muted mt-2 max-w-sm mx-auto">
              <span className="font-medium text-ink break-all">{emailDeleteTarget}</span> will be removed from the registered-emails list and won&apos;t receive future broadcasts.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => !emailDeleting && setEmailDeleteTarget(null)} className="btn btn-light flex-1" disabled={emailDeleting}>Cancel</button>
            <button
              onClick={() => deleteRegisteredEmail(emailDeleteTarget)}
              className="btn flex-1 bg-red-500 text-white hover:bg-red-600"
              disabled={emailDeleting}
            >
              {emailDeleting ? <><LoaderCircle size={18} className="animate-spin" /> Removing…</> : 'Remove email'}
            </button>
          </div>
        </Modal>
      )}

      {sentEmailDeleteTarget && (
        <Modal open onClose={() => !sentEmailDeleting && setSentEmailDeleteTarget(null)}>
          <div className="text-center mb-5">
            <div className="w-16 h-16 mx-auto rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-4">
              <Trash2 className="text-red-600" size={28} />
            </div>
            <h3 className="text-lg font-bold">Delete this email?</h3>
            <p className="text-sm text-muted mt-2 max-w-sm mx-auto">
              This will permanently remove this email from the sent-emails list. The recipients will still have the message in their inboxes.
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => !sentEmailDeleting && setSentEmailDeleteTarget(null)} className="btn btn-light flex-1" disabled={sentEmailDeleting}>Cancel</button>
            <button
              onClick={() => deleteSentEmail(sentEmailDeleteTarget)}
              className="btn flex-1 bg-red-500 text-white hover:bg-red-600"
              disabled={sentEmailDeleting}
            >
              {sentEmailDeleting ? <><LoaderCircle size={18} className="animate-spin" /> Deleting…</> : 'Delete'}
            </button>
          </div>
        </Modal>
      )}

      {sponsorEmailOpen && (
        <EmailComposer
          title="Email to Sponsors"
          subtitle={
            <p className="text-sm text-muted mt-1">
              Reaches the selected sponsor{sponsors.length === 1 ? '' : 's'} on the platform ({sponsors.length}), excluding anyone who unsubscribed.
            </p>
          }
          wide
          headers={headers}
          recipients={sponsors.map((s) => ({
            id: s.id,
            email: s.email,
            label: s.brandName || s.contactName,
            sublabel: s.contactName,
          }))}
          initialSubject=""
          initialMessage=""
          sendLabel="Send to sponsors"
          onClose={() => setSponsorEmailOpen(false)}
          onSend={async ({ subject, blocks, emails, names }) => {
            const data = await postJson(
              '/api/admin/broadcast',
              {
                subject,
                blocks,
                scope: 'sponsors',
                emails,
                names,
              },
              headers,
            )
            refreshSentEmails(true)
            return data
          }}
        />
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

// Compact icon + label tab for the permanent phone bottom nav.
function BottomTab({ active, onClick, icon: Icon, label, count, badge }: {
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
      className={`relative flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1 ${
        active ? 'text-pinkgold' : 'text-white/45 hover:text-white/80'
      }`}
    >
      <span className="relative">
        <Icon size={18} strokeWidth={active ? 2.4 : 2} />
        {typeof count === 'number' && count > 0 && (
          <span className="absolute -top-1 -right-2.5 text-[8px] font-bold bg-blush text-rose-deep px-1 py-px rounded-full">{count}</span>
        )}
        {typeof badge === 'number' && badge > 0 && (
          <span className="absolute -top-1 -right-2.5 text-[8px] font-bold w-3.5 h-3.5 flex items-center justify-center rounded-full bg-red-500 text-white animate-pulse">{badge > 9 ? '9+' : badge}</span>
        )}
      </span>
      <span className={`text-[9px] leading-none font-semibold tracking-wide ${active ? 'text-white' : 'text-white/50'}`}>{label}</span>
    </button>
  )
}