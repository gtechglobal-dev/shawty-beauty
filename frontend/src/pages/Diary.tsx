import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  MessageSquare,
  Mail,
  LoaderCircle,
  LogOut,
  KeyRound,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react'
import { getJson, patchJson, postJson } from '../lib/api'
import { type StudioEvent } from '../lib/constants'
import { useToast } from '../components/Toasts'
import {
  EventsHome,
  EventEditor,
  EventManage,
  type DiaryEvent,
  type DiaryUnassigned,
  type DiaryTotals,
} from './diary/Events'

// ---------- Types ----------

interface ContactMsg {
  id: string
  name: string
  email: string
  subject: string
  message: string
  read: boolean
  createdAt: string
}

interface Subscriber {
  email: string
  createdAt: string
  sources: string[]
  unsubscribed?: boolean
}

const TOKEN_KEY = 'sbs_admin_token'

type Section = 'events' | 'messages' | 'subscribers'
type SubView = 'home' | 'manage' | 'editor'

interface GroupedData {
  events: DiaryEvent[]
  unassigned: DiaryUnassigned | null
  totals: DiaryTotals | null
}

// ---------- Auth helpers (shared with Admin login) ----------

export default function Diary() {
  const [searchParams, setSearchParams] = useSearchParams()
  const resetToken = searchParams.get('reset') || ''

  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || '')
  const [screen, setScreen] = useState<'login' | 'forgot' | 'reset'>(resetToken ? 'reset' : 'login')
