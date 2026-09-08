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
import { getJson } from '../lib/api'
import { useRealtime } from '../lib/useRealtime'

const sponsorLines = [
  { grab: 'Put your brand front and center.', sub: 'Reach beauty lovers who genuinely care about their glow.' },
  { grab: 'Boost your brand’s visibility.', sub: 'Featured content, stage branding and shout-outs.' },
  { grab: 'Share the spotlight, grow together.', sub: 'Co-brand with a community that celebrates beauty.' },
  { grab: 'Be the brand behind the beauty.', sub: 'From product sampling to the main stage — be unforgettable.' },
]

const TICKER_FALLBACK = {
  enabled: true,
  messages: [
    '3BMC — 3 Days Beginner Makeup Class',
    'Registrations Open Now!',
    'Early Bird Offer Ends Soon!',
    'Partnership open for brands that wish to collaborate',
    'Partner With Us',
  ],
  bgColor: '#5f2436',
  textColor: '#fdf0f2',
}

// A ticker line can carry a link two ways:
//   "Register Now → https://wa.me/…"      label + external URL (arrow syntax)
//   "https://shawny.example/"               bare URL line
// "Partner With Us" keeps its built-in link to the sponsor page.
function renderTickerMsg(msg: string, color: string) {
  const arrow = msg.match(/^(.*?)\s*(?:→|->)\s*(.+)$/s)
  if (arrow && /^https?:\/\//.test(arrow[2].trim())) {
    const href = arrow[2].trim()
    const label = arrow[1].trim() || href
    return (
      <a href={href} target="_blank" rel="noreferrer" className="underline underline-offset-4" style={{ color }}>{label}</a>
    )
  }
  if (/^https?:\/\//.test(msg)) {
    return (
      <a href={msg} target="_blank" rel="noreferrer" className="underline underline-offset-4" style={{ color }}>{msg}</a>
    )
  }
  if (msg === 'Partner With Us') {
    return <Link to="/sponsor" className="underline underline-offset-4" style={{ color }}>Partner With Us</Link>
  }
  return <span>{msg}</span>
}

export default function Home() {
  const [live, setLive] = useState<StudioEvent>(defaultEvent)
  const [hasLive, setHasLive] = useState(false)
  const [ticker, setTicker] = useState(TICKER_FALLBACK)

  const refresh = () => {
    fetchLiveEventOrNull().then((ev) => {
      setLive(ev ?? defaultEvent)
      setHasLive(Boolean(ev))
    })
    getJson('/api/settings')
      .then((d: any) => {
        if (d?.ticker) {
          setTicker({
            enabled: typeof d.ticker.enabled === 'boolean' ? d.ticker.enabled : TICKER_FALLBACK.enabled,
            messages: Array.isArray(d.ticker.messages) && d.ticker.messages.length ? d.ticker.messages : TICKER_FALLBACK.messages,
            bgColor: d.ticker.bgColor || TICKER_FALLBACK.bgColor,
            textColor: d.ticker.textColor || TICKER_FALLBACK.textColor,
          })
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    refresh()
  }, [])

  // When the owner promotes/ends an event in the Diary, the homepage switches
  // to the new live event immediately for any visitor on this page. A light
  // poll backs this up when the socket can't connect. Ticker changes from the
  // admin are applied on the same cycle.
  useRealtime((type) => {
    if (type === 'events' || type === 'settings' || type === 'poll') refresh()
  }, { pollMs: 30000 })

  const registerUrl = eventRegisterUrl(live)

  return (
    <>
      {/* ===== Scrolling announcement ticker (locked below the header) ===== */}
      {ticker.enabled && ticker.messages.length > 0 && (
        <div
          className="sticky top-16 md:top-[72px] z-40 overflow-hidden border-b"
          style={{ backgroundColor: ticker.bgColor, color: ticker.textColor, borderColor: ticker.bgColor }}
        >
          <div className="marquee-track flex items-center">
            {[0, 1].map((i) => (
              <div key={i} className="flex shrink-0 items-center gap-10 pr-10 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider whitespace-nowrap">
                {ticker.messages.map((msg, j) => (
                  <span key={j} className="flex items-center gap-2.5" style={{ color: ticker.textColor }}>
                    <Sparkles size={12} className="shrink-0" style={{ color: ticker.textColor }} aria-hidden />
                    {renderTickerMsg(msg, ticker.textColor)}
                    <span style={{ color: ticker.textColor }}>·</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blush via-rose/15 to-cream">
        <div className="absolute top-0 right-0 w-[460px] h-[460px] rounded-full bg-rose/20 blur-3xl -z-10 float-slow" />
        <div className="absolute -bottom-10 -left-16 w-80 h-80 rounded-full bg-pinkgold/25 blur-3xl -z-10 float" />
        <div className="absolute top-40 left-1/4 w-64 h-64 rounded-full bg-gold/15 blur-3xl -z-10 float-slow" />
        <div className="container pt-10 md:pt-16 pb-10 md:pb-16">
          {/* Page title */}
          <Reveal variant="up">
            <div className="text-center mb-8 md:mb-10">
              <div className="flex justify-center mb-6">
                <span className="ornament"><Sparkles size={12} aria-hidden /></span>
              </div>
              <p className="eyebrow justify-center">WELCOME TO</p>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.08]">
                {siteConfig.name}
                <span className="gradient-text gradient-text-animate block">Look stunning, feel unstoppable.</span>
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
          <div className="relative mt-8 mx-auto max-w-3xl">
            <div className="relative overflow-hidden rounded-3xl">
              <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 rounded-3xl px-6 py-5 text-center sm:text-left overflow-hidden">
                <img
                  src="/images/carousel/event.jpg"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/40" />
                <span className="relative flex w-3 h-3 shrink-0 z-10" aria-hidden>
                  <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-80 animate-ping" />
                  <span className="relative inline-flex rounded-full w-3 h-3 bg-green-500" />
                </span>
                <p className="relative z-10 text-cream/95 text-sm sm:text-base leading-snug flex items-center gap-2 flex-wrap justify-center">
                  <span className="font-bold text-white">{live.title}</span> &mdash;{' '}
                  {live.datesLabel && <span className="text-white/85">{live.datesLabel} &mdash; </span>}
                  <span className="text-pinkgold font-semibold tracking-wide uppercase text-[13px]">Tickets On Sale</span>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide bg-green-500 text-white px-2.5 py-1 rounded-full animate-pulse">
                    <span className="relative flex w-1.5 h-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-white" />
                    </span>
                    Live
                  </span>
                </p>
                <Link to={registerUrl} className="relative z-10 btn shrink-0 w-full sm:w-auto !bg-[linear-gradient(135deg,#ffffff_0%,#d1d5db_55%,#9ca3af_100%)] !text-[#321d24] font-bold alert-blink border border-white/25 hover:!bg-[linear-gradient(135deg,#f9fafb_0%,#cbd5e1_55%,#94a3b8_100%)]">
                  Secure Your Ticket <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
          ) : (
          <div className="relative mt-8 mx-auto max-w-3xl">
            <div className="relative overflow-hidden rounded-3xl">
              <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 rounded-3xl px-6 py-6 text-center overflow-hidden">
                <img
                  src="/images/carousel/event.jpg"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/70 to-ink/40" />
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
            <div className="mt-8 mx-auto max-w-3xl">
              <div className="relative overflow-hidden isolate rounded-3xl silk-dark-deep text-white p-5 sm:p-6 md:p-7 border border-white/10">
                {/* drifting nebula waves */}
                <span aria-hidden className="nebula -top-12 -left-16 w-[340px] h-[120px] bg-rose/50" />
                <span aria-hidden className="nebula bottom-6 -right-16 w-[380px] h-[100px] bg-pinkgold/40" style={{ animationDelay: '-6s', animationDuration: '20s' }} />
                <span aria-hidden className="nebula top-1/2 left-[30%] w-[300px] h-[90px] bg-gold/35" style={{ animationDelay: '-11s', animationDuration: '22s' }} />
                {/* twinkling sponsor sparkles */}
                <span aria-hidden className="shine absolute top-7 left-[12%] w-1.5 h-1.5 rounded-full bg-gold shadow-[0_0_10px_2px_rgba(232,169,184,0.7)]" style={{ animationDelay: '0s' }} />
                <span aria-hidden className="shine absolute top-11 right-[18%] w-1 h-1 rounded-full bg-pinkgold shadow-[0_0_8px_2px_rgba(232,169,184,0.6)]" style={{ animationDelay: '-0.9s' }} />
                <span aria-hidden className="shine absolute bottom-11 left-[28%] w-1.5 h-1.5 rounded-full bg-rose shadow-[0_0_10px_2px_rgba(200,104,126,0.7)]" style={{ animationDelay: '-1.6s' }} />
                <span aria-hidden className="shine absolute bottom-9 right-[10%] w-1 h-1 rounded-full bg-gold shadow-[0_0_8px_2px_rgba(232,169,184,0.6)]" style={{ animationDelay: '-2.2s' }} />
                <span aria-hidden className="float-slow absolute top-4 left-[55%] text-gold/80"><Sparkles size={15} /></span>

                <div className="relative">
                  <div className="text-center sm:text-left">
                    <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold border border-gold/40 rounded-full px-3.5 py-1.5 mb-3 bg-white/5 backdrop-blur-sm">
                      <Handshake size={13} /> Sponsorship &amp; Partnerships
                    </span>

                    <div className="relative h-[112px] sm:h-[92px] overflow-hidden">
                      {sponsorLines.map((l, i) => (
                        <div key={l.grab} className="spot absolute inset-0 flex items-start" style={{ animationDelay: `${-i * 4}s` }}>
                          <div className="w-full">
                            <p className="gradient-text gradient-text-animate font-display text-2xl sm:text-3xl font-bold leading-tight">{l.grab}</p>
                            <p className="text-white/85 text-sm sm:text-base mt-2">{l.sub}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-0 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                      {['Brand Visibility', 'Community Growth', 'Featured Spot', 'Co-Branding'].map((c, i) => (
                        <span
                          key={c}
                          className="chip-loop text-[11px] font-semibold uppercase tracking-wider text-white/60 border border-white/15 rounded-full px-3 py-1 bg-white/5 whitespace-nowrap"
                          style={{ animationDelay: `${i * 0.6}s` }}
                        >
                          {c}
                        </span>
                      ))}
                    </div>

                    <div className="shrink-0 text-center">
                      <Link to="/sponsor" className="btn btn-light ping-soft !py-3 px-7 relative shadow-[0_18px_40px_-14px_rgba(42,27,34,0.9)] hover:scale-[1.02] transition-transform">
                        Partner With Us <ArrowRight size={18} />
                      </Link>
                      <p className="text-[11px] text-white/70 mt-3 flex items-center justify-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> A few partner slots still open
                      </p>
                    </div>
                  </div>
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
        <img
          src="/images/studio1.png"
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-ink/60 via-transparent to-ink/60" />
        <Reveal variant="up">
        <div className="container text-center relative z-10">
          <span className="ornament mb-5 justify-center"><Sparkles size={12} aria-hidden /></span>
          <InstagramIcon size={30} className="mx-auto text-gold my-4" />
          <h2 className="section-title text-white mb-3">Follow the journey</h2>
          <p className="text-white/80 mb-6">See fresh looks and behind-the-scenes on Instagram.</p>
          <a href={siteConfig.instagram} target="_blank" rel="noreferrer" className="btn btn-light">
            <InstagramIcon size={18} /> {siteConfig.instagramHandle}
          </a>
        </div>
        </Reveal>
      </section>
    </>
  )
}