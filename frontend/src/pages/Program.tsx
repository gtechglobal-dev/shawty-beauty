import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  Sparkles,
  CircleCheck,
  Lightbulb,
  Package,
  LoaderCircle,
} from 'lucide-react'
import { eventRegisterUrl, type StudioEvent } from '../lib/constants'
import { fetchEvents, fetchLiveEventOrNull, ticketPromoActive, ticketPrice, isEventLive } from '../lib/events'
import { useRealtime } from '../lib/useRealtime'
import Reveal from '../components/Reveal'
import TicketCard from '../components/TicketCard'

export default function Program() {
  const [events, setEvents] = useState<StudioEvent[]>([])
  const [live, setLive] = useState<StudioEvent | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const [evs, l] = await Promise.all([fetchEvents(), fetchLiveEventOrNull()])
    setEvents(evs)
    setLive(l)
  }

  useEffect(() => {
    ;(async () => {
      await refresh()
      setLoading(false)
    })()
  }, [])

  // Live event changes from the Diary land here in real time too, with a
  // polling fallback when the socket can't connect.
  useRealtime((type) => {
    if (type === 'events' || type === 'poll') {
      setLoading(false)
      refresh().catch(() => {})
    }
  }, { pollMs: 30000 })

  const featured = live && live.status === 'live' ? live : null
  const others = events.filter((e) => e.id !== live?.id)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoaderCircle size={34} className="animate-spin text-rose" />
      </div>
    )
  }

  // No featured event right now (e.g. every event has ended) — show a
  // coming-soon header and list all events, with ended ones tagged as past.
  if (!featured) {
    return (
      <div>
        <section className="bg-gradient-to-br from-blush via-cream to-white">
          <div className="container py-12 md:py-20 text-center max-w-3xl">
            <Reveal variant="up">
              <span className="eyebrow mb-4">Hosted by Shawty Beauty Studio</span>
              <span className="ornament mt-3 justify-center">✦</span>
              <h1 className="section-title text-4xl md:text-5xl my-4">Our Events</h1>
              <p className="font-display italic text-xl text-ink/70 mb-4">
                Something beautiful is brewing — tickets and dates for our next happening are coming soon.
              </p>
            </Reveal>
          </div>
        </section>

        <div className="container section-pad">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div>
              <span className="eyebrow">Upcoming &amp; past events</span>
              <h2 className="section-title text-3xl mt-3">More happenings</h2>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
            {others.map((ev, i) => renderEventCard(ev, i))}
            {others.length === 0 && (
              <div className="card p-10 text-center text-muted sm:col-span-2 lg:col-span-3">
                No events yet — watch this space.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <section className="bg-gradient-to-br from-blush via-cream to-white">
        <div className="container py-12 md:py-20 text-center">
          <Reveal variant="up">
            <span className="eyebrow mb-4">Hosted by Shawty Beauty Studio</span>
            <span className="ornament mt-3 justify-center">✦</span>
            <h1 className="section-title text-4xl md:text-5xl my-4">{featured.title}</h1>
            <p className="font-display italic text-xl text-ink/70 mb-10">“{featured.theme}”</p>
          </Reveal>

          <Reveal variant="up" delay={150}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              <div className="flex items-center gap-3 card px-5 py-4 card-hover">
                <CalendarDays className="text-rose shrink-0" />
                <div className="text-left">
                  <div className="text-sm font-semibold">{featured.datesLabel || 'Dates coming soon'}</div>
                  <div className="text-xs text-muted">{featured.durationLabel}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 card px-5 py-4 card-hover">
                <Clock className="text-rose shrink-0" />
                <div className="text-left">
                  <div className="text-sm font-semibold">{featured.timeLabel || '—'}</div>
                  <div className="text-xs text-muted">Sessions</div>
                </div>
              </div>
              <div className="flex items-center gap-3 card px-5 py-4 card-hover">
                <MapPin className="text-rose shrink-0" />
                <div className="text-left">
                  <div className="text-sm font-semibold">{featured.venueNote || 'Venue TBA'}</div>
                  <div className="text-xs text-muted">{featured.venueNote ? 'Announced to students' : 'Disclosed after registration'}</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <div className="container section-pad space-y-14 md:space-y-20">
        {/* Who it's for */}
        <Reveal variant="up">
        <section>
          <span className="eyebrow">Who it's for</span>
          <h2 className="section-title mt-3 mb-6">Made for you</h2>
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            {(featured.whoFor?.length ? featured.whoFor : ['Makeup lovers', 'Beginner makeup artists']).map((w) => (
              <span key={w} className="tag-chip !text-sm !py-2">{w}</span>
            ))}
          </div>
        </section>
        </Reveal>

        {/* What you'll learn */}
        {featured.learn?.length > 0 && (
        <section>
          <Reveal variant="left">
            <span className="eyebrow">Curriculum</span>
            <h2 className="section-title mt-3 mb-2">What participants will learn</h2>
            <p className="text-ink/70 mb-8 max-w-2xl">{featured.plus}</p>
          </Reveal>
          <div className="grid md:grid-cols-2 gap-4">
            {featured.learn.map((item, i) => (
              <Reveal key={item} variant="zoom" delay={i * 80}>
                <div className="card p-6 flex items-start gap-3 card-hover">
                  <CircleCheck className="text-rose shrink-0 mt-0.5" size={22} />
                  <span className="text-ink/80">{item}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </section>
        )}

        {/* Difference + bring */}
        <section className="grid md:grid-cols-2 gap-10 items-start">
          <Reveal variant="left">
          <div className="card p-8 card-hover">
            <div className="w-12 h-12 rounded-xl bg-blush flex items-center justify-center mb-4">
              <Lightbulb className="text-rose-dark" size={22} />
            </div>
            <h3 className="section-title text-2xl mb-3">What makes this program different</h3>
            <p className="text-ink/75">
              {featured.plus || 'This isn’t just about teaching people how to apply makeup — it’s about building yourself into a Beauty CEO.'}
            </p>
          </div>
          </Reveal>

          <Reveal variant="right">
          <div className="card p-8 card-hover">
            <div className="w-12 h-12 rounded-xl bg-blush flex items-center justify-center mb-4">
              <Package className="text-rose-dark" size={22} />
            </div>
            <h3 className="section-title text-2xl mb-3">What to come with</h3>
            <p className="text-ink/75">
              {featured.bring || 'All learning materials are provided; bring yourself and your enthusiasm!'}
            </p>
          </div>
          </Reveal>
        </section>

        {/* Ticket options */}
        <section>
          <Reveal variant="up">
            <span className="eyebrow">Registration / Tickets</span>
            <h2 className="section-title mt-3 mb-2">Choose your ticket</h2>
            <p className="text-ink/70 mb-10">The exact date and details will be communicated. Venue is disclosed to registered students after ticket purchase.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-6 max-w-3xl">
            {featured.tickets.map((t, i) => (
              <Reveal key={t.id} variant="zoom" delay={i * 100} className="h-full">
                <Link to={`/register?event=${encodeURIComponent(featured.slug || featured.id)}&ticket=${t.id}`} className="block h-full">
                  <TicketCard t={t} className="h-full" />
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Other happenings */}
        {(others.length > 0 || (live && !isEventLive(featured))) && (
        <section>
          <Reveal variant="up">
            <span className="eyebrow">Upcoming &amp; past events</span>
            <h2 className="section-title mt-3 mb-6">More happenings</h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {others.map((ev, i) => renderEventCard(ev, i))}
          </div>
        </section>
        )}

        {/* CTA */}
        <Reveal variant="zoom">
        <div className="text-center">
          <Sparkles className="mx-auto text-rose mb-4" size={30} />
          <h2 className="section-title mb-4">Ready to begin your beauty journey?</h2>
          <Link to={eventRegisterUrl(featured)} className="btn btn-primary">
            Register Now <ArrowRight size={18} />
          </Link>
        </div>
        </Reveal>
      </div>
    </div>
  )
}

function renderEventCard(ev: StudioEvent, i: number) {
  return (
    <Reveal key={ev.id} variant="zoom" delay={i * 80} className="h-full">
      <div className="card p-6 flex flex-col h-full card-hover">
        <div className="flex items-center gap-2 mb-3">
          <span className={`tag-chip ${ev.status === 'live' ? '!bg-red-600 !bg-none !text-white' : ev.status === 'finished' ? '!bg-black/10' : ''}`}>
            {ev.status === 'live' ? '● Live' : ev.status === 'finished' ? 'Past event' : 'Upcoming'}
          </span>
          {ev.datesLabel && <span className="text-xs text-muted">{ev.datesLabel}</span>}
        </div>
        <h3 className="font-display text-lg font-bold leading-snug mb-2">{ev.title}</h3>
        {ev.theme && <p className="text-sm text-ink/65 line-clamp-2 mb-4">“{ev.theme}”</p>}
        <div className="flex items-baseline gap-2 mb-4 mt-auto">
          {ev.tickets[0] && ev.status !== 'finished' && (
            <>
              {ticketPromoActive(ev.tickets[0]) && (
                <span className="text-sm text-muted line-through">₦{ev.tickets[0].originalPrice?.toLocaleString()}</span>
              )}
              <span className="font-display text-xl font-bold text-rose-dark">
                From ₦{Math.min(...ev.tickets.map((t) => ticketPrice(t))).toLocaleString()}
              </span>
            </>
          )}
          {ev.status === 'finished' && (
            <span className="font-display text-xl font-bold text-muted">Completed</span>
          )}
        </div>
        <Link to={eventRegisterUrl(ev)} className={`btn ${ev.status === 'finished' ? 'btn-outline' : 'btn-outline'} !py-2.5 w-full`}>
          {ev.status === 'finished' ? 'View event' : 'Register'} <ArrowRight size={16} />
        </Link>
      </div>
    </Reveal>
  )
}