const [section, setSection] = useState<Section>(() => {
    const s = searchParams.get('section')
    return s === 'messages' || s === 'subscribers' ? s : 'events'
  })
  const [subView, setSubView] = useState<SubView>(() => {
    const s = searchParams.get('sub')
    return s === 'manage' || s === 'editor' ? s : 'home'
  })
  const [selectedEventId, setSelectedEventId] = useState<string | null>(searchParams.get('event'))
  const [editingEvent, setEditingEvent] = useState<DiaryEvent | null>(null)

  const [username, setUsername] = useState('Shawty')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [authLoading, setAuthLoading] = useState(false)

  const [grouped, setGrouped] = useState<GroupedData>({ events: [], unassigned: null, totals: null })
  const [contacts, setContacts] = useState<ContactMsg[]>([])
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const toast = useToast()
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    if (token) reloadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // Keep the current page/view in the URL (e.g. /diary?sub=manage&event=...)
  // so an F5 refresh lands back on the same admin screen instead of resetting
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

  async function reloadEvents() {
    try {
      const data = await getJson('/api/admin/events', headers)
      setGrouped({
        events: data.events || [],
        unassigned: data.unassigned || null,
        totals: data.totals || null,
      })
    } catch (err: any) {
      toast.push(err.message || 'Failed to load events', 'err')
      if (/unauthorized|invalid token/i.test(err.message)) signOut()
    }
  }

  async function reloadAll() {
    setLoading(true)
    try {
      await reloadEvents()
      if (section === 'messages') {
        const c = await getJson('/api/admin/contacts', headers)
        setContacts(c.contacts || [])
      }
      if (section === 'subscribers') {
        const s = await getJson('/api/admin/subscribers', headers)
        setSubscribers(s.subscribers || [])
      }
    } finally {
      setLoading(false)
    }
  }

  function signOut() {
    setToken('')
    localStorage.removeItem(TOKEN_KEY)
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
      localStorage.setItem(TOKEN_KEY, data.token)
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
    if (!confirm(`Delete "${ev?.title || 'this event'}"? Its registrations and sponsors stay saved but won't be grouped under it.`)) return
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
        // Create first (seed from defaults), then fully overwrite with the editor data
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

  // ---------- Auth screens ----------

  if (!token) {
    return (
      <div className="silk-dark relative min-h-[85vh] flex items-center justify-center px-4 py-16">
        <div className="relative z-10 w-full max-w-md">
          {screen === 'login' && (
            <form onSubmit={handleLogin} className="card p-8 sm:p-10">
              <div className="text-center mb-6">
                <span className="inline-flex justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-rose to-rose-deep items-center text-white font-display text-2xl font-bold shadow-[0_10px_24px_-10px_rgba(145,78,108,0.6)]">
                  S
                </span>
                <h1 className="font-display text-2xl sm:text-3xl font-bold mt-4">Shawty&rsquo;s Diary</h1>
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
                  <input type="password" className="input-field" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
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
    )
  }

  // ---------- Dashboard ----------

  const managingEvent = selectedEventId ? grouped.events.find((e) => e.id === selectedEventId) : null

  return (
    <div className="bg-gradient-to-b from-cream via-blush/40 to-cream min-h-[80vh]">
      {/* Diary header */}
      <header className="silk-dark relative overflow-hidden border-b border-pinkgold/20">
        <div className="container py-5 md:py-6 flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <span className="relative">
              <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose to-rose-deep flex items-center justify-center text-white font-display text-xl font-bold shadow-[0_10px_22px_-10px_rgba(0,0,0,0.5)]">D</span>
              <span className="absolute -inset-1 rounded-2xl border border-pinkgold/50" />
            </span>
            <div>
              <h1 className="font-display text-xl md:text-2xl font-bold text-white leading-tight">Shawty&rsquo;s Diary</h1>
              <p className="text-xs text-muted tracking-[0.22em] uppercase mt-0.5">Events · forms · submissions</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={reloadAll} className="flex items-center gap-2 text-sm text-muted hover:text-white bg-white/5 border border-white/10 px-4 py-2 rounded-full transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button onClick={signOut} className="flex items-center gap-2 text-sm font-medium text-muted hover:text-white bg-white/5 border border-white/10 px-4 py-2 rounded-full transition-colors">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="container relative z-10 flex gap-2 overflow-x-auto pb-0">
          <TabBtn active={section === 'events' && subView === 'home'} onClick={() => { setSection('events'); setSubView('home') }} icon={CalendarDays} label="Events" />
          {subView === 'manage' && section === 'events' && (
            <span className="text-white/40 text-sm flex items-center px-2 whitespace-nowrap">/ {managingEvent?.title ?? 'Event'}</span>
          )}
          {subView === 'editor' && section === 'events' && (
            <span className="text-white/40 text-sm flex items-center px-2 whitespace-nowrap">/ {editingEvent ? 'Edit event' : 'New event'}</span>
          )}
          <div className="flex ml-auto gap-2">
            <TabBtn active={section === 'messages'} onClick={async () => { setSection('messages'); const c = await getJson('/api/admin/contacts', headers); setContacts(c.contacts || []) }} icon={MessageSquare} label={`Messages${grouped.totals?.unreadMessages ? ` (${grouped.totals.unreadMessages})` : ''}`} />
            <TabBtn active={section === 'subscribers'} onClick={async () => { setSection('subscribers'); const s = await getJson('/api/admin/subscribers', headers); setSubscribers(s.subscribers || []) }} icon={Mail} label="Subscribers" />
          </div>
        </div>
      </header>

      <div className="container py-6 md:py-8">
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
            unassigned={grouped.unassigned}
            headers={headers}
            saving={saving}
            onBack={() => { setSubView('home'); setSelectedEventId(null) }}
            onEdit={() => handleEdit(managingEvent.id)}
            onSetLive={async () => { await handleSetLive(managingEvent.id) }}
            onEnd={async () => { await handleEnd(managingEvent.id) }}
          />
        )}

        {section === 'events' && subView === 'home' && (
          <EventsHome
            events={grouped.events}
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
            {contacts.map((c) => (
              <div key={c.id} className="card p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-medium">{c.name} <span className="text-muted text-xs">· {c.email}</span></div>
                    <div className="text-sm text-rose-dark font-medium mt-0.5">{c.subject}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!c.read && (
                      <button onClick={() => markContactRead(c.id)} className="tag-chip cursor-pointer hover:opacity-80">Mark read</button>
                    )}
                    {!c.read && <span className="tag-chip !bg-green-100 !text-green-700">Unread</span>}
                    <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-sm text-ink/75 mt-3 whitespace-pre-wrap">{c.message}</p>
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
              <button onClick={() => reloadAll()} className="btn btn-outline !py-2">Refresh</button>
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
                  {subscribers.map((s, i) => (
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

      </div>
    </div>
  )
}

function TabBtn({ active, onClick, icon: Icon, label }: {
  active: boolean
  onClick: () => void
  icon: typeof CalendarDays
  label: string
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-t-xl text-sm font-semibold whitespace-nowrap transition-all ${
        active
          ? 'bg-cream text-rose-deep shadow-[0_-4px_14px_-6px_rgba(42,27,34,0.2)]'
          : 'text-muted hover:text-white'
      }`}
    >
      <Icon size={15} /> {label}
    </button>
  )
}