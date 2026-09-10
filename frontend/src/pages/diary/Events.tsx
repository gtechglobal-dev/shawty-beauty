import { useEffect, useRef, useState } from 'react'
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
  TrendingUp,
  RefreshCw,
  KeyRound,
  Send,
  Mail,
  Download,
  Filter,
  X,
  ChevronDown,
} from 'lucide-react'
import { formatNgn, eventRegisterUrl, type StudioEvent, type Ticket } from '../../lib/constants'
import { getJson, patchJson, postJson, delJson } from '../../lib/api'
import Modal from '../../components/Modal'
import EmailComposer from '../../components/EmailComposer'
import { useToast } from '../../components/Toasts'

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
  photoUrl?: string
  ticketType: string
  ticketLabel?: string
  quantity: number
  amount: number
  status: string
  reason?: string
  attendance?: Record<string, boolean>
  present?: boolean
  ticketToken?: string
  createdAt: string
  dateOfBirth?: string
  state?: string
  nationality?: string
  address?: string
  experienceLevel?: string
  emergencyContactName?: string
  emergencyContact?: string
}

// Local log of every number already exported as a phone contact, so the next
// "Save contacts" run can flag duplicates and ask before overwriting. Browsers
// can't read the device address book, so "already exists" = already saved here.
const SAVED_CONTACTS_KEY = 'sbs_saved_contacts'

interface SavedContact {
  phone: string
  name: string
  ts: number
}

function savedContacts(): SavedContact[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVED_CONTACTS_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function recordSavedContact(phone: string, name: string) {
  const p = (phone || '').replace(/\D/g, '')
  if (!p) return
  const rest = savedContacts().filter((s) => s.phone !== p)
  rest.push({ phone: p, name, ts: Date.now() })
  localStorage.setItem(SAVED_CONTACTS_KEY, JSON.stringify(rest))
}

export interface SponsorRow {
  id: string
  reference?: string
  brandName: string
  contactName: string
  email: string
  phone: string
  website?: string
  socials?: { platform: string; handle: string }[]
  packageType: string
  amount: number
  notes: string
  status: string
  featured: boolean
  sponsorType?: string
  supportAreas?: string[]
  sponsorshipType?: string
  usagePreference?: string
  publicRecognition?: boolean
  displayName?: string
  logoUrl?: string
  logoBase64?: string
  country?: string
  state?: string
  address?: string
  deactivated?: boolean
  createdAt?: string
}

export function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    paid: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  }
  return `inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-black/5 text-ink/60'}`
}

export function dayKeys(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `d${i + 1}`)
}

function photoSrc(r: { photoUrl?: string; photoBase64?: string }): string | undefined {
  return r.photoUrl || r.photoBase64 || undefined
}

// Format a date of birth as "13 Aug 2026 | 26years". Falls back to the raw
// value when it isn't a valid date.
function formatDobWithAge(dob?: string): string {
  if (!dob) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim())
  const birth = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(dob)
  if (isNaN(birth.getTime())) return dob
  const formatted = birth
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\s+/g, ' ')
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age -= 1
  if (age < 0) return formatted
  return `${formatted} | ${age}years`
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
          Each event groups its own registrations and attendance. Tap Manage event to dig into the details
          and press <strong className="text-rose-deep"> Create New Event </strong> to start a happening. Making an
          event live switches the homepage banner, program page and registration forms to it automatically.
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
              const s = ev.summary
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
                        { icon: TrendingUp, label: 'Revenue', value: formatNgn(s.revenue) },
                      ]}
                    />

                    <div className="mt-4 flex items-center gap-2 flex-wrap">
                      {ev.status !== 'live' && (
                        <button
                          onClick={() => onSetLive(ev.id)}
                          className="inline-flex items-center gap-1.5 text-sm font-semibold bg-gradient-to-r from-rose-dark to-rose text-white px-4 py-2 rounded-full hover:opacity-90 shadow-[0_8px_20px_-8px_rgba(179,99,128,0.6)]"
                        >
                          <Radio size={14} /> Make Live
                        </button>
                      )}
                      <button onClick={() => onManage(ev.id)} className="btn btn-outline !py-2">Manage event</button>
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
            You can bring it back anytime with <strong className="text-ink">Make Live</strong> — its registrations
            and attendance stay saved.
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

function ViewTicketModal({
  reg,
  event,
  headers,
  onClose,
}: {
  reg: RegistrationRow
  event: DiaryEvent
  headers: Record<string, string>
  onClose: () => void
}) {
  const [resending, setResending] = useState(false)
  const toast = useToast()
  const pngUrl = `/api/tickets/${reg.ticketToken}.png`

  return (
    <Modal open wide onClose={onClose}>
      <h3 className="font-semibold text-lg pr-8">Ticket — {reg.fullName}</h3>
      <p className="text-sm text-muted mt-1">
        {reg.ticketLabel || reg.ticketType} × {reg.quantity} · {formatNgn(reg.amount)} · {event.title}
      </p>

      <div className="mt-4 rounded-2xl overflow-hidden border border-black/10 bg-white">
        <img src={pngUrl} alt={`${reg.fullName} ticket`} className="w-full" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-5">
        <a href={pngUrl} download className="btn btn-primary !py-2 flex items-center gap-1.5">
          <Download size={14} /> Download ticket
        </a>
        <button
          onClick={async () => {
            if (!reg.ticketToken) return
            setResending(true)
            try {
              const data = await postJson(`/api/admin/registrations/${reg.id}/resend-ticket`, {}, headers)
              const text = data.message || (data.emailed ? 'Ticket emailed.' : 'Ticket could not be emailed.')
              toast.push(text, data.emailed ? 'ok' : 'err')
            } catch (err: any) {
              toast.push(err.message || 'Failed to resend ticket.', 'err')
            } finally {
              setResending(false)
            }
          }}
          disabled={resending}
          className="btn btn-outline !py-2 flex items-center gap-1.5 disabled:opacity-60"
        >
          {resending ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />} Resend by email
        </button>
      </div>
    </Modal>
  )
}

function EmailApplicantsModal({
  regs,
  event,
  headers,
  onClose,
}: {
  regs: RegistrationRow[]
  event: DiaryEvent
  headers: Record<string, string>
  onClose: () => void
}) {
  const paid = regs.filter((r) => r.status !== 'cancelled')

  return (
    <EmailComposer
      title="Email to applicants"
      subtitle={<p className="text-sm text-muted mt-1">{event.title}</p>}
      headers={headers}
      recipients={paid.map((r) => ({
        id: r.id,
        email: r.email,
        label: r.fullName,
        sublabel: `${r.ticketLabel || r.ticketType} × ${r.quantity}`,
      }))}
      initialSubject={`Excited to have you — ${event.title}`}
      initialMessage={
        `Hi there,\n\n` +
        `We're really looking forward to seeing you at ${event.title}!` +
        `${event.datesLabel ? ` It runs ${event.datesLabel}.` : ''}` +
        `${event.venueNote ? `\n\n${event.venueNote}` : ''}` +
        `\n\nSee you soon!\n— Shawty Beauty Studio`
      }
      onClose={onClose}
      onSend={async ({ subject, blocks, emails, names }) => {
        const data = await postJson(
          `/api/admin/broadcast`,
          {
            eventId: event.id,
            subject: subject || `Update — ${event.title}`,
            blocks,
            emails,
            names,
          },
          headers,
        )
        return data
      }}
    />
  )
}

function SaveContactsModal({
  regs,
  event,
  onClose,
}: {
  regs: RegistrationRow[]
  event: DiaryEvent
  onClose: () => void
}) {
  const paid = regs.filter((r) => r.status !== 'cancelled')
  const options = (event.tickets || []).map((t) => t.label || t.id)
  const [filter, setFilter] = useState('')
  const visible = paid.filter((r) => !filter || (r.ticketLabel || r.ticketType) === filter)
  const [selected, setSelected] = useState<string[]>(() => visible.map((r) => r.id))
  const [dupPrompt, setDupPrompt] = useState<{ targets: RegistrationRow[]; dupPhones: Set<string> } | null>(null)

  useEffect(() => {
    setSelected(visible.map((r) => r.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  function ticketPrefix(r: RegistrationRow): string {
    const id = (r.ticketType || '').toLowerCase()
    const label = (r.ticketLabel || '').toLowerCase()
    if (id === 'gold' || label.includes('gold')) return '3BMCGOLD-'
    if (id === 'student' || label.includes('student')) return '3BMCSTU-'
    return ''
  }

  // The full branded name first (3BMCGOLD- / 3BMCSTU-) followed by the person's
  // whole name, kept as a single field so phones display it exactly that way.
  function displayName(r: RegistrationRow): string {
    const prefix = ticketPrefix(r)
    const raw = (r.fullName || 'Applicant').trim()
    return `${prefix}${raw}`
  }

  // Escape vCard text values so commas, semicolons, backslashes or newlines in a
  // name/note can never corrupt the file for iOS or Android parsers.
  function vcardFor(r: RegistrationRow): string {
    const name = displayName(r)
    const esc = (s: string) =>
      s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
    return [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `N:;${esc(name)};;;`,
      `FN:${esc(name)}`,
      r.phone ? `TEL;TYPE=CELL:${r.phone}` : '',
      r.email ? `EMAIL:${esc(r.email)}` : '',
      r.instagram ? `NOTE:Instagram @${esc(r.instagram)}` : '',
      'END:VCARD',
    ]
      .filter(Boolean)
      .join('\r\n')
  }

  function downloadVcf(r: RegistrationRow) {
    const prefix = ticketPrefix(r)
    const blob = new Blob([vcardFor(r)], { type: 'text/vcard' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${prefix}${(r.fullName || 'applicant').replace(/\s+/g, '_')}.vcf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const normPhone = (p: string) => (p || '').replace(/\D/g, '')

  // Numbers that were already exported, or that repeat within this selection.
  function dupCheck(rows: RegistrationRow[]): Set<string> {
    const saved = savedContacts()
    const seen = new Set<string>()
    const dups = new Set<string>()
    for (const row of rows) {
      const p = normPhone(row.phone)
      if (!p) continue
      if (saved.some((s) => s.phone === p) || seen.has(p)) dups.add(p)
      seen.add(p)
    }
    return dups
  }

  function saveRows(rows: RegistrationRow[]) {
    rows.forEach((r) => downloadVcf(r))
    rows.forEach((r) => recordSavedContact(r.phone, displayName(r)))
  }

  function handleBatch() {
    const targets = visible.filter((r) => selected.includes(r.id))
    if (targets.length === 0) return
    const dups = dupCheck(targets)
    if (dups.size > 0) {
      setDupPrompt({ targets, dupPhones: dups })
    } else {
      saveRows(targets)
    }
  }

  function handleRowSave(r: RegistrationRow) {
    const dups = dupCheck([r])
    if (dups.size > 0) {
      setDupPrompt({ targets: [r], dupPhones: dups })
    } else {
      saveRows([r])
    }
  }

  function chooseDup(action: 'overwrite' | 'newonly') {
    if (!dupPrompt) return
    const { targets, dupPhones } = dupPrompt
    const toSave =
      action === 'overwrite'
        ? targets
        : targets.filter((r) => !dupPhones.has(normPhone(r.phone)))
    saveRows(toSave)
    setDupPrompt(null)
  }

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  return (
    <Modal open onClose={onClose}>
      <h3 className="font-semibold text-lg pr-8">Save contacts to phone</h3>
      <p className="text-sm text-muted mt-1">Filter by ticket type, tick who you want, then save each as a phone contact (.vcf). Names start with 3BMCGOLD- or 3BMCSTU-; numbers you've already saved are flagged so you can overwrite or keep the originals.</p>

      <div className="mt-5">
        <label className="field-label">Ticket type</label>
        <select className="input-field" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All ticket types</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Selected ({selected.filter((id) => visible.some((v) => v.id === id)).length} of {visible.length})</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSelected(visible.map((r) => r.id))} className="text-xs font-semibold text-rose-deep hover:underline">All</button>
          <button onClick={() => setSelected([])} className="text-xs font-semibold text-rose-deep hover:underline">None</button>
        </div>
      </div>
      <div className="border border-black/10 rounded-xl divide-y divide-black/5 max-h-60 overflow-y-auto">
        {visible.length === 0 && <div className="p-4 text-sm text-muted">{paid.length === 0 ? 'No applicants for this event yet.' : 'No applicants match this ticket type.'}</div>}
        {visible.map((r) => (
          <div key={r.id} className="flex items-center gap-3 px-3 py-2.5">
            <input
              type="checkbox"
              className="accent-rose w-4 h-4 shrink-0"
              checked={selected.includes(r.id)}
              onChange={() => toggle(r.id)}
            />
            <span className="text-sm font-medium flex-1 truncate">{displayName(r)}</span>
            <button onClick={() => handleRowSave(r)} className="px-2.5 py-1 rounded-lg text-xs bg-blush text-rose-deep hover:opacity-80 flex items-center gap-1 shrink-0">
              <Download size={11} /> Save
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={onClose} className="btn btn-outline !py-2.5">Close</button>
        <button
          onClick={handleBatch}
          disabled={selected.length === 0}
          className="btn btn-primary !py-2.5 flex items-center justify-center gap-1.5 disabled:opacity-60 whitespace-nowrap"
        >
          <Download size={15} /> Save selected ({selected.filter((id) => visible.some((v) => v.id === id)).length})
        </button>
      </div>

      {dupPrompt && (
        <Modal open onClose={() => setDupPrompt(null)}>
          <h3 className="font-semibold text-lg pr-8">Some numbers were already saved</h3>
          <p className="text-sm text-muted mt-1">
            {dupPrompt.dupPhones.size} of {dupPrompt.targets.length} selected number{dupPrompt.dupPhones.size === 1 ? '' : 's'}{' '}
            {dupPrompt.dupPhones.size === 1 ? 'was already exported as a contact.' : 'were already exported as contacts.'} Overwrite them, or save only the new ones?
          </p>
          <div className="mt-4 max-h-44 overflow-y-auto border border-black/10 rounded-xl divide-y divide-black/5">
            {dupPrompt.targets
              .filter((r) => dupPrompt.dupPhones.has(normPhone(r.phone)))
              .map((r) => (
                <div key={r.id} className="px-3 py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{displayName(r)}</div>
                    <div className="text-xs text-muted">{r.phone}</div>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wide text-rose-deep bg-blush px-2 py-1 rounded-full shrink-0">already saved</span>
                </div>
              ))}
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button onClick={() => setDupPrompt(null)} className="btn btn-outline !py-2.5">Cancel</button>
            <button onClick={() => chooseDup('newonly')} className="btn btn-light !py-2.5">Save new only</button>
            <button onClick={() => chooseDup('overwrite')} className="btn btn-primary !py-2.5">Overwrite</button>
          </div>
        </Modal>
      )}
    </Modal>
  )
}

function FilterRegModal({
  event,
  onApply,
  onClose,
}: {
  event: DiaryEvent
  onApply: (f: { ticketType?: string; date?: string }) => void
  onClose: () => void
}) {
  const options = (event.tickets || []).map((t) => t.label || t.id)
  const [ticketType, setTicketType] = useState('')
  const [date, setDate] = useState('')

  return (
    <Modal open onClose={onClose}>
      <h3 className="font-semibold text-lg pr-8">Filter registrations</h3>
      <p className="text-sm text-muted mt-1">Show only registrations for a certain ticket type or submitted on a certain day.</p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="field-label">Ticket type</label>
          <select className="input-field" value={ticketType} onChange={(e) => setTicketType(e.target.value)}>
            <option value="">All ticket types</option>
            {options.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Registered on</label>
          <input type="date" className="input-field" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <button
          onClick={() => {
            setTicketType('')
            setDate('')
            onApply({})
            onClose()
          }}
          className="btn btn-outline !py-2.5"
        >
          Clear
        </button>
        <button
          onClick={() => {
            onApply({ ticketType: ticketType || undefined, date: date || undefined })
            onClose()
          }}
          className="btn btn-primary !py-2.5 flex items-center justify-center gap-1.5"
        >
          <Filter size={15} /> Apply
        </button>
      </div>
    </Modal>
  )
}

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

export const PACKAGE_LABELS: Record<string, string> = {
  supporter: 'Supporter', partner: 'Partner', featured: 'Featured', title: 'Title/Major',
  product: 'Product', service: 'Service', custom: 'Custom',
}

export function EventManage({
  event,
  headers,
  saving,
  reloadKey,
  onBack,
  onEdit,
  onSetLive,
  onEnd,
}: {
  event: DiaryEvent
  headers: Record<string, string>
  saving: boolean
  reloadKey?: number
  onBack: () => void
  onEdit: () => void
  onSetLive: () => void
  onEnd: () => void
}) {
  const [regs, setRegs] = useState<RegistrationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [codes, setCodes] = useState<Record<string, { createdAt: string; code?: string }>>({})
  const [generatedCode, setGeneratedCode] = useState<{ day: string; label: string; code: string } | null>(null)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [genBusy, setGenBusy] = useState<string | null>(null)
  const [profile, setProfile] = useState<RegistrationRow | null>(null)
  const [photoZoom, setPhotoZoom] = useState(false)
  const [ticketReg, setTicketReg] = useState<RegistrationRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<RegistrationRow | null>(null)
  const [delBusy, setDelBusy] = useState(false)
  const [unmarking, setUnmarking] = useState<string | null>(null)
  const [emailOpen, setEmailOpen] = useState(false)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [filters, setFilters] = useState<{ ticketType?: string; date?: string }>({})
  const [showAllRegs, setShowAllRegs] = useState(false)
  const keys = dayKeys(event.attendanceDays)
  const labels: string[] = event.attendanceLabels || Array.from({ length: event.attendanceDays }, (_, i) => `Day ${i + 1}`)
  const s = event.summary
  const toast = useToast()

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const [r, c] = await Promise.all([
        getJson(`/api/admin/registrations?eventId=${encodeURIComponent(event.id)}`, headers),
        getJson(`/api/admin/events/${encodeURIComponent(event.id)}/attendance-codes`, headers),
      ])
      setRegs(r.registrations || [])
      const map: Record<string, { createdAt: string; code?: string }> = {}
      ;(c.codes || []).forEach((cc: { day: string; createdAt: string; code?: string }) => { map[cc.day] = { createdAt: cc.createdAt, code: cc.code } })
      setCodes(map)
    } catch (err: any) {
      toast.push(err.message || 'Failed to load', 'err')
    } finally {
      setLoading(false)
    }
  }

  const prevReloadKey = useRef(reloadKey ?? 0)

  useEffect(() => {
    const keyChanged = reloadKey !== undefined && reloadKey !== prevReloadKey.current
    prevReloadKey.current = reloadKey ?? 0
    load(reloadKey !== undefined && keyChanged)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, reloadKey])

  const sortedRegs = [...regs].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())

  const filteredRegs = sortedRegs.filter((r) => {
    if (filters.ticketType && (r.ticketLabel || r.ticketType) !== filters.ticketType) return false
    if (filters.date) {
      const day = new Date(r.createdAt).toISOString().slice(0, 10)
      if (day !== filters.date) return false
    }
    return true
  })
  const hasFilters = Boolean(filters.ticketType || filters.date)
  useEffect(() => setShowAllRegs(false), [filters.ticketType, filters.date])

  async function generateDayCode(day: string, label: string) {
    setGenBusy(day)
    try {
      const data = await postJson(
        `/api/admin/events/${encodeURIComponent(event.id)}/attendance-code`,
        { day },
        headers,
      )
      setGeneratedCode({ day, label, code: data.code })
      setCodes((prev) => ({ ...prev, [day]: { createdAt: new Date().toISOString(), code: data.code } }))
      toast.push(data.message || 'Attendance code generated.')
    } catch (err: any) {
      toast.push(err.message || 'Failed to generate code', 'err')
    } finally {
      setGenBusy(null)
    }
  }

  async function revokeDayCode(day: string, label: string) {
    setGenBusy(day)
    try {
      const data = await delJson(
        `/api/admin/events/${encodeURIComponent(event.id)}/attendance-code?day=${encodeURIComponent(day)}`,
        headers,
      )
      setCodes((prev) => {
        const next = { ...prev }
        delete next[day]
        return next
      })
      setGeneratedCode((g) => (g?.day === day ? null : g))
      toast.push(data.message || `Code for ${label} revoked.`)
    } catch (err: any) {
      toast.push(err.message || 'Failed to revoke code', 'err')
    } finally {
      setGenBusy(null)
    }
  }

  async function unmarkAttendance(r: RegistrationRow, day: string, label: string) {
    const key = `${r.id}:${day}`
    setUnmarking(key)
    try {
      const data = await delJson(
        `/api/admin/registrations/${encodeURIComponent(r.id)}/attendance?day=${encodeURIComponent(day)}`,
        headers,
      )
      setRegs((rs) =>
        rs.map((x) => (x.id === r.id ? { ...x, attendance: data.registration?.attendance || x.attendance } : x)),
      )
      toast.push(`${r.fullName}'s ${label} attendance cleared.`)
    } catch (err: any) {
      toast.push(err.message || 'Failed to clear attendance', 'err')
    } finally {
      setUnmarking(null)
    }
  }

  async function deleteReg() {
    if (!confirmDelete) return
    setDelBusy(true)
    try {
      await delJson(`/api/admin/registrations/${confirmDelete.id}`, headers)
      setRegs((rs) => rs.filter((r) => r.id !== confirmDelete.id))
      setConfirmDelete(null)
      toast.push(`${confirmDelete.fullName}'s registration deleted.`)
    } catch (err: any) {
      toast.push(err.message || 'Failed to delete registration', 'err')
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
          <button onClick={() => setEmailOpen(true)} className="btn btn-light !py-2 flex items-center gap-1.5"><Mail size={14} /> Email to Applicants</button>
          <button onClick={() => setContactsOpen(true)} className="btn btn-light !py-2 flex items-center gap-1.5"><Download size={14} /> Save contacts to phone</button>
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

      {/* Overview stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users} label="Registered" value={s.registrations} />
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
              </tr>
            </thead>
            <tbody>
              <tr>
                {keys.map((k) => (
                  <td key={k} className="px-3 py-3 text-center">
                    <span className="font-display text-2xl font-bold text-rose-deep">
                      {s.attendanceByDay?.[k] ?? 0} / {s.registrations}
                    </span>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-2">
          Shown as checked-in / registered per session (e.g. 1/3 = one student present out of three
          registered). Students check in by scanning their ticket QR and entering the shared code for that session.
        </p>
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
                {set && (
                  <>
                    <div className="mt-2 rounded-lg bg-white border border-green-100 px-3 py-2 flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-lg tracking-[0.2em] text-rose-deep select-all">
                        {codes[k].code || '••••••'}
                      </span>
                      <button
                        onClick={async () => {
                          if (!codes[k].code) return
                          await navigator.clipboard.writeText(codes[k].code)
                          toast.push(`Code ${codes[k].code} copied to clipboard.`)
                        }}
                        title="Copy code"
                        disabled={!codes[k].code}
                        className="w-7 h-7 rounded-md bg-black/5 hover:bg-black/10 flex items-center justify-center text-ink/70 transition-colors disabled:opacity-40"
                      >
                        <Copy size={13} />
                      </button>
                    </div>
                    <div className="text-[11px] text-muted mt-1.5">
                      {codes[k].code ? `Active code · set ${new Date(codes[k].createdAt).toLocaleString()}` : 'Existing code predates this update and isn’t viewable'}
                    </div>
                  </>
                )}
                <button
                  onClick={() => (set ? revokeDayCode(k, label) : generateDayCode(k, label))}
                  disabled={genBusy === k}
                  className={`mt-3 w-full text-xs font-semibold rounded-lg py-2 flex items-center justify-center gap-1.5 disabled:opacity-60 ${
                    set ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-rose-deep text-white hover:opacity-90'
                  }`}
                >
                  {genBusy === k ? <LoaderCircle size={13} className="animate-spin" /> : set ? <Trash2 size={13} /> : <Plus size={13} />}
                  {set ? 'Revoke code' : 'Generate code'}
                </button>
                {set && !codes[k].code && (
                  <p className="text-[10px] text-amber-600 mt-1.5">Revoke it and a fresh code will be available again.</p>
                )}
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
                onClick={async () => {
                  await navigator.clipboard.writeText(generatedCode.code)
                  toast.push(`Code ${generatedCode.code} copied to clipboard.`)
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
            <h4 className="font-semibold text-lg">Students &amp; registrations ({filteredRegs.length}{hasFilters ? ` of ${sortedRegs.length}` : ''})</h4>
            <p className="text-sm text-muted">Forms submitted for this event — view profiles, tickets and attendance. Tap a green day bubble on a student’s row to unmark their check-in (admin correction only).</p>
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <button onClick={() => setFilters({})} className="btn btn-outline !py-2 flex items-center gap-1.5"><X size={14} /> Clear filters</button>
            )}
            <button onClick={() => setFilterOpen(true)} className="btn btn-outline !py-2 flex items-center gap-1.5"><Filter size={14} /> Filter</button>
            <button onClick={() => load()} className="btn btn-outline !py-2 flex items-center gap-1.5"><RefreshCw size={14} /> Refresh</button>
          </div>
        </div>
        {loading ? (
          <div className="p-12 flex items-center justify-center text-muted"><LoaderCircle size={20} className="animate-spin" /> Loading…</div>
        ) : (
        <div>
<div className="overflow-auto max-h-[65vh]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-center text-muted text-xs border-b border-black/8 sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <th className="px-5 py-2 w-10">S/N</th>
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
              {filteredRegs.slice(0, showAllRegs ? undefined : 3).map((r, i) => (
                <tr key={r.id} className="border-b border-black/5 align-middle text-center">
                  <td className="px-5 py-3 text-muted text-xs">{i + 1}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-2.5">
                      {photoSrc(r) && <img src={photoSrc(r)} alt="" className="w-9 h-9 rounded-full object-cover ring-1 ring-rose/30" />}
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <span className="font-medium">{r.fullName}</span>
                        <a onClick={() => setProfile(r)} className="text-blue-600 hover:underline cursor-pointer text-xs">
                          View profile
                        </a>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-xs">{r.email}</div>
                    <div className="text-xs text-muted">{r.phone}</div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-3">
                      <div>{r.ticketLabel || r.ticketType} × {r.quantity}</div>
                      {r.status === 'paid' && r.ticketToken && (
                        <button onClick={() => setTicketReg(r)} className="px-2 py-1 rounded-lg text-xs bg-blush text-rose-deep hover:opacity-80 flex items-center gap-1 whitespace-nowrap">
                          <TicketIcon size={11} /> View ticket
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">{formatNgn(r.amount)}</td>
                  <td className="px-5 py-3"><span className={statusBadge(r.status)}>{r.status}</span></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-center gap-1.5">
                      {labels.map((label, i) => {
                        const key = keys[i]
                        const on = r.attendance?.[key] === true
                        const busy = unmarking === `${r.id}:${key}`
                        return on ? (
                          <button
                            key={key}
                            type="button"
                            title={`${label} — checked in. Tap to unmark (admin correction).`}
                            onClick={() => unmarkAttendance(r, key, label)}
                            disabled={busy}
                            className="w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center bg-green-500 text-white shadow-sm transition-colors hover:bg-red-500 disabled:opacity-60"
                          >
                            {busy ? <LoaderCircle size={12} className="animate-spin" /> : i + 1}
                          </button>
                        ) : (
                          <span
                            key={key}
                            title={`${label} — not checked in`}
                            className="w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center bg-black/5 text-muted"
                          >
                            {i + 1}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col items-center gap-1.5">
                      <button onClick={() => setConfirmDelete(r)} className="px-2.5 py-1 rounded-lg text-xs bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center gap-1"><Trash2 size={11} /> Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRegs.length === 0 && <tr><td colSpan={8} className="px-5 py-12 text-center text-muted">{sortedRegs.length === 0 ? 'No registrations for this event yet.' : 'No registrations match these filters.'}</td></tr>}
            </tbody>
          </table>
        </div>
        {filteredRegs.length > 3 && (
          <div className="p-3 border-t border-black/5 text-center">
            <button
              onClick={() => {
                if (showAllRegs) setShowAllRegs(false)
                else setShowAllRegs(true)
              }}
              className="text-rose-deep hover:opacity-80 text-sm font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              {showAllRegs ? 'View less' : `View more (${filteredRegs.length - 3} more)`}
              <ChevronDown size={14} className={showAllRegs ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
          </div>
        )}
        </div>
        )}
      </div>

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
        <Modal open wide onClose={() => setProfile(null)}>
          <div className="text-center">
            <div className="relative w-20 h-20 mx-auto rounded-full overflow-hidden bg-blush ring-4 ring-blush/40">
              {photoSrc(profile) ? (
                <img
                  src={photoSrc(profile)}
                  alt={profile.fullName}
                  onClick={() => setPhotoZoom(true)}
                  className="w-full h-full object-cover cursor-zoom-in"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-display text-2xl font-bold text-rose-deep">
                  {profile.fullName.charAt(0)}
                </div>
              )}
            </div>
            <h3 className="font-display text-2xl font-bold mt-3">{profile.fullName}</h3>
            {profile.instagram && <p className="text-sm text-muted">@{profile.instagram}</p>}
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              <span className={statusBadge(profile.status)}>{profile.status}</span>
              <span className="text-xs text-muted">Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
            </div>
            <p className="text-xs text-muted mt-1">{event.title}</p>
          </div>

          <div className="mt-6 pt-5 border-t border-black/5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">Applicant details</h4>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <ProfileField label="Email" value={profile.email} />
              <ProfileField label="Phone" value={profile.phone} />
              <ProfileField label="Date of birth" value={formatDobWithAge(profile.dateOfBirth)} />
              <ProfileField label="State" value={profile.state} />
              <ProfileField label="Nationality" value={profile.nationality} />
              <ProfileField label="Experience level" value={profile.experienceLevel} />
              <ProfileField label="Address" value={profile.address} />
              <ProfileField label="Ticket" value={`${profile.ticketLabel || profile.ticketType} × ${profile.quantity}`} />
              <ProfileField label="Amount" value={formatNgn(profile.amount)} />
            </div>
          </div>

          {(profile.emergencyContactName || profile.emergencyContact || profile.reason) && (
            <div className="mt-5 pt-5 border-t border-black/5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">More info</h4>
              <div className="grid sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                {profile.emergencyContactName && <ProfileField label="Emergency contact" value={profile.emergencyContactName} />}
                {profile.emergencyContact && <ProfileField label="Emergency phone" value={profile.emergencyContact} />}
                {profile.reason && <ProfileField label="Reason" value={profile.reason} />}
              </div>
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-black/5">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-3">Attendance — {keys.length}-day program</h4>
            <div className="flex flex-wrap gap-2">
              {labels.map((label, i) => {
                const key = keys[i]
                const on = profile.attendance?.[key] === true
                return (
                  <span
                    key={key}
                    title={`${label} — ${on ? 'checked in' : 'not checked in'}`}
                    className={`w-9 h-9 rounded-full text-xs font-bold flex items-center justify-center ${on ? 'bg-green-500 text-white shadow-sm' : 'bg-black/5 text-muted'}`}
                  >
                    {i + 1}
                  </span>
                )
              })}
            </div>
          </div>
        </Modal>
      )}

      {photoZoom && profile && photoSrc(profile) && (
        <Modal open onClose={() => setPhotoZoom(false)}>
          <img src={photoSrc(profile!)} alt={profile.fullName} className="w-full max-h-[70vh] object-contain rounded-xl" />
        </Modal>
      )}

      {ticketReg && (
        <ViewTicketModal reg={ticketReg} event={event} headers={headers} onClose={() => setTicketReg(null)} />
      )}

      {emailOpen && (
        <EmailApplicantsModal regs={regs} event={event} headers={headers} onClose={() => setEmailOpen(false)} />
      )}

      {contactsOpen && (
        <SaveContactsModal regs={regs} event={event} onClose={() => setContactsOpen(false)} />
      )}

      {filterOpen && (
        <FilterRegModal event={event} onApply={setFilters} onClose={() => setFilterOpen(false)} />
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
              <button onClick={() => setConfirmDelete(null)} disabled={delBusy} className="btn btn-outline w-full sm:w-auto">Cancel</button>
              <button onClick={deleteReg} disabled={delBusy} className="btn bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 flex items-center gap-2 w-full sm:w-auto whitespace-nowrap">
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