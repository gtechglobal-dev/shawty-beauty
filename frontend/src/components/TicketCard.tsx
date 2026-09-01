import { CircleCheck, Timer } from 'lucide-react'
import { formatNgn, ticketPrice, ticketPromoActive, type Ticket } from '../lib/constants'

export default function TicketCard({
  t,
  now = Date.now(),
  showRadio = false,
  selected = false,
}: {
  t: Ticket
  now?: number
  showRadio?: boolean
  selected?: boolean
}) {
  const price = ticketPrice(t, now)
  const promoActive = ticketPromoActive(t, now)
  const remaining = Math.max(0, (t.promoDeadline ?? 0) - now)
  const isStudent = t.id === 'student'

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-white shadow-sm transition-all duration-200 ${
        selected
          ? 'ring-2 ring-offset-2 ring-rose-dark shadow-lg'
          : 'border border-black/10 hover:-translate-y-0.5 hover:shadow-md'
      } ${isStudent ? 'ticket-student' : 'ticket-gold'}`}
    >
      {selected && (
        <span className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm">
          <CircleCheck size={15} className="text-rose-dark" />
        </span>
      )}

      {/* Ticket header */}
      <div
        className={`flex items-center justify-between px-4 py-2.5 text-white text-sm font-bold tracking-wide ${
          isStudent
            ? 'bg-gradient-to-r from-rose-dark to-rose'
            : 'bg-gradient-to-r from-[#856238] to-gold'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-white/40" />
          {t.label}
        </span>
        {showRadio && (
          <span
            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              selected ? 'bg-white' : 'border-white/80'
            }`}
          >
            {selected && <span className="w-1.5 h-1.5 rounded-full bg-black" />}
          </span>
        )}
      </div>

      {/* Perforated divider */}
      <div className="relative border-t-2 border-dashed border-ink/20">
        <span className="absolute left-1/2 -translate-x-1/2 -top-[3px] flex gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-ink/30" />
          <span className="w-1.5 h-1.5 rounded-full bg-ink/30" />
          <span className="w-1.5 h-1.5 rounded-full bg-ink/30" />
        </span>
      </div>

      {/* Ticket body */}
      <div className="px-4 pt-2.5 pb-3">
        <div className="flex flex-wrap items-baseline gap-2">
          {promoActive && (
            <span className="text-base font-semibold text-muted line-through">
              {formatNgn(t.originalPrice!)}
            </span>
          )}
          <span className="font-display text-2xl font-bold text-rose-dark">{formatNgn(price)}</span>
        </div>
        <div className="text-xs text-muted">per {t.unitName}</div>

        {promoActive && (
          <div className="text-xs font-medium text-rose-dark mt-1.5">
            <Timer size={12} className="inline -mt-0.5 mr-1" />
            Promo ends in{' '}
            <span className="font-bold tabular-nums">{formatCountdown(remaining)}</span>
          </div>
        )}

        {t.description && (
          <p className="text-xs text-ink/70 leading-snug mt-2">{t.description}</p>
        )}

        <ul className="space-y-1.5 text-xs text-ink/75 mt-2">
          {t.includes.map((inc) => (
            <li key={inc} className="flex items-start gap-1.5">
              <CircleCheck size={13} className="text-rose shrink-0 mt-0.5" />
              {inc}
            </li>
          ))}
        </ul>

        {t.highlighted && (
          <span className="inline-flex text-[10px] font-bold uppercase tracking-wide bg-rose text-white px-2 py-0.5 rounded-full mt-2 w-fit">
            Popular
          </span>
        )}
      </div>
    </div>
  )
}

function formatCountdown(ms: number) {
  const s = Math.floor(ms / 1000)
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${days}d ${pad(hours)}h ${pad(mins)}m ${pad(secs)}s`
}