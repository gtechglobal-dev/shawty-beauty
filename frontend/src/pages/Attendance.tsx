import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LoaderCircle, CircleCheck, CircleAlert, Ticket, CalendarDays, QrCode } from 'lucide-react'
import { getJson, postJson } from '../lib/api'
import { useToast } from '../components/Toasts'
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
  const [attendance, setAttendance] = useState<Record<string, boolean>>({})
  const [closing, setClosing] = useState(false)

  const toast = useToast()

  function closePage() {
    setClosing(true)
    try {
      window.open('', '_self')
    } catch {
      /* no-op */
    }
    window.close()
  }

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
      toast.push('Enter the attendance code first.', 'err')
      return
    }
    setMarking(true)
    try {
      const data = await postJson(`/api/tickets/${encodeURIComponent(token)}/attendance`, { code: code.trim() })
      toast.push(data.message || 'Marked present.')
      setAttendance(data.registration?.attendance || attendance)
      setInfo((prev) => (prev ? { ...prev, registration: data.registration } : prev))
      setCode('')
    } catch (err: any) {
      toast.push(err.message || 'Could not mark attendance', 'err')
    } finally {
      setMarking(false)
    }
  }

  const labels = info?.event?.attendanceLabels || []
  const presentCount = Object.values(attendance).filter(Boolean).length

  return (
    <div className="container py-20 max-w-lg">
      <Reveal variant="up">
        {closing ? (
          <div className="card p-8 sm:p-10 text-center relative overflow-hidden">
            <span className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-blush blur-2xl" />
            <div className="inline-flex justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-rose to-rose-deep items-center text-white mb-4">
              <CircleCheck size={26} />
            </div>
            <h1 className="font-display text-2xl font-bold">All done!</h1>
            <p className="text-muted text-sm mt-2 leading-relaxed">
              Your check-in is saved. You can close this tab now to return to what you were doing.
            </p>
          </div>
        ) : (
          <div className="card p-8 sm:p-10 text-center relative overflow-hidden">
          <span className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-blush blur-2xl" />
          <button
            type="button"
            onClick={closePage}
            className="absolute top-3 right-3 z-10 rounded-full bg-rose-deep border border-rose-deep text-white text-sm font-medium px-3.5 py-1.5 hover:bg-rose hover:border-rose transition-colors"
          >
            Close
          </button>

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
                <button type="submit" disabled={marking} className="btn btn-primary w-full mt-4 flex items-center justify-center gap-2">
                  {marking ? <LoaderCircle size={18} className="animate-spin" /> : <CircleCheck size={18} />}
                  Mark me present
                </button>
                <p className="text-xs text-muted mt-3 text-center">
                  Ask the studio for today’s code. Your ticket QR identifies you, so only you are marked.
                </p>
              </form>
            </>
          )}
        </div>
        )}
      </Reveal>
    </div>
  )
}