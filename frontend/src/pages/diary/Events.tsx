import { useEffect, useState } from 'react'
import {
  Plus,
  Copy,
  Trash2,
  Radio,
  Pencil,
  ExternalLink,
  ArrowLeft,
  Save,
  LoaderCircle,
  CircleCheck,
  CircleAlert,
  CalendarDays,
  Users,
  Ticket as TicketIcon,
  Crown,
  TrendingUp,
  RefreshCw,
  KeyRound,
  Send,
  ChevronDown,
  Eye,
  X,
} from 'lucide-react'
import { formatNgn, eventRegisterUrl, type StudioEvent, type Ticket } from '../../lib/constants'
import { getJson, patchJson, postJson, delJson } from '../../lib/api'
import Modal from '../../components/Modal'

// ------------------------------------------------------------------
// Shared types
// ------------------------------------------------------------------

export interface DiarySummary {
  registrations: number
  paid: number
  pending: number
  approved: number
  cancelled: number
  revenueRegistrations: number
  present: number
  attendanceByDay: Record<string, number>
  sponsors: number
  confirmedSponsors: number
  sponsorsRevenue: number
  revenue: number
  latestRegistrations: {
    id: string
    fullName: string
    ticketType: string
    quantity: number
    amount: number
    status: string
    createdAt: string
  }[]
}

export type DiaryEvent = StudioEvent & {
  attendanceLabels: string[]
  summary: DiarySummary
}

export interface DiaryUnassigned {
  registrations: number
  latestRegistrations: {
    id: string
    fullName: string
    status: string
    createdAt: string
  }[]
  sponsors: number
}

export interface DiaryTotals {
  events: number
  messages: number
  unreadMessages: number
  subscribers: number
}

interface RegistrationRow {
  id: string
  fullName: string
  phone: string
  email: string
  instagram: string
  photoBase64?: string
  ticketType: string
  ticketLabel?: string
  quantity: number
  amount: number
  status: string
  reason?: string
  attendance?: Record<string, boolean>
  present?: boolean
  createdAt: string
  dateOfBirth?: string
  state?: string
  nationality?: string
  address?: string
  experienceLevel?: string
  emergencyContactName?: string
  emergencyContact?: string
}

interface SponsorRow {
  id: string
  brandName: string
  contactName: string
  email: string
  phone: string
  packageType: string
  amount: number
  notes: string
  status: string
  featured: boolean
}

export function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    paid: 'bg-green-100 text-green-700',
    approved: 'bg-green-100 text-green-700',
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  }
  return `inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-black/5 text-ink/60'}`
}

export function dayKeys(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `d${i + 1}`)
}

function isPresent(r: { present?: boolean; attendance?: Record<string, boolean> }): boolean {
  return Boolean(r.present || (r.attendance && Object.values(r.attendance).some(Boolean)))
}

// ------------------------------------------------------------------
// Events home (grouped overview)
// ------------------------------------------------------------------

export function EventsHome({
  events,
  totals,
  loading,
  saving,
  headers,
  onNew,
  onEdit,
  onManage,
  onDuplicate,
  onSetLive,
  onEnd,
  onDelete,
  onOpenMessages,
  onOpenSubscribers,
}: {
  events: DiaryEvent[]
  totals: DiaryTotals | null
  loading: boolean
  saving: boolean
  headers: Record<string, string>
  onNew: () => void
  onEdit: (id: string) => void
  onManage: (id: string) => void
  onDuplicate: (id: string) => void
  onSetLive: (id: string) => void
  onEnd: (id: string) => void
  onDelete: (id: string) => void
  onOpenMessages: () => void
  onOpenSubscribers: () => void
}) {
  const [trackingEvent, setTrackingEvent] = useState<DiaryEvent | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [pendingEnd, setPendingEnd] = useState<DiaryEvent | null>(null)

  return (
    <div className="space-y-8">
      {/* Global pulse strip */}
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onOpenMessages} className="tag-chip cursor-pointer hover:opacity-80 !text-sm">
          <CircleAlert size={14} className="inline -mt-0.5 mr-1" />
          {totals?.unreadMessages || 0} unread messages
        </button>
        <button onClick={onOpenSubscribers} className="tag-chip cursor-pointer hover:opacity-80 !text-sm">
          <MailIcon /> {totals?.subscribers || 0} subscribers
        </button>
        <span className="tag-chip !text-sm">{totals?.events || 0} events</span>
        <div className="ml-auto">
          <button onClick={onNew} className="btn btn-primary !py-2.5 flex items-center gap-1.5">
            <Plus size={16} /> Create New Event
          </button>
        </div>
      </div>

      {/* Events grid */}
      <div>
        <h3 className="font-semibold text-lg mb-1">Events &amp; everything connected to them</h3>
        <p className="text-sm text-muted mb-4">
          Each event groups its own registrations, attendance and sponsors. Click a card to drop down the session
          attendance and actions — or press{' '}
          <strong className="text-rose-deep"> Create New Event </strong> to start a happening. Making an event live
          switches the homepage banner, program page and registration forms to it automatically.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-muted py-12 justify-center">
            <LoaderCircle size={18} className="animate-spin" /> Loading events…
          </div>
        ) : events.length === 0 ? (
          <div className="card p-10 text-center text-muted">No events yet — create your first happening.</div>
        ) : (
          <div className="relative">
            <div className="grid lg:grid-cols-2 gap-4">
            {events.map((ev) => {
              const labels: string[] = ev.attendanceLabels
              const counts = ev.summary?.attendanceByDay || {}
              const s = ev.summary
              const open = expandedId === ev.id
              const toggle = () => setExpandedId(open ? null : ev.id)
              return (
                <div key={ev.id} className={`card overflow-hidden flex flex-col ${ev.status === 'live' ? 'border-2 border-pinkgold/60 shadow-[0_10px_30px_-12px_rgba(145,78,108,0.35)]' : ''}`}>
                  {/* Card header — title + all stats */}
                  <div
                    className={`p-5 ${ev.status === 'live' ? 'bg-gradient-to-br from-rose-deep via-rose-dark to-pinkgold text-white' : 'bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {ev.status === 'live' ? (
                          <span className="tag-chip !py-1 !bg-red-600 !bg-none !text-white animate-pulse shadow-[0_0_0_4px_rgba(220,38,38,0.18)]">
                            <span className="relative flex w-1.5 h-1.5" aria-hidden>
                              <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                              <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-white" />
                            </span>
                            Live Now
                          </span>
                        ) : (
                          <span className={`tag-chip !py-1 ${ev.status === 'ended' ? '!bg-black/10' : '!bg-amber-100 !text-amber-700'}`}>
                            {ev.status === 'ended' ? 'Ended' : 'Scheduled'}
                          </span>
                        )}
                        {ev.datesLabel && <span className={`text-xs ${ev.status === 'live' ? 'text-white/80' : 'text-muted'}`}>{ev.datesLabel}</span>}
                      </div>
                      <div className="flex items-center gap-0.5 -mr-1">
                        <IconBtn title="Manage" dark={ev.status === 'live'} onClick={(e) => { e.stopPropagation(); onManage(ev.id) }}><Pencil size={14} /></IconBtn>
                        <IconBtn title="Duplicate" dark={ev.status === 'live'} onClick={(e) => { e.stopPropagation(); onDuplicate(ev.id) }}><Copy size={14} /></IconBtn>
                        <IconBtn title="Delete" danger dark={ev.status === 'live'} onClick={(e) => { e.stopPropagation(); onDelete(ev.id) }}><Trash2 size={14} /></IconBtn>
                      </div>
                    </div>
                    <h3 className={`font-display text-xl font-bold leading-snug mt-2 pr-8 ${ev.status === 'live' ? 'text-white' : ''}`}>{ev.title}</h3>
                  </div>

                  <div className={`p-5 grow ${ev.status === 'live' ? 'bg-gradient-to-b from-blush/40 to-transparent' : ''}`}>
                    <StatGrid
                      items={[
                        { icon: Users, label: 'Registered', value: s.registrations },
                        { icon: TicketIcon, label: 'Paid tickets', value: s.paid },
                        { icon: CalendarDays, label: 'Present', value: s.present },
                        { icon: Crown, label: 'Sponsors', value: `${s.confirmedSponsors}/${s.sponsors}` },
                        { icon: TrendingUp, label: 'Revenue', value: formatNgn(s.revenue) },
                      ]}
                    />

                    <button
                      onClick={toggle}
                      aria-expanded={open}
                      className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-rose-deep hover:underline cursor-pointer"
                    >
                      {open ? 'View less' : 'View more'}
                      <ChevronDown size={15} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                    </button>

                    {open && (
                      <div className="mt-5 space-y-5">
                        {ev.theme && (
                          <p className={`text-sm italic ${ev.status === 'live' ? 'text-ink/70' : 'text-ink/60'}`}>
                            “{ev.theme}”
                          </p>
                        )}

                        {/* Attendance mini-bars */}
                        {labels.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Attendance by session</div>
                            <div className="flex flex-wrap gap-2">
                              {ev.attendanceLabels.map((label, i) => (
                                <div key={label} className="flex-1 min-w-[70px] bg-black/[0.03] rounded-lg px-2 py-1.5">
                                  <div className="text-xs font-semibold truncate">{label}</div>
                                  <div className="text-sm font-bold text-rose-deep">{counts[dayKeys(ev.attendanceDays)[i]] ?? 0}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-2 flex-wrap">
                          {ev.status !== 'live' && (
                            <button
                              onClick={() => onSetLive(ev.id)}
                              className="inline-flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-rose-dark to-rose text-white px-4 py-2 rounded-full hover:opacity-90 shadow-[0_8px_20px_-8px_rgba(179,99,128,0.6)]"
                            >
                              <Radio size={14} /> Make Live
                            </button>
                          )}
                          <button onClick={() => onManage(ev.id)} className="btn btn-outline !py-2">Manage event</button>
                          <button
                            onClick={() => setTrackingEvent(ev)}
                            className="btn btn-outline !py-2 flex items-center gap-1.5"
                          >
                            <KeyRound size={13} /> Track attendance
                          </button>
                          <a
                            href={eventRegisterUrl(ev)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline !py-2 flex items-center gap-1.5"
                          >
                            Register page <ExternalLink size={13} />
                          </a>
                          {ev.status !== 'ended' && (
                            <button
                              onClick={() => setPendingEnd(ev)}
                              className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 border border-red-200 bg-red-50 px-4 py-2 rounded-full hover:bg-red-100"
                            >
                              <CircleAlert size={14} /> End Event
                            </button>
                          )}
                          {ev.status === 'ended' && (
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold bg-black/10 text-ink/60 px-4 py-2 rounded-full">
                              <CircleAlert size={14} /> Finished — past event
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            </div>
            {saving && (
              <div className="absolute inset-0 z-10 bg-white/75 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-2.5">
                <LoaderCircle size={22} className="animate-spin text-rose-deep" />
                <span className="text-sm font-medium text-ink/80">Updating event…</span>
              </div>
            )}
          </div>
        )}
      </div>

      {trackingEvent && (
        <TrackAttendanceModal
          event={trackingEvent}
          headers={headers}
          onClose={() => setTrackingEvent(null)}
        />
      )}

      {pendingEnd && (
        <EndEventModal
          open
          event={pendingEnd}
          onCancel={() => setPendingEnd(null)}
          onConfirm={() => {
            onEnd(pendingEnd.id)
            setPendingEnd(null)
          }}
        />
      )}
    </div>
  )
}

function TrackAttendanceModal({
  event,
  headers,
  onClose,
}: {
  event: DiaryEvent
  headers: Record<string, string>
  onClose: () => void
}) {
  const counts = event.summary?.attendanceByDay || {}
  const [codes, setCodes] = useState<Record<string, { createdAt: string }>>({})
  const [genBusy, setGenBusy] = useState<string | null>(null)
  const [visible, setVisible] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(`sbd:attendance-codes:${event.id}`) || '{}') || {}
    } catch {
      return {}
    }
  })
  const [err, setErr] = useState('')
  const [copiedDay, setCopiedDay] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getJson(`/api/admin/events/${event.id}/attendance-codes`, headers)
      .then((r) => {
        if (!alive) return
        const map: Record<string, { createdAt: string }> = {}
        for (const c of r.codes || []) map[c.day] = c
        setCodes(map)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [event.id, headers])

  useEffect(() => {
    try {
      localStorage.setItem(`sbd:attendance-codes:${event.id}`, JSON.stringify(visible))
    } catch {
      /* storage unavailable */
    }
  }, [visible, event.id])

  async function generate(day: string) {
    setGenBusy(day)
    setErr('')
    try {
      const r = await postJson(`/api/admin/events/${event.id}/attendance-code`, { day }, headers)
      if (r.code) {
        setVisible((v) => ({ ...v, [day]: r.code }))
        setCodes((c) => ({ ...c, [day]: { createdAt: new Date().toISOString() } }))
      } else {
        setErr(r.message || 'Could not generate the code.')
      }
    } catch (e: any) {
      setErr(e.message || 'Something went wrong.')
    } finally {
      setGenBusy(null)
    }
  }

  async function copyCode(day: string, code: string) {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedDay(day)
      setTimeout(() => setCopiedDay((d) => (d === day ? null : d)), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Modal open onClose={onClose}>
      <h3 className="font-semibold text-lg pr-8">Track attendance</h3>
      <p className="text-sm text-muted mt-1">{event.title}</p>
      <p className="text-sm text-muted mt-3">
        Students scan their ticket QR, then type the code for the session they're attending. Each session has one shared
        code so a whole class can check in together in seconds.
      </p>

      <div className="space-y-3 mt-5">
        {event.attendanceLabels.map((label, i) => {
          const day = dayKeys(event.attendanceDays)[i]
          const existing = codes[day]
          const present = counts[day] ?? 0
          const code = visible[day]
          return (
            <div key={day} className="border border-black/10 rounded-xl p-4 bg-white/60">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm">{label}</div>
                  <div className="text-xs text-muted mt-0.5">
                    {present} present
                    {existing ? ' · code active' : ''}
                  </div>
                </div>
                <button
                  onClick={() => generate(day)}
                  disabled={genBusy === day}
                  className="btn btn-primary !py-1.5 !px-3 !text-xs flex items-center gap-1.5"
                >
                  {genBusy === day ? <LoaderCircle size={13} className="animate-spin" /> : <KeyRound size={13} />}
                  {existing ? 'Regenerate' : 'Generate code'}
                </button>
              </div>

              {code && (
                <div className="mt-3 flex items-center gap-2 bg-blush/60 rounded-lg px-3 py-2.5 border border-rose/30">
                  <span className="font-mono text-lg font-bold tracking-[0.25em] text-rose-deep flex-1 select-all">
                    {code}
                  </span>
                  <button
                    onClick={() => copyCode(day, code)}
                    className="text-xs font-semibold text-rose-deep flex items-center gap-1 hover:underline shrink-0"
                  >
                    {copiedDay === day ? (
                      <>
                        <CircleCheck size={13} /> Copied
                      </>
                    ) : (
                      <>
                        <Copy size={13} /> Copy
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {err && <p className="text-sm text-red-600 mt-3">{err}</p>}
      <p className="text-[11px] text-muted mt-4 leading-relaxed">
        Generated codes stay visible on this screen while you share them with the class. Regenerating a session's code
        makes the previous one stop working.
      </p>
    </Modal>
  )
}

function EndEventModal({
  open,
  event,
  onCancel,
  onConfirm,
}: {
  open: boolean
  event: { title: string } | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel}>
      <div className="text-center py-2">
        <div className="inline-flex w-14 h-14 rounded-2xl bg-red-50 border border-red-100 items-center justify-center mb-5">
          <CircleAlert size={28} className="text-red-600" />
        </div>
        <h3 className="font-display text-xl md:text-2xl font-bold leading-tight">End this event?</h3>
        {event?.title && (
          <p className="font-display text-base font-semibold text-rose-deep mt-1.5 leading-snug">“{event.title}”</p>
        )}
        <p className="text-sm text-ink/70 mt-4 leading-relaxed max-w-sm mx-auto">
          This event will be marked as a <strong className="text-ink">past event</strong> and removed from the
          landing page. Ticket sales and registration on its page will close.
        </p>
        <div className="mt-4 rounded-xl bg-green-50 border border-green-100 px-4 py-3 text-sm text-ink/75 flex items-start gap-2 text-left max-w-sm mx-auto">
          <CircleCheck size={16} className="text-green-600 shrink-0 mt-0.5" />
          <span>
            You can bring it back anytime with <strong className="text-ink">Make Live</strong> — its registrations,
            attendance and sponsors stay saved.
          </span>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="btn btn-outline !py-2.5">Cancel</button>
          <button
            onClick={onConfirm}
            className="btn !py-2.5 !bg-red-600 !text-white hover:!bg-red-700 flex items-center justify-center gap-1.5"
          >
            <CircleAlert size={15} /> End Event
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ------------------------------------------------------------------
// Event editor (create / edit — replaces details of the previous event)
// ------------------------------------------------------------------

interface TicketDraft {
  id: string
  label: string
  price: string
  originalPrice: string
  promoDeadlineIso: string
  unitName: string
  includes: string
  highlighted: boolean
}

function ticketToDraft(t: Ticket): TicketDraft {
  return {
    id: t.id,
    label: t.label,
    price: String(t.price),
    originalPrice: t.originalPrice ? String(t.originalPrice) : '',
    promoDeadlineIso: t.promoDeadline ? new Date(t.promoDeadline).toISOString().slice(0, 16) : '',
    unitName: t.unitName || 'person',
    includes: (t.includes || []).join('\n'),
    highlighted: Boolean(t.highlighted),
  }
}

function toSlug(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'event'
}

function emptyTicketDraft(): TicketDraft {
  return { id: '', label: '', price: '0', originalPrice: '', promoDeadlineIso: '', unitName: 'person', includes: '', highlighted: false }
}

export function EventEditor({
  initial,
  saving,
  onSave,
  onCancel,
}: {
  initial: StudioEvent | null
  saving: boolean
  onSave: (ev: Omit<StudioEvent, 'id' | 'createdAt' | 'updatedAt'>) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [status, setStatus] = useState<string>(initial?.status ?? 'scheduled')
  const [banner, setBanner] = useState<string>(initial?.bannerImage ?? '')
  const [theme, setTheme] = useState(initial?.theme ?? '')
  const [datesLabel, setDatesLabel] = useState(initial?.datesLabel ?? '')
  const [durationLabel, setDurationLabel] = useState(initial?.durationLabel ?? '')
  const [timeLabel, setTimeLabel] = useState(initial?.timeLabel ?? '')
  const [venueNote, setVenueNote] = useState(initial?.venueNote ?? '')
  const [plus, setPlus] = useState(initial?.plus ?? '')
  const [bring, setBring] = useState(initial?.bring ?? '')
  const [whoFor, setWhoFor] = useState((initial?.whoFor ?? []).join('\n'))
  const [learn, setLearn] = useState((initial?.learn ?? []).join('\n'))
  const [attendanceDays, setAttendanceDays] = useState(initial?.attendanceDays ?? 3)
  const [attendanceLabels, setAttendanceLabels] = useState(
    (initial?.attendanceLabels ?? Array.from({ length: initial?.attendanceDays ?? 3 }, (_, i) => `Day ${i + 1}`)).join('\n'),
  )
  const [tickets, setTickets] = useState<TicketDraft[]>(
    initial?.tickets?.length ? initial.tickets.map(ticketToDraft) : [emptyTicketDraft()],
  )
  const [bannerInvalid, setBannerInvalid] = useState('')

  function setTicket(i: number, patch: Partial<TicketDraft>) {
    setTickets((ts) => ts.map((t, idx) => (idx === i ? { ...t, ...patch } : t)))
  }

  function handleBanner(file?: File) {
    if (!file) return
    if (file.size > 400000) {
      setBannerInvalid('Banner must be under 400KB.')
      return
    }
    setBannerInvalid('')
    const reader = new FileReader()
    reader.onload = () => setBanner(reader.result as string)
    reader.readAsDataURL(file)
  }

  function submit() {
    const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean)
    if (!title.trim()) {
      alert('Give the event a title.')
      return
    }
    const cleanedTickets = tickets
      .filter((t) => t.label.trim())
      .map((t) => ({
        id: t.id.trim() || toSlug(t.label),
        label: t.label.trim(),
        price: Math.max(0, Number(t.price) || 0),
        originalPrice: t.originalPrice ? Math.max(0, Number(t.originalPrice) || 0) : undefined,
        promoDeadline: t.promoDeadlineIso ? new Date(t.promoDeadlineIso).getTime() : undefined,
        unitName: t.unitName.trim() || 'person',
        includes: lines(t.includes),
        highlighted: t.highlighted,
      }))
    const days = Math.max(1, Math.min(10, Math.round(Number(attendanceDays) || 1)))
    let labels = lines(attendanceLabels || '').slice(0, days)
    while (labels.length < days) labels.push(`Day ${labels.length + 1}`)

    onSave({
      slug: initial?.slug && initial.status === 'live' ? initial.slug : toSlug(title),
      title: title.trim(),
      status: status as StudioEvent['status'],
      bannerImage: banner || undefined,
      theme: theme.trim() || undefined,
      datesLabel: datesLabel.trim() || undefined,
      durationLabel: durationLabel.trim() || undefined,
      timeLabel: timeLabel.trim() || undefined,
      venueNote: venueNote.trim() || undefined,
      plus: plus.trim() || undefined,
      bring: bring.trim() || undefined,
      whoFor: lines(whoFor),
      learn: lines(learn),
      attendanceDays: days,
      attendanceLabels: labels,
      tickets: cleanedTickets,
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={onCancel} className="btn btn-outline !py-2.5 flex items-center gap-1.5"><ArrowLeft size={15} /> Back</button>
        <h3 className="font-semibold text-lg ml-1">{initial ? 'Edit event content' : 'Create a new event'}</h3>
        <button onClick={submit} disabled={saving} className="btn btn-primary !py-2.5 ml-auto flex items-center gap-1.5">
          {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Save Event
        </button>
      </div>

      <div className="card p-6">
        <h4 className="font-semibold mb-4">The happening</h4>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="field-label">Event title *</label>
            <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. 5-Day Photoshoot Makeup Masterclass" />
          </div>
          <div>
            <label className="field-label">Status</label>
            <select className="input-field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="scheduled">Scheduled</option>
              <option value="live">Live (shows on site)</option>
              <option value="ended">Ended</option>
            </select>
          </div>
          <div>
            <label className="field-label">Theme / tagline</label>
            <input className="input-field" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. Making Makeup Available and Reachable" />
          </div>
          <div>
            <label className="field-label">Dates</label>
            <input className="input-field" value={datesLabel} onChange={(e) => setDatesLabel(e.target.value)} placeholder="e.g. 4th – 6th February 2027" />
          </div>
          <div>
            <label className="field-label">Duration</label>
            <input className="input-field" value={durationLabel} onChange={(e) => setDurationLabel(e.target.value)} placeholder="e.g. 3 Days" />
          </div>
          <div>
            <label className="field-label">Session times</label>
            <input className="input-field" value={timeLabel} onChange={(e) => setTimeLabel(e.target.value)} placeholder="e.g. 9:00 AM / 3:00 PM" />
          </div>
          <div>
            <label className="field-label">Venue note</label>
            <input className="input-field" value={venueNote} onChange={(e) => setVenueNote(e.target.value)} placeholder="e.g. Disclosed to students after purchase" />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">What makes it different (short paragraph)</label>
            <textarea className="input-field" rows={3} value={plus} onChange={(e) => setPlus(e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className="field-label">What to come with</label>
            <input className="input-field" value={bring} onChange={(e) => setBring(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Who it's for (one per line)</label>
            <textarea className="input-field" rows={3} value={whoFor} onChange={(e) => setWhoFor(e.target.value)} placeholder={'Makeup lovers\nBeginner makeup artists'} />
          </div>
          <div>
            <label className="field-label">What you'll learn (one per line)</label>
            <textarea className="input-field" rows={3} value={learn} onChange={(e) => setLearn(e.target.value)} placeholder={'How to do your own makeup\nBeginner techniques'} />
          </div>
          <div>
            <label className="field-label">Banner image</label>
            <div className="flex items-center gap-3">
              <label className="flex-1 cursor-pointer">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBanner(e.target.files?.[0])} />
                <div className="border-2 border-dashed rounded-xl px-3 py-4 text-xs text-center text-muted hover:border-rose/40 hover:text-rose-dark">
                  {banner ? 'Banner attached — tap to change' : 'Upload a banner image'}
                </div>
              </label>
              {banner && <img src={banner} alt="" className="w-20 h-12 object-cover rounded-lg border border-black/10" />}
            </div>
            {bannerInvalid && <p className="text-xs text-red-600 mt-1">{bannerInvalid}</p>}
          </div>
          <div>
            <label className="field-label">Attendance sessions (1–10)</label>
            <input type="number" min={1} max={10} className="input-field" value={attendanceDays} onChange={(e) => setAttendanceDays(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
            <label className="field-label mt-2">Session labels (one per line)</label>
            <textarea className="input-field" rows={3} value={attendanceLabels} onChange={(e) => setAttendanceLabels(e.target.value)} placeholder={'Day 1\nDay 2\nDay 3'} />
          </div>
        </div>
      </div>

      <div className="card p-6">
        <h4 className="font-semibold mb-2">Tickets</h4>
        <p className="text-sm text-muted mb-4">Payments run through Paystack exactly like before — you only control pricing and what's included.</p>
        <div className="space-y-4">
          {tickets.map((t, i) => (
            <div key={i} className="border border-black/10 rounded-xl p-4 bg-white/60">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="field-label">Ticket label *</label>
                  <input className="input-field" value={t.label} onChange={(e) => setTicket(i, { label: e.target.value })} placeholder="e.g. Student" />
                </div>
                <div>
                  <label className="field-label">ID *</label>
                  <input className="input-field" value={t.id} onChange={(e) => setTicket(i, { id: e.target.value })} placeholder="e.g. student" />
                </div>
                <div>
                  <label className="field-label">Price (₦)</label>
                  <input type="number" min={0} className="input-field" value={t.price} onChange={(e) => setTicket(i, { price: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Strike-through price (₦)</label>
                  <input type="number" min={0} className="input-field" value={t.originalPrice} onChange={(e) => setTicket(i, { originalPrice: e.target.value })} placeholder="Optional" />
                </div>
                <div>
                  <label className="field-label">Promo ends</label>
                  <input type="datetime-local" className="input-field" value={t.promoDeadlineIso} onChange={(e) => setTicket(i, { promoDeadlineIso: e.target.value })} />
                </div>
                <div>
                  <label className="field-label">Per</label>
                  <input className="input-field" value={t.unitName} onChange={(e) => setTicket(i, { unitName: e.target.value })} placeholder="person" />
                </div>
              </div>
              <div className="mt-3">
                <label className="field-label">What's included (one per line)</label>
                <textarea className="input-field" rows={2} value={t.includes} onChange={(e) => setTicket(i, { includes: e.target.value })} placeholder={'Full 3-day class\nBranded shirt / cap'} />
              </div>
              <label className="flex items-center gap-2 mt-2 text-sm text-ink/75 cursor-pointer select-none">
                <input type="checkbox" checked={t.highlighted} onChange={(e) => setTicket(i, { highlighted: e.target.checked })} className="accent-rose w-4 h-4" />
                Mark as popular / highlighted
              </label>
              <div className="mt-2">
                <button onClick={() => setTickets((ts) => ts.filter((_, idx) => idx !== i))} className="text-xs text-red-500 flex items-center gap-1 hover:underline">
                  <Trash2 size={12} /> Remove ticket
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setTickets((ts) => [...ts, emptyTicketDraft()])}
          className="mt-4 text-sm font-semibold text-rose-deep flex items-center gap-1.5 hover:underline"
        >
          <Plus size={15} /> Add another ticket
        </button>
      </div>

      <div className="flex gap-3">
        <button onClick={submit} disabled={saving} className="btn btn-primary flex items-center gap-2">
          {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} Save Event
        </button>
        <button onClick={onCancel} className="btn btn-outline">Cancel</button>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Per-event manage view (groups everything connected to one event)
// ------------------------------------------------------------------

const PACKAGE_LABELS: Record<string, string> = {
  supporter: 'Supporter', partner: 'Partner', featured: 'Featured', title: 'Title/Major',
  product: 'Product', service: 'Service', custom: 'Custom',
}

export function EventManage({
  event,
  unassigned,
  headers,
  saving,
  onBack,
  onEdit,
  onSetLive,
  onEnd,
}: {
  event: DiaryEvent
  unassigned: DiaryUnassigned | null
  headers: Record<string, string>
  saving: boolean
  onBack: () => void
  onEdit: () => void
  onSetLive: () => void
  onEnd: () => void
}) {
  const [regs, setRegs] = useState<RegistrationRow[]>([])
  const [sponsors, setSponsors] = useState<SponsorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [codes, setCodes] = useState<Record<string, { createdAt: string }>>({})
  const [generatedCode, setGeneratedCode] = useState<{ day: string; label: string; code: string } | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [genBusy, setGenBusy] = useState<string | null>(null)
  const [resendBusy, setResendBusy] = useState<string | null>(null)
  const [profile, setProfile] = useState<RegistrationRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<RegistrationRow | null>(null)
  const [delBusy, setDelBusy] = useState(false)
  const keys = dayKeys(event.attendanceDays)
  const labels: string[] = event.attendanceLabels || Array.from({ length: event.attendanceDays }, (_, i) => `Day ${i + 1}`)
  const s = event.summary

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [r, sp, c] = await Promise.all([
        getJson(`/api/admin/registrations?eventId=${encodeURIComponent(event.id)}`, headers),
        getJson(`/api/admin/sponsors?eventId=${encodeURIComponent(event.id)}`, headers),
        getJson(`/api/admin/events/${encodeURIComponent(event.id)}/attendance-codes`, headers),
      ])
      setRegs(r.registrations || [])
      setSponsors(sp.sponsors || [])
      const map: Record<string, { createdAt: string }> = {}
      ;(c.codes || []).forEach((cc: { day: string; createdAt: string }) => { map[cc.day] = { createdAt: cc.createdAt } })
      setCodes(map)
    } catch (err: any) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id])

  const sortedRegs = [...regs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  const presentCount = sortedRegs.filter(isPresent).length

  async function updateReg(id: string, body: Record<string, any>) {
    try {
      const data = await patchJson(`/api/admin/registrations/${id}`, body, headers)
      if (data.registration) setRegs((rs) => rs.map((r) => (r.id === id ? data.registration : r)))
    } catch (err: any) {
      setError(err.message)
    }
  }

  async function updateSponsor(id: string, body: Record<string, any>) {
    try {
      await patchJson(`/api/admin/sponsors/${id}`, body, headers)
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  function toggleDay(r: RegistrationRow, key: string) {
    const current = r.attendance || {}
    updateReg(r.id, { attendance: { ...current, [key]: !current[key] } })
  }

  async function generateDayCode(day: string, label: string) {
    setGenBusy(day)
    setError('')
    try {
      const data = await postJson(
        `/api/admin/events/${encodeURIComponent(event.id)}/attendance-code`,
        { day },
        headers,
      )
      setGeneratedCode({ day, label, code: data.code })
      setCodes((prev) => ({ ...prev, [day]: { createdAt: new Date().toISOString() } }))
      setNotice(data.message || 'Attendance code generated.')
    } catch (err: any) {
      setError(err.message || 'Failed to generate code')
    } finally {
      setGenBusy(null)
    }
  }

  async function resendTicket(id: string) {
    setResendBusy(id)
    setError('')
    setNotice('')
    try {
      const data = await postJson(`/api/admin/registrations/${id}/resend-ticket`, {}, headers)
      setNotice(data.message || (data.emailed ? 'Ticket emailed.' : 'Ticket could not be emailed.'))
    } catch (err: any) {
      setError(err.message || 'Failed to resend ticket')
    } finally {
      setResendBusy(null)
    }
  }

  async function deleteReg() {
    if (!confirmDelete) return
    setDelBusy(true)
    setError('')
    setNotice('')
    try {
      await delJson(`/api/admin/registrations/${confirmDelete.id}`, headers)
      setRegs((rs) => rs.filter((r) => r.id !== confirmDelete.id))
      setConfirmDelete(null)
      setNotice(`${confirmDelete.fullName}'s registration deleted.`)
    } catch (err: any) {
      setError(err.message || 'Failed to delete registration')
    } finally {
      setDelBusy(false)
    }
  }

  return (
    <div className="relative">
    <div className="space-y-6">
      {/* Manage header */}
      <div className="card p-6 silk-dark !text-cream relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-44 h-44 rounded-full bg-rose/20 blur-2xl" />
        <button onClick={onBack} className="btn btn-outline !border-white/20 !text-white hover:!bg-white/10 !py-2 flex items-center gap-1.5 relative z-10"><ArrowLeft size={15} /> All events</button>
        <div className="mt-4 flex flex-wrap items-center gap-3 relative z-10">
          <span className={`tag-chip ${event.status === 'live' ? '!bg-red-600 !bg-none !text-white' : '!bg-white/15 !bg-none !text-white'}`}>
            {event.status === 'live' ? '● LIVE ON SITE' : event.status === 'ended' ? 'Ended' : 'Scheduled'}
          </span>
          <span className="text-white/70 text-xs">{event.datesLabel}</span>
        </div>
        <h2 className="font-display text-2xl md:text-3xl font-bold mt-2 relative z-10">{event.title}</h2>
        <div className="flex flex-wrap items-center gap-3 mt-4 relative z-10">
          <button onClick={onEdit} className="btn btn-light !py-2 flex items-center gap-1.5"><Pencil size={14} /> Edit content</button>
          {event.status !== 'live' && (
            <button onClick={onSetLive} className="btn btn-primary !py-2 flex items-center gap-1.5"><Radio size={14} /> Make Live now</button>
          )}
          {event.status !== 'ended' && (
            <button
              onClick={() => setConfirmEnd(true)}
              className="btn !py-2 !bg-red-600 !text-white hover:!bg-red-700 flex items-center gap-1.5"
            >
              <CircleAlert size={14} /> End event
            </button>
          )}
          <a href={eventRegisterUrl(event)} target="_blank" rel="noreferrer" className="btn btn-outline !border-white/25 !text-white hover:!bg-white/10 !py-2 flex items-center gap-1.5">
            <ExternalLink size={14} /> View register page
          </a>
        </div>
      </div>

      {error && <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2"><CircleAlert size={18} className="shrink-0" />{error}</div>}
      {notice && <div className="p-4 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm flex items-start gap-2"><CircleCheck size={18} className="shrink-0" />{notice}</div>}

      {/* Overview stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Registered" value={s.registrations} />
        <StatCard icon={TicketIcon} label="Paid tickets" value={`${s.paid}`} />
        <StatCard icon={CalendarDays} label="Present" value={`${presentCount}`} />
        <StatCard icon={TrendingUp} label="Revenue" value={formatNgn(s.revenue)} />
      </div>

      {/* Attendance summary */}
      <div className="card p-6">
        <h4 className="font-semibold mb-3 flex items-center gap-2"><CalendarDays size={16} className="text-rose-dark" /> Attendance summary</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted text-xs border-b border-black/8">
                {labels.map((l, i) => <th key={l} className="px-3 py-2 text-center">{l}</th>)}
                <th className="px-3 py-2">Overall</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {keys.map((k) => (
                  <td key={k} className="px-3 py-3 text-center">
                    <span className="font-display text-2xl font-bold text-rose-deep">{s.attendanceByDay?.[k] ?? 0}</span>
                  </td>
                ))}
                <td className="px-3 py-3">
                  <span className="font-display text-2xl font-bold text-green-700">{presentCount}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-2">Tap the day toggles in the students table below to mark attendance live.</p>
      </div>

      {/* Daily attendance codes */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-2">
          <div>
            <h4 className="font-semibold flex items-center gap-2"><KeyRound size={16} className="text-rose-dark" /> Daily attendance codes</h4>
            <p className="text-sm text-muted mt-1 max-w-2xl">
              Generate one shared code per session. Attendees open their ticket QR and enter the code to be
              marked present for that day — the QR identifies each person, so everyone can use the same code.
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
          {keys.map((k, i) => {
            const label = labels[i] || `Day ${i + 1}`
            const set = Boolean(codes[k])
            return (
              <div key={k} className={`rounded-xl border p-4 ${set ? 'bg-green-50/50 border-green-200' : 'bg-black/[0.02] border-black/8'}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{label} <span className="text-xs text-muted font-normal">{set ? '· code ready' : '· no code yet'}</span></div>
                  {set && <CircleCheck size={16} className="text-green-600 shrink-0" />}
                </div>
                {set && <div className="text-[11px] text-muted mt-1">Set {new Date(codes[k].createdAt).toLocaleString()}</div>}
                <button
                  onClick={() => generateDayCode(k, label)}
                  disabled={genBusy === k}
                  className="mt-3 w-full text-xs font-semibold rounded-lg py-2 bg-rose-deep text-white hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {genBusy === k ? <LoaderCircle size={13} className="animate-spin" /> : <Plus size={13} />}
                  {set ? 'Regenerate code' : 'Generate code'}
                </button>
              </div>
            )
          })}
        </div>
        {generatedCode && (
          <div className="mt-4 rounded-2xl border border-pinkgold/30 bg-blush/50 p-5">
            <div className="text-xs uppercase tracking-widest text-muted mb-2">Code for {generatedCode.label}</div>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="font-display text-4xl font-bold tracking-[0.3em] text-rose-deep">{generatedCode.code}</div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedCode.code)
                  setNotice(`Code ${generatedCode.code} copied to clipboard.`)
                }}
                className="btn btn-outline !py-2 flex items-center gap-1.5"
              >
                <Copy size={14} /> Copy
              </button>
            </div>
            <p className="text-xs text-muted mt-2">
              Share this with attendees for {generatedCode.label}. They scan their ticket QR and enter it to check in.
            </p>
          </div>
        )}
      </div>

      {/* Students & attendance */}
      <div className="card overflow-hidden">
        <div className="p-6 flex items-center justify-between flex-wrap gap-3 border-b border-black/5">
          <div>
            <h4 className="font-semibold text-lg">Students &amp; registrations ({sortedRegs.length})</h4>
            <p className="text-sm text-muted">Forms submitted for this event — mark their attendance by session.</p>
          </div>
          <button onClick={load} className="btn btn-outline !py-2 flex items-center gap-1.5"><RefreshCw size={14} /> Refresh</button>
        </div>
        {loading ? (
          <div className="p-12 flex items-center justify-center text-muted"><LoaderCircle size={20} className="animate-spin" /> Loading…</div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted text-xs border-b border-black/8">
                <th className="px-5 py-2">Student</th>
                <th className="px-5 py-2">Contact</th>
                <th className="px-5 py-2">Ticket</th>
                <th className="px-5 py-2">Amount</th>
                <th className="px-5 py-2">Status</th>
                <th className="px-5 py-2">Attendance</th>
                <th className="px-5 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedRegs.map((r) => (
                <tr key={r.id} className="border-b border-black/5 align-top">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      {r.photoBase64 && <img src={r.photoBase64} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-rose/30" />}
                      <div>
                        <div className="font-medium">{r.fullName}</div>
                        {r.instagram && <div className="text-xs text-muted">@{r.instagram}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-xs">{r.email}</div>
                    <div className="text-xs text-muted">{r.phone}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div>{r.ticketLabel || r.ticketType} × {r.quantity}</div>
                    {r.reason && <div className="text-xs text-muted max-w-[160px] truncate" title={r.reason}>{r.reason}</div>}
                  </td>
                  <td className="px-5 py-3">{formatNgn(r.amount)}</td>
                  <td className="px-5 py-3"><span className={statusBadge(r.status)}>{r.status}</span></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      {labels.map((label, i) => {
                        const key = keys[i]
                        const on = r.attendance?.[key] === true
                        return (
                          <button
                            key={key}
                            onClick={() => toggleDay(r, key)}
                            title={`${label} — ${on ? 'marked' : 'not marked'}`}
                            className={`w-8 h-8 rounded-full text-xs font-bold transition-colors ${on ? 'bg-green-500 text-white shadow-sm' : 'bg-black/5 text-muted hover:bg-black/10'}`}
                          >
                            {i + 1}
                          </button>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => setProfile(r)} className="px-2.5 py-1 rounded-lg text-xs bg-ink/5 text-ink/80 hover:bg-ink/10 flex items-center justify-center gap-1"><Eye size={11} /> View profile</button>
                      {r.status === 'pending' && <button onClick={() => updateReg(r.id, { status: 'paid' })} className="px-2.5 py-1 rounded-lg text-xs bg-green-600 text-white hover:bg-green-700">Mark Paid</button>}
                      {r.status === 'paid' && <button onClick={() => updateReg(r.id, { status: 'approved' })} className="px-2.5 py-1 rounded-lg text-xs bg-rose-dark text-white hover:opacity-90">Approve</button>}
                      {r.status === 'paid' && (
                        <button
                          onClick={() => resendTicket(r.id)}
                          disabled={resendBusy === r.id}
                          className="px-2.5 py-1 rounded-lg text-xs bg-rose/20 text-rose-deep hover:bg-rose/30 disabled:opacity-60 flex items-center justify-center gap-1"
                        >
                          {resendBusy === r.id ? <LoaderCircle size={11} className="animate-spin" /> : <Send size={11} />} Email ticket
                        </button>
                      )}
                      <button
                        onClick={() => updateReg(r.id, { present: !isPresent(r) })}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${isPresent(r) ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-ink/5 text-muted hover:bg-ink/10'}`}
                      >
                        {isPresent(r) ? '✓ Present' : 'Mark present'}
                      </button>
                      <button onClick={() => setConfirmDelete(r)} className="px-2.5 py-1 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center gap-1"><Trash2 size={11} /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {sortedRegs.length === 0 && <tr><td colSpan={7} className="px-5 py-12 text-center text-muted">No registrations for this event yet.</td></tr>}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* Sponsors */}
      <div className="card overflow-hidden">
        <div className="p-6 border-b border-black/5">
          <h4 className="font-semibold text-lg">Sponsors for this event ({sponsors.length})</h4>
          <p className="text-sm text-muted">Sponsorship applications received while this event was (or is) live.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted text-xs border-b border-black/8">
                <th className="px-5 py-2">Brand</th>
                <th className="px-5 py-2">Contact</th>
                <th className="px-5 py-2">Package</th>
                <th className="px-5 py-2">Amount</th>
                <th className="px-5 py-2">Status</th>
                <th className="px-5 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sponsors.map((sp) => (
                <tr key={sp.id} className="border-b border-black/5 align-top">
                  <td className="px-5 py-3">
                    <div className="font-medium flex items-center gap-1.5">{sp.brandName} {sp.featured && <Crown size={12} className="text-gold" />}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-xs">{sp.contactName}</div>
                    <div className="text-xs text-muted">{sp.email}</div>
                    {sp.notes && <div className="text-xs text-muted max-w-[180px] truncate" title={sp.notes}>{sp.notes}</div>}
                  </td>
                  <td className="px-5 py-3">{PACKAGE_LABELS[sp.packageType] || sp.packageType}</td>
                  <td className="px-5 py-3">{sp.amount > 0 ? formatNgn(sp.amount) : 'In-kind'}</td>
                  <td className="px-5 py-3"><span className={statusBadge(sp.status)}>{sp.status}</span></td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {sp.status === 'pending' && <button onClick={() => updateSponsor(sp.id, { status: 'confirmed' })} className="px-2.5 py-1 rounded-lg text-xs bg-green-600 text-white hover:bg-green-700">Confirm</button>}
                      <button onClick={() => updateSponsor(sp.id, { featured: !sp.featured })} className="px-2.5 py-1 rounded-lg text-xs bg-gold text-ink hover:opacity-90">{sp.featured ? 'Unfeature' : 'Feature'}</button>
                      {sp.status !== 'cancelled' && <button onClick={() => updateSponsor(sp.id, { status: 'cancelled' })} className="px-2.5 py-1 rounded-lg text-xs bg-black/10 hover:bg-black/20">Cancel</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {sponsors.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-muted">No sponsors linked to this event.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unassigned records (submitted before events carried their own id) */}
      {unassigned && unassigned.registrations + unassigned.sponsors > 0 && (
        <div className="card p-6 border border-amber-200 bg-amber-50/50">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <CircleAlert size={16} className="text-amber-600" /> Unassigned registrations &amp; sponsors
          </h4>
          <p className="text-sm text-ink/70 mb-3">
            {unassigned.registrations} registrations and {unassigned.sponsors} sponsors were submitted before events
            carried their own banner, so they aren't tied to a specific event.
          </p>
          {unassigned.latestRegistrations.slice(0, 10).map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm border-b border-amber-200/70 py-1.5 last:border-0">
              <span className="font-medium">{r.fullName}</span>
              <span><span className={statusBadge(r.status)}>{r.status}</span> · {new Date(r.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      <EndEventModal
        open={confirmEnd}
        event={event}
        onCancel={() => setConfirmEnd(false)}
        onConfirm={() => {
          setConfirmEnd(false)
          onEnd()
        }}
      />

      {profile && (
        <Modal open onClose={() => setProfile(null)}>
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-lg pr-6">Student profile</h3>
            <button onClick={() => setProfile(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-black/5 shrink-0"><X size={16} /></button>
          </div>
          <p className="text-sm text-muted mt-1">{event.title}</p>

          <div className="mt-5 flex items-center gap-4">
            {profile.photoBase64 && <img src={profile.photoBase64} alt="" className="w-16 h-16 rounded-2xl object-cover ring-1 ring-rose/30" />}
            <div>
              <div className="font-display text-xl font-bold">{profile.fullName}</div>
              {profile.instagram && <div className="text-sm text-muted">@{profile.instagram}</div>}
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className={statusBadge(profile.status)}>{profile.status}</span>
                <span className="text-xs text-muted">Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid sm:grid-cols-2 gap-3 text-sm">
            <ProfileField label="Email" value={profile.email} />
            <ProfileField label="Phone" value={profile.phone} />
            <ProfileField label="Date of birth" value={profile.dateOfBirth} />
            <ProfileField label="State" value={profile.state} />
            <ProfileField label="Nationality" value={profile.nationality} />
            <ProfileField label="Experience level" value={profile.experienceLevel} />
            <ProfileField label="Address" value={profile.address} />
            <ProfileField label="Ticket" value={`${profile.ticketLabel || profile.ticketType} × ${profile.quantity}`} />
            <ProfileField label="Amount" value={formatNgn(profile.amount)} />
            <ProfileField label="Present" value={isPresent(profile) ? 'Yes' : 'No'} />
            <ProfileField label="Attendance" value={profile.attendance && Object.values(profile.attendance).some(Boolean) ? `Marked ${Object.values(profile.attendance).filter(Boolean).length}/${keys.length} day${keys.length === 1 ? '' : 's'}` : 'None yet'} />
          </div>

          <div className="mt-5 pt-4 border-t border-black/5 grid sm:grid-cols-2 gap-3 text-sm">
            {profile.emergencyContactName && <ProfileField label="Emergency contact" value={profile.emergencyContactName} />}
            {profile.emergencyContact && <ProfileField label="Emergency phone" value={profile.emergencyContact} />}
            {profile.reason && <ProfileField label="Reason" value={profile.reason} />}
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <Modal open onClose={() => !delBusy && setConfirmDelete(null)}>
          <div className="text-center py-2">
            <div className="inline-flex w-14 h-14 rounded-2xl bg-red-50 border border-red-100 items-center justify-center mb-5">
              <CircleAlert size={28} className="text-red-600" />
            </div>
            <h3 className="font-display text-xl md:text-2xl font-bold leading-tight">Delete this registration?</h3>
            <p className="text-sm text-muted mt-2 max-w-sm mx-auto">
              <strong className="text-ink">{confirmDelete.fullName}</strong>'s form, payment record and attendance
              ({confirmDelete.ticketLabel || confirmDelete.ticketType} × {confirmDelete.quantity}) will be permanently
              removed. Their ticket download link will stop working.
            </p>
            <div className="flex items-center justify-center gap-3 mt-6">
              <button onClick={() => setConfirmDelete(null)} disabled={delBusy} className="btn btn-outline">Cancel</button>
              <button onClick={deleteReg} disabled={delBusy} className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-2">
                {delBusy ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete registration
              </button>
            </div>
          </div>
        </Modal>
      )}

      {saving && (
        <div className="absolute inset-0 z-10 bg-white/75 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-2.5">
          <LoaderCircle size={22} className="animate-spin text-rose-deep" />
          <span className="text-sm font-medium text-ink/80">Updating event…</span>
        </div>
      )}
    </div>
    </div>
  )
}

// ------------------------------------------------------------------
// Small helpers
// ------------------------------------------------------------------

function IconBtn({ children, title, onClick, danger, dark }: {
  children: React.ReactNode
  title: string
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void
  danger?: boolean
  dark?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${danger ? (dark ? 'text-white hover:bg-white/20' : 'text-red-500 hover:bg-red-50') : dark ? 'text-white/75 hover:bg-white/20' : 'text-muted hover:bg-black/5'}`}
    >
      {children}
    </button>
  )
}

function StatGrid({ items, live = false }: { items: { icon: typeof Users; label: string; value: React.ReactNode }[]; live?: boolean }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
      {items.map((it) => (
        <div key={it.label} className={`rounded-xl px-3 py-2.5 border ${live ? 'bg-white/5 border-white/15' : 'bg-black/[0.03] border-black/5'}`}>
          <div className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${live ? 'text-white/70' : 'text-muted'}`}>
            <it.icon size={12} /> {it.label}
          </div>
          <div className={`font-display text-lg font-bold ${live ? 'text-white' : 'text-ink'}`}>{it.value}</div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="w-10 h-10 rounded-xl bg-blush flex items-center justify-center mb-3"><Icon className="text-rose-deep" size={20} /></div>
      <div className="font-display text-2xl font-bold leading-tight break-words">{value}</div>
      <div className="text-sm text-muted mt-0.5">{label}</div>
    </div>
  )
}

function ProfileField({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="font-medium break-words">{value || '—'}</div>
    </div>
  )
}

function MailIcon() {
  return <span className="inline-block w-3 h-3 border border-current rounded-sm align-middle" />
}