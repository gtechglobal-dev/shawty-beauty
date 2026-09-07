import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  Clock,
  MapPin,
  Sparkles,
  MessageCircle,
  Handshake,
} from 'lucide-react'
import InstagramIcon from '../components/icons/InstagramIcon'
import EventsCarousel from '../components/layout/EventsCarousel'
import Reveal from '../components/Reveal'
import CountUp from '../components/CountUp'
import { siteConfig, defaultEvent, eventRegisterUrl } from '../lib/constants'
import { fetchLiveEventOrNull, type StudioEvent } from '../lib/events'

export default function Home() {
  const [live, setLive] = useState<StudioEvent>(defaultEvent)
  const [hasLive, setHasLive] = useState(false)

  useEffect(() => {
    fetchLiveEventOrNull().then((ev) => {
      setLive(ev ?? defaultEvent)
      setHasLive(Boolean(ev))
    })
  }, [])

  const registerUrl = eventRegisterUrl(live)

  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-cream via-blush/70 to-cream">
        <div className="absolute top-0 right-0 w-[460px] h-[460px] rounded-full bg-rose/20 blur-3xl -z-10 float-slow" />
        <div className="absolute -bottom-10 -left-16 w-80 h-80 rounded-full bg-pinkgold/25 blur-3xl -z-10 float" />
        <div className="absolute top-40 left-1/4 w-64 h-64 rounded-full bg-gold/15 blur-3xl -z-10 float-slow" />
        <div className="container pt-10 md:pt-16 pb-10 md:pb-16">
          {/* Page title */}
          <Reveal variant="up">
            <div className="text-center mb-8 md:mb-10">
              <div className="flex justify-center mb-6">
                <span className="ornament">✦</span>
              </div>
              <p className="eyebrow justify-center">Welcome to Shawty</p>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.08]">
                {siteConfig.name}
                <span className="gradient-text block">Look stunning, feel unstoppable.</span>
              </h1>
              <div className="mx-auto mt-6 flex items-center justify-center gap-3 text-sm sm:text-base font-medium tracking-wide text-ink/70">
                <span>Premium Services</span>
                <span className="text-rose/60" aria-hidden>|</span>
                <span className="gradient-text font-semibold">Beauty that celebrates you</span>
              </div>
            </div>
          </Reveal>

          {/* Ads / events scrolling carousel */}
          <EventsCarousel live={hasLive ? live : null} />

          {/* Live event ticket alert */}
          {hasLive ? (
          <div className="relative mt-8 mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-3xl">
              <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 rounded-3xl px-6 py-5 text-center sm:text-left overflow-hidden">
                <img
                  src="/images/carousel/event.jpg"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
                <span className="relative flex w-3 h-3 shrink-0 z-10" aria-hidden>
                  <span className="absolute inline-flex h-full w-full rounded-full bg-rose opacity-80 animate-ping" />
                  <span className="relative inline-flex rounded-full w-3 h-3 bg-rose" />
                </span>
                <p className="relative z-10 text-cream/95 text-sm sm:text-base leading-snug flex items-center gap-2 flex-wrap justify-center">
                  <span className="font-bold text-white">{live.title}</span> &mdash;{' '}
                  {live.datesLabel && <span className="text-white/85">{live.datesLabel} &mdash; </span>}
                  <span className="text-pinkgold font-semibold tracking-wide uppercase text-[13px]">Tickets On Sale</span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white px-2.5 py-1 rounded-full animate-pulse">
                    <span className="relative flex w-1.5 h-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-white" />
                    </span>
                    Live
                  </span>
                </p>
                <Link to={registerUrl} className="relative z-10 btn shrink-0 w-full sm:w-auto !bg-white !text-ink font-bold alert-blink border border-white/40 hover:!bg-cream">
                  Secure Your Ticket <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
          ) : (
          <div className="relative mt-8 mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-3xl">
              <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 rounded-3xl px-6 py-6 text-center overflow-hidden">
                <img
                  src="/images/carousel/event.jpg"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/70 to-black/40" />
                <div className="relative z-10">
                  <span className="text-xs font-bold uppercase tracking-[0.2em] text-pinkgold">Masterclasses &amp; Events</span>
                  <p className="text-cream text-base sm:text-lg font-semibold mt-1">
                    Something beautiful is brewing — our next event is coming soon.
                  </p>
                  <p className="text-white/75 text-sm mt-1">Watch this space for dates and tickets.</p>
                </div>
              </div>
            </div>
          </div>
          )}

          {/* Sponsorship CTA */}
          <Reveal variant="zoom" delay={100}>
            <div className="mt-6 mx-auto max-w-4xl border-glow rounded-3xl">
              <div className="rounded-3xl bg-white/80 backdrop-blur-sm px-6 py-4 shadow-lg card-silk">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
                  <Handshake size={22} className="text-rose-deep shrink-0" />
                  <p className="text-ink/80 text-sm sm:text-base leading-snug">
                    <span className="font-bold text-ink">Interested in sponsoring?</span>{' '}
                    Align your brand with beauty — <span className="text-rose-deep font-medium">get visibility, boost your brand and ours.</span>
                  </p>
                  <Link to="/sponsor" className="btn btn-outline !border-rose/40 !text-rose-deep hover:!bg-blush/60 shrink-0 w-full sm:w-auto">
                    Partner With Us <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Stats */}
          <Reveal variant="up" delay={200}>
            <div className="text-center pt-14 md:pt-16">
              <div className="flex flex-wrap gap-3 justify-center mb-10">
                <Link to="/services" className="btn btn-primary">
                  Explore Services <ArrowRight size={18} />
                </Link>
                <a
                  href={siteConfig.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline"
                >
                  <MessageCircle size={18} /> Book Now
                </a>
              </div>
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="card card-hover card-silk px-4 py-3 text-center">
                  <div className="font-display text-2xl font-bold text-rose-deep"><CountUp end={500} suffix="+" /></div>
                  <div className="text-[11px] text-muted mt-0.5">Happy Clients</div>
                </div>
                <div className="card card-hover card-silk px-4 py-3 text-center delay-100">
                  <div className="font-display text-2xl font-bold text-rose-deep"><CountUp end={5} suffix="+" /></div>
                  <div className="text-[11px] text-muted mt-0.5">Years of Experience</div>
                </div>
                <div className="card card-hover card-silk px-4 py-3 text-center delay-200">
                  <div className="font-display text-2xl font-bold text-rose-deep"><CountUp end={100} suffix="+" /></div>
                  <div className="text-[11px] text-muted mt-0.5">Beauty Sessions</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== LIVE EVENT ADVERT BANNER ===== */}
      {hasLive && (
      <section className="section-pad">
        <div className="container">
          <Reveal variant="zoom">
          <div className="rounded-[2rem] silk-dark text-white p-7 sm:p-10 md:p-14 relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-rose/20 blur-2xl float-slow" />
            <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-pinkgold/15 blur-2xl float" />

            <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-10 relative z-10">
              <div className="flex-1">
                <span className="inline-flex items-center gap-2 text-xs font-semibold bg-white/10 border border-white/15 px-4 py-1.5 rounded-full mb-4 backdrop-blur-sm">
                  <Sparkles size={14} className="text-pinkgold" /> Now Hosting an Event
                </span>
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-3">
                  {live.title}
                </h2>
                <p className="text-white/80 max-w-xl leading-relaxed mb-5">
                  “{live.theme}”{live.plus ? <> — a hands-on {live.durationLabel} experience built around {live.whoFor.join(', ').toLowerCase()}.</> : ''}
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Link to="/program" className="btn btn-light">
                    Get Full Details <ArrowRight size={18} />
                  </Link>
                  <Link to={registerUrl} className="btn !bg-white/10 !text-white border border-white/25 hover:!bg-white/20">
                    Register / Tickets <ArrowRight size={18} />
                  </Link>
                </div>
              </div>

              <div className="lg:w-[320px] shrink-0 grid grid-cols-2 gap-3">
                <div className="bg-white/10 border border-white/10 rounded-2xl p-4 backdrop-blur-sm card-hover">
                  <CalendarDays size={20} className="mb-2 text-pinkgold" />
                  <div className="font-semibold text-sm leading-snug">{live.datesLabel || 'Dates — coming soon'}</div>
                  <div className="text-xs opacity-75 mt-1">{live.durationLabel}</div>
                </div>
                <div className="bg-white/10 border border-white/10 rounded-2xl p-4 backdrop-blur-sm card-hover">
                  <Clock size={20} className="mb-2 text-pinkgold" />
                  <div className="font-semibold text-sm leading-snug">{live.timeLabel || '—'}</div>
                  <div className="text-xs opacity-75 mt-1">Sessions</div>
                </div>
                <div className="bg-white/10 border border-white/10 rounded-2xl p-4 backdrop-blur-sm col-span-2 flex flex-col items-center text-center card-hover">
                  <MapPin size={20} className="mb-2 text-pinkgold" />
                  <div className="text-sm leading-snug">{live.venueNote || 'Venue announced soon'}</div>
                </div>
              </div>
            </div>
          </div>
          </Reveal>
        </div>
      </section>
      )}

      {/* ===== INSTAGRAM CTA ===== */}
      <section className="section-pad silk-dark relative overflow-hidden">
        <Reveal variant="up">
        <div className="container text-center relative z-10">
          <span className="ornament mb-5 justify-center">✦</span>
          <InstagramIcon size={30} className="mx-auto text-rose my-4" />
          <h2 className="section-title text-white mb-3">Follow the journey</h2>
          <p className="text-muted mb-6">See fresh looks and behind-the-scenes on Instagram.</p>
          <a href={siteConfig.instagram} target="_blank" rel="noreferrer" className="btn btn-light">
            <InstagramIcon size={18} /> {siteConfig.instagramHandle}
          </a>
        </div>
        </Reveal>
      </section>
    </>
  )
}