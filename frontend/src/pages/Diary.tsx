import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  CalendarDays,
  MessageSquare,
  Mail,
  Send,
  LoaderCircle,
  LogOut,
  CircleCheck,
  CircleAlert,
  KeyRound,
  ArrowLeft,
  RefreshCw,
  Plus,
  ImagePlus,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Trash2,
} from 'lucide-react'
import { getJson, patchJson, postJson } from '../lib/api'
import { formatNgn, type StudioEvent } from '../lib/constants'
import {
  EventsHome,
  EventEditor,
  EventManage,
  statusBadge,
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

interface BroadcastResult {
  sent: number
  failed: number
  total: number
}

type ComposerBlock =
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image'; dataUrl: string; width: 'full' | 'medium' | 'small' }

function blockId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// Downscale attached photos so emails stay light (max ~1600px, JPEG/PNG).
function compressImage(file: File, maxDim = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not decode image'))
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height))
        const width = Math.max(1, Math.round(img.width * scale))
        const height = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(reader.result as string)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
        resolve(canvas.toDataURL(mime, quality))
      }
      img.src = reader.result as string
    }
    reader.readAsDataURL(file)
  })
}

const TOKEN_KEY = 'sbs_admin_token'

type Section = 'events' | 'messages' | 'subscribers' | 'email'
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
    return s === 'messages' || s === 'subscribers' || s === 'email' ? s : 'events'
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
  const [authMsg, setAuthMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [grouped, setGrouped] = useState<GroupedData>({ events: [], unassigned: null, totals: null })
  const [contacts, setContacts] = useState<ContactMsg[]>([])
  const [subscribers, setSubscribers] = useState<Subscriber[]>([])
  const [subject, setSubject] = useState('')
  const [blocks, setBlocks] = useState<ComposerBlock[]>([])
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const [fileHover, setFileHover] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const [broadcastBusy, setBroadcastBusy] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState<BroadcastResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

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
      setError(err.message || 'Failed to load events')
      if (/unauthorized|invalid token/i.test(err.message)) signOut()
    }
  }

  async function reloadAll() {
    setLoading(true)
    setError('')
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
      if (section === 'email') {
        const s = await getJson('/api/admin/subscribers', headers)
        setSubscribers(s.subscribers || [])
      }
    } finally {
      setLoading(false)
    }
  }

  function updateBlock(id: string, patch: Partial<ComposerBlock>) {
    setBlocks((b) => b.map((x) => (x.id === id ? ({ ...x, ...patch } as ComposerBlock) : x)))
  }

  function removeBlock(id: string) {
    setBlocks((b) => b.filter((x) => x.id !== id))
  }

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((b) => {
      const i = b.findIndex((x) => x.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= b.length) return b
      const next = [...b]
      const [item] = next.splice(i, 1)
      next.splice(j, 0, item)
      return next
    })
  }

  function reorder(from: number, to: number) {
    if (from === to) return
    setBlocks((b) => {
      const next = [...b]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  async function addImage(file?: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    if (file.size > 5_000_000) {
      setError('Each image must be under 5MB.')
      return
    }
    try {
      const dataUrl = await compressImage(file)
      setBlocks((b) => [...b, { id: blockId(), type: 'image', dataUrl, width: 'full' }])
    } catch (e: any) {
      setError(e.message || 'Could not add that image')
    }
  }

  // Insert an image right after the given block index (used when dropping a
  // photo onto a specific block rather than into the empty composer area).
  async function insertImageAfter(index: number, file?: File | null) {
    if (!file) return
    if (!file.type.startsWith('image/')) return
    try {
      const dataUrl = await compressImage(file)
      const blk: ComposerBlock = { id: blockId(), type: 'image', dataUrl, width: 'full' }
      setBlocks((b) => {
        const next = [...b]
        next.splice(Math.min(index + 1, next.length), 0, blk)
        return next
      })
    } catch (e: any) {
      setError(e.message || 'Could not add that image')
    }
  }

  function addTextBlock() {
    setBlocks((b) => [...b, { id: blockId(), type: 'text', text: '' }])
  }

  async function sendBroadcast() {
    if (!subject.trim()) return
    const hasContent = blocks.some((b) =>
      b.type === 'text' ? b.text.trim().length > 0 : true,
    )
    if (!hasContent) return
    setBroadcastBusy(true)
    setBroadcastResult(null)
    try {
      const payload = blocks.map((b) =>
        b.type === 'text'
          ? { type: 'text' as const, text: b.text }
          : { type: 'image' as const, dataUrl: b.dataUrl, width: b.width },
      )
      const r = await postJson(
        '/api/admin/broadcast',
        { subject: subject.trim(), blocks: payload, origin: window.location.origin },
        headers,
      )
      setBroadcastResult({ sent: r.sent || 0, failed: r.failed || 0, total: r.total || 0 })
      if (r.failed === 0) {
        setSubject('')
        setBlocks([])
      }
    } catch (e: any) {
      setError(e.message || 'Could not send emails')
    } finally {
      setBroadcastBusy(false)
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
    setAuthMsg(null)
    try {
      const data = await postJson('/api/auth/login', { username, password })
      setToken(data.token)
      localStorage.setItem(TOKEN_KEY, data.token)
    } catch (err: any) {
      setAuthMsg({ type: 'err', text: err.message || 'Login failed' })
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleForgot() {
    setAuthLoading(true)
    setAuthMsg(null)
    try {
      await postJson('/api/auth/forgot-password', { origin: window.location.origin })
      setAuthMsg({ type: 'ok', text: 'Reset link has been sent to the registered email.' })
    } catch (err: any) {
      setAuthMsg({ type: 'err', text: err.message || 'Could not send reset link.' })
    } finally {
      setAuthLoading(false)
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setAuthLoading(true)
    setAuthMsg(null)
    if (newPassword !== confirmPassword) {
      setAuthMsg({ type: 'err', text: 'Passwords do not match.' })
      setAuthLoading(false)
      return
    }
    try {
      await postJson('/api/auth/reset-password', { token: resetToken, newPassword })
      setAuthMsg({ type: 'ok', text: 'Password updated. Sign in with your new password.' })
      setNewPassword('')
      setConfirmPassword('')
      setPassword('')
      setScreen('login')
    } catch (err: any) {
      setAuthMsg({ type: 'err', text: err.message || 'Reset failed. The link may be invalid or expired.' })
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
    setError('')
    setNotice('')
    try {
      await postJson('/api/admin/events', { fromEventId: id }, headers)
      await reloadEvents()
      setNotice('Event duplicated.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleSetLive(id: string) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const data = await postJson(`/api/admin/events/${id}/live`, {}, headers)
      await reloadEvents()
      setNotice(data.message || 'Event is now live on the site.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleEnd(id: string) {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      const data = await postJson(`/api/admin/events/${id}/end`, {}, headers)
      await reloadEvents()
      setNotice(data.message || 'Event ended.')
    } catch (err: any) {
      if (/unauthorized|invalid token/i.test(err.message || '')) {
        setAuthMsg({ type: 'err', text: 'Your session has expired. Please sign in again.' })
        signOut()
        return
      }
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const ev = grouped.events.find((e) => e.id === id)
    if (!confirm(`Delete "${ev?.title || 'this event'}"? Its registrations and sponsors stay saved but won't be grouped under it.`)) return
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await fetch(`/api/admin/events/${encodeURIComponent(id)}`, { method: 'DELETE', headers })
      await reloadEvents()
      setNotice('Event deleted.')
    } catch (err: any) {
      setError(err.message || 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEvent(data: Omit<StudioEvent, 'id' | 'createdAt' | 'updatedAt'>) {
    setSaving(true)
    setError('')
    setNotice('')
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
      setNotice('Event saved.')
    } catch (err: any) {
      setError(err.message || 'Failed to save event')
    } finally {
      setSaving(false)
    }
  }

  async function markContactRead(id: string) {
    try {
      await patchJson(`/api/admin/contacts/${id}/read`, {}, headers)
      setContacts((cs) => cs.map((c) => (c.id === id ? { ...c, read: true } : c)))
    } catch (err: any) {
      setError(err.message)
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

              {authMsg && (
                <div className={`mb-5 p-3 rounded-xl text-sm flex items-start gap-2 ${
                  authMsg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {authMsg.type === 'ok' ? <CircleCheck size={18} className="shrink-0" /> : <CircleAlert size={18} className="shrink-0" />}
                  {authMsg.text}
                </div>
              )}

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

              <button type="button" onClick={() => { setScreen('forgot'); setAuthMsg(null) }} className="mt-5 w-full text-center text-sm font-medium text-rose-deep hover:text-rose-dark flex items-center justify-center gap-1.5">
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

              {authMsg && (
                <div className={`mb-5 p-3 rounded-xl text-sm flex items-start gap-2 ${
                  authMsg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {authMsg.type === 'ok' ? <CircleCheck size={18} className="shrink-0" /> : <CircleAlert size={18} className="shrink-0" />}
                  {authMsg.text}
                </div>
              )}

              <button onClick={handleForgot} disabled={authLoading} className="btn btn-primary w-full" type="button">
                {authLoading ? <LoaderCircle size={18} className="animate-spin" /> : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => { setScreen('login'); setAuthMsg(null) }} className="mt-4 w-full text-center text-sm font-medium text-ink/60 hover:text-rose-deep flex items-center justify-center gap-1.5">
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

              {authMsg && (
                <div className={`mb-5 p-3 rounded-xl text-sm flex items-start gap-2 ${
                  authMsg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                }`}>
                  {authMsg.type === 'ok' ? <CircleCheck size={18} className="shrink-0" /> : <CircleAlert size={18} className="shrink-0" />}
                  {authMsg.text}
                </div>
              )}

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
            <TabBtn active={section === 'email'} onClick={async () => { setSection('email'); setBroadcastResult(null); const s = await getJson('/api/admin/subscribers', headers); setSubscribers(s.subscribers || []) }} icon={Send} label="Send Email" />
          </div>
        </div>
      </header>

      <div className="container py-6 md:py-8">
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2">
            <CircleAlert size={20} className="shrink-0" /> {error}
            <button onClick={() => setError('')} className="ml-auto text-xs font-semibold underline">Dismiss</button>
          </div>
        )}

        {notice && (
          <div className="mb-6 p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-start gap-2">
            <CircleCheck size={20} className="shrink-0" /> {notice}
            <button onClick={() => setNotice('')} className="ml-auto text-xs font-semibold underline">Dismiss</button>
          </div>
        )}

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

        {/* ---------- SEND EMAIL ---------- */}
        {section === 'email' && (
          <div className="card overflow-hidden">
            <div className="p-6 border-b border-black/5">
              <h3 className="font-semibold text-lg">Send an email</h3>
              <p className="text-sm text-muted mt-1">
                One email goes to <strong>{subscribers.length}</strong> people — every unique address from
                newsletters, registrations, sponsors and contact messages. Emails that opted out are skipped
                automatically, and each one carries an unsubscribe link.
              </p>
            </div>

            <div className="p-6">
              <label className="field-label">Subject</label>
              <input
                className="input-field text-base"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Our 5-day masterclass is open for enrolment"
                maxLength={200}
              />
              <p className="text-xs text-muted mt-1">
                This becomes the heading in the designed banner at the top of the email.
              </p>

              <div className="mt-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <label className="field-label mb-0">Content</label>
                    <p className="text-xs text-muted mt-1">
                      Drag photos from your computer and drop them anywhere in the email, then drag blocks to
                      rearrange them.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        files.forEach((f) => void addImage(f))
                        e.target.value = ''
                      }}
                    />
                    <button onClick={addTextBlock} className="btn btn-outline !py-2 flex items-center gap-1.5">
                      <Plus size={14} /> Paragraph
                    </button>
                    <button
                      onClick={() => imageInputRef.current?.click()}
                      className="btn btn-primary !py-2 flex items-center gap-1.5"
                    >
                      <ImagePlus size={14} /> Add image
                    </button>
                  </div>
                </div>

                <div
                  className={`mt-3 space-y-2 p-3 rounded-2xl border-2 border-dashed transition-colors ${
                    fileHover ? 'border-rose bg-blush/50' : 'border-black/15 bg-white/40'
                  }`}
                  onDragOver={(e) => {
                    if (Array.from(e.dataTransfer.types).includes('Files')) {
                      e.preventDefault()
                      setFileHover(true)
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setFileHover(false)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    setFileHover(false)
                    Array.from(e.dataTransfer.files || []).forEach((f) => void addImage(f))
                  }}
                >
                  {blocks.length === 0 && (
                    <div className="py-10 text-center">
                      <ImagePlus size={28} className="mx-auto text-muted/60 mb-2" />
                      <p className="text-sm text-muted">
                        Drop images here, or use the buttons above to add a paragraph or an image.
                      </p>
                    </div>
                  )}

                  {blocks.map((b, i) => (
                    <div
                      key={b.id}
                      onDragOver={(e) => {
                        e.preventDefault()
                        if (dragIdx !== null) setDragOverIdx(i)
                      }}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragIdx !== null) {
                          reorder(dragIdx, i)
                          setDragIdx(null)
                          setDragOverIdx(null)
                        } else if (Array.from(e.dataTransfer.types).includes('Files')) {
                          const files = Array.from(e.dataTransfer.files || [])
                          files.forEach((f, fi) => void insertImageAfter(i + fi, f))
                        }
                      }}
                      className={`rounded-xl border bg-white/70 p-3.5 transition-shadow ${
                        dragOverIdx === i ? 'border-rose ring-2 ring-rose/30' : 'border-black/10'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          draggable
                          onDragStart={() => setDragIdx(i)}
                          onDragEnd={() => {
                            setDragIdx(null)
                            setDragOverIdx(null)
                          }}
                          title="Drag to reorder"
                          className="cursor-grab active:cursor-grabbing text-muted hover:text-rose-deep"
                        >
                          <GripVertical size={16} />
                        </span>
                        <span className="text-xs font-semibold text-rose-deep uppercase tracking-wide">
                          {b.type === 'text' ? 'Paragraph' : 'Image'}
                        </span>
                        <span className="ml-auto flex items-center gap-0.5">
                          <button
                            onClick={() => moveBlock(b.id, -1)}
                            disabled={i === 0}
                            title="Move up"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:bg-black/5 hover:text-ink disabled:opacity-30"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            onClick={() => moveBlock(b.id, 1)}
                            disabled={i === blocks.length - 1}
                            title="Move down"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:bg-black/5 hover:text-ink disabled:opacity-30"
                          >
                            <ChevronDown size={14} />
                          </button>
                          <button
                            onClick={() => removeBlock(b.id)}
                            title="Remove"
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:bg-red-50 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </span>
                      </div>

                      {b.type === 'text' ? (
                        <textarea
                          className="input-field"
                          rows={Math.max(3, Math.min(9, Math.ceil(b.text.length / 70)))}
                          value={b.text}
                          onChange={(e) => updateBlock(b.id, { text: e.target.value })}
                          placeholder="Write a paragraph…"
                          maxLength={20000}
                        />
                      ) : (
                        <div className="flex items-start gap-3 flex-wrap">
                          <img
                            src={b.dataUrl}
                            alt="attachment preview"
                            className="max-h-36 rounded-lg border border-black/10 object-contain"
                          />
                          <div>
                            <div className="text-xs text-muted mb-1">Image width</div>
                            <div className="flex gap-1">
                              {(['full', 'medium', 'small'] as const).map((w) => (
                                <button
                                  key={w}
                                  onClick={() => updateBlock(b.id, { width: w })}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize ${
                                    b.width === w ? 'bg-rose text-white' : 'bg-black/5 text-ink/70 hover:bg-black/10'
                                  }`}
                                >
                                  {w}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3 mt-5 flex-wrap">
                <button
                  onClick={sendBroadcast}
                  disabled={
                    broadcastBusy ||
                    !subject.trim() ||
                    !blocks.some((b) => (b.type === 'text' ? b.text.trim().length > 0 : true))
                  }
                  className="btn btn-primary flex items-center gap-2"
                >
                  {broadcastBusy ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}
                  {broadcastBusy ? 'Sending…' : 'Send to everyone'}
                </button>
                {broadcastResult && (
                  <span className={`text-sm ${broadcastResult.failed > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                    Sent to {broadcastResult.sent} of {broadcastResult.total}
                    {broadcastResult.failed > 0 ? ` · ${broadcastResult.failed} failed` : ''}.
                  </span>
                )}
              </div>

              {subject.trim() && blocks.some((b) => (b.type === 'text' ? b.text.trim().length > 0 : true)) && (
                <p className="text-xs text-muted mt-4">
                  Sends to {subscribers.length} recipients. The email opens with a banner showing your subject, then
                  your content in order. Double-check before sending.
                </p>
              )}
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