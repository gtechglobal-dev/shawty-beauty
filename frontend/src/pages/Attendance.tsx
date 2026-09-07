import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LoaderCircle, CircleCheck, CircleAlert, Ticket, Download, CalendarDays, QrCode } from 'lucide-react'
import { getJson, postJson } from '../lib/api'
import Reveal from '../components/Reveal'

interface TicketInfo {
  registration: {
    id: string
    fullName: string
    phone: string
    ticketLabel: string
    quantity: number
    status: string
    attendance: Record<string, boolean>
    present: boolean
    eventId?: string
  }
  event: {
    id: string
    title: string
    datesLabel: string
    timeLabel: string
    attendanceDays: number
    attendanceLabels: string[]
  } | null
  downloadUrl: string
  scanUrl: string
}

export default function Attendance() {
  const [params] = useSearchParams()
  const token = params.get('t') || ''

  const [info, setInfo] = useState<TicketInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [marking, setMarking] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setError('This check-in link is missing its ticket token. Open the link from your ticket’s QR code.')
      return
    }
    getJson(`/api/tickets/${encodeURIComponent(token)}/info`)
      .then((data) => {
        setInfo(data)
        setAttendance(data.registration?.attendance || {})
      })
      .catch((err: any) => setError(err.message || 'Failed to load ticket'))
      .finally(() => setLoading(false))
  }, [token])

  async function markAttendance(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) {
      setMsg({ type: 'err', text: 'Enter the attendance code first.' })
      return
    }
    setMarking(true)
    setMsg(null)
    try {
      const data = await postJson(`/api/tickets/${encodeURIComponent(token)}/attendance`, { code: code.trim() })
      setMsg({ type: 'ok', text: data.message })
      setAttendance(data.registration?.attendance || attendance)
      setInfo((prev) => (prev ? { ...prev, registration: data.registration } : prev))
      setCode('')
    } catch (err: any) {
      setMsg({ type: 'err', text: err.message || 'Could not mark attendance' })
    } finally {
      setMarking(false)
    }
  }

  const labels = info?.event?.attendanceLabels || []
  const presentCount = Object.values(attendance).filter(Boolean).length

  return (
    <div className="container py-20 max-w-lg">
      <Reveal variant="up">
        <div className="card p-8 sm:p-10 text-center relative overflow-hidden">
          <span className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-blush blur-2xl" />

          {loading && (
            <div className="py-10 text-muted flex flex-col items-center gap-3">
              <LoaderCircle size={36} className="animate-spin text-rose" />
              Loading your ticket…
            </div>
          )}

          {!loading && error && (
            <div className="py-10">
              <CircleAlert size={48} className="mx-auto text-rose-dark mb-4" />
              <h1 className="font-display text-2xl font-bold mb-3">Check-in unavailable</h1>
              <p className="text-muted text-sm">{error}</p>
              <Link to="/" className="btn btn-outline mt-6">Back to home</Link>
            </div>
          )}

          {!loading && !error && info?.event && (
            <>
              <span className="inline-flex justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-rose to-rose-deep items-center text-white mb-2">
                <QrCode size={26} />
              </span>
              <h1 className="font-display text-2xl sm:text-3xl font-bold mt-3">{info.event.title}</h1>
              <p className="text-muted text-sm mt-1">
                {info.event.datesLabel}{info.event.timeLabel ? ` · ${info.event.timeLabel}` : ''}
              </p>

              <div className="mt-6 p-4 rounded-2xl bg-blush/40 border border-pinkgold/20 text-left">
                <div className="text-xs uppercase tracking-widest text-muted mb-1">Welcome</div>
                <div className="font-display text-xl font-bold">{info.registration.fullName}</div>
                <div className="flex items-center gap-1.5 text-sm text-rose-dark mt-1">
                  <Ticket size={15} /> {info.registration.ticketLabel} × {info.registration.quantity}
                </div>
              </div>

              {/* Days */}
              <div className="mt-6">
                <div className="text-sm font-semibold text-muted mb-3">
                  Attendance — {presentCount} of {labels.length} sessions marked
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {labels.map((label, i) => {
                    const on = attendance[`d${i + 1}`] === true
                    return (
                      <div
                        key={label}
                        className={`rounded-xl px-3 py-3 border text-sm font-semibold flex items-center justify-center gap-2 ${
                          on ? 'bg-green-50 border-green-200 text-green-700' : 'bg-black/[0.03] border-black/5 text-muted'
                        }`}
                      >
                        <CalendarDays size={15} /> {label}
                        {on && <CircleCheck size={16} className="text-green-600" />}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Check-in */}
              <form onSubmit={markAttendance} className="mt-7 text-left">
                <label className="field-label">Day’s attendance code</label>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="input-field text-center tracking-[0.4em] font-bold uppercase"
                  placeholder="— — — — — —"
                  maxLength={8}
                  autoComplete="off"
                />
                {msg && (
                  <div
                    className={`mt-3 p-3 rounded-xl text-sm flex items-start gap-2 ${
                      msg.type === 'ok' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
                    }`}
                  >
                    {msg.type === 'ok' ? <CircleCheck size={18} className="shrink-0" /> : <CircleAlert size={18} className="shrink-0" />}
                    {msg.text}
                  </div>
                )}
                <button type="submit" disabled={marking} className="btn btn-primary w-full mt-4 flex items-center justify-center gap-2">
                  {marking ? <LoaderCircle size={18} className="animate-spin" /> : <CircleCheck size={18} />}
                  Mark me present
                </button>
                <p className="text-xs text-muted mt-3 text-center">
                  Ask the studio for today’s code. Your ticket QR identifies you, so only you are marked.
                </p>
                <a href={info.downloadUrl} className="btn btn-outline w-full mt-4 flex items-center justify-center gap-2" download>
                  <Download size={16} /> Download ticket (PNG)
                </a>
              </form>
            </>
          )}
        </div>
      </Reveal>
    </div>
  )
}