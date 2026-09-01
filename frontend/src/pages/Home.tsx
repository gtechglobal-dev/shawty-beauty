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
import { makeupServices, program, siteConfig } from '../lib/constants'

export default function Home() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blush via-cream to-white">
        <div className="absolute top-0 right-0 w-[420px] h-[420px] rounded-full bg-rose/15 blur-3xl -z-10 float-slow" />
        <div className="absolute -bottom-10 -left-16 w-72 h-72 rounded-full bg-gold/15 blur-3xl -z-10 float" />
        <div className="container pt-10 md:pt-16 pb-10 md:pb-16">
          {/* Page title */}
          <Reveal variant="up">
            <div className="text-center mb-8 md:mb-10">
              <span className="eyebrow mb-4 justify-center">Welcome to</span>
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.08]">
                {siteConfig.name}
                <span className="gradient-text block">Look stunning, feel unstoppable.</span>
              </h1>
            </div>
          </Reveal>

          {/* Ads / events scrolling carousel */}
          <EventsCarousel />

          {/* Tickets alert */}
          <div className="relative mt-8 mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-2xl shadow-xl">
              <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 rounded-2xl px-6 py-5 text-center sm:text-left overflow-hidden">
                <img
                  src="/images/carousel/event.jpg"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/75 to-black/45" />
                <span className="relative flex w-3 h-3 shrink-0 z-10" aria-hidden>
                  <span className="absolute inline-flex h-full w-full rounded-full bg-rose opacity-80 animate-ping" />
                  <span className="relative inline-flex rounded-full w-3 h-3 bg-rose" />
                </span>
                <p className="relative z-10 text-cream/95 text-sm sm:text-base leading-snug flex items-center gap-2 flex-wrap justify-center">
                  <span className="font-bold text-white">3-Days Beginner Makeup Class</span> &mdash;{' '}
                  <span className="text-gold font-medium">TICKETS ON SALE</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                    <span className="relative flex w-1.5 h-1.5">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-75 animate-ping" />
                      <span className="relative inline-flex rounded-full w-1.5 h-1.5 bg-white" />
                    </span>
                    Live
                  </span>
                </p>
                <Link to="/register" className="relative z-10 btn shrink-0 w-full sm:w-auto text-white font-bold alert-blink" style={{ background: 'linear-gradient(135deg, #8b5cf6, #f97316)', boxShadow: '0 8px 24px rgba(249, 115, 22, 0.4)' }}>
                  Secure Your Ticket <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>

          {/* Sponsorship CTA */}
          <Reveal variant="zoom" delay={100}>
            <div className="mt-6 mx-auto max-w-4xl border-glow rounded-2xl">
              <div className="rounded-2xl bg-white px-6 py-4 shadow-lg">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 text-center sm:text-left">
                  <Handshake size={22} className="text-fuchsia-600 shrink-0" />
                  <p className="text-ink/80 text-sm sm:text-base leading-snug">
                    <span className="font-bold text-ink">Interested in sponsoring?</span>{' '}
                    Align your brand with beauty — <span className="text-fuchsia-600 font-medium">get visibility, boost your brand and ours.</span>
                  </p>
                  <Link to="/sponsor" className="btn btn-outline !border-fuchsia-300 !text-fuchsia-700 hover:!bg-fuchsia-50 shrink-0 w-full sm:w-auto">
                    Partner With Us <ArrowRight size={18} />
                  </Link>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Content */}
          <Reveal variant="up" delay={200}>
            <div className="text-center pt-12 md:pt-16">
              <p className="text-ink/70 text-lg mb-8 max-w-xl leading-relaxed mx-auto">
                Premium {makeupServices.length} makeup services and lash extensions in one studio.
                From soft glam to bridal glam, and classic lashes to volume — beauty that celebrates you.
              </p>
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
                <div className="card card-hover px-4 py-3 text-center">
                  <div className="font-display text-2xl font-bold text-rose-dark"><CountUp end={5} suffix="+" /></div>
                  <div className="text-[11px] text-muted mt-0.5">Makeup Looks</div>
                </div>
                <div className="card card-hover px-4 py-3 text-center delay-100">
                  <div className="font-display text-2xl font-bold text-rose-dark"><CountUp end={4} /></div>
                  <div className="text-[11px] text-muted mt-0.5">Lash Sets</div>
                </div>
                <div className="card card-hover px-4 py-3 text-center delay-200">
                  <div className="font-display text-2xl font-bold text-rose-dark">1-on-1</div>
                  <div className="text-[11px] text-muted mt-0.5">Training</div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ===== EVENT ADVERT BANNER ===== */}
      <section className="section-pad">
        <div className="container">
          <Reveal variant="zoom">
          <div className="rounded-3xl bg-gradient-to-br from-rose-dark via-rose to-gold p-7 sm:p-10 md:p-14 text-white relative overflow-hidden">
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/10 blur-2xl float-slow" />
            <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full bg-white/10 blur-2xl float" />

            <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-10 relative z-10">
              <div className="flex-1">
                <span className="inline-flex items-center gap-2 text-xs font-semibold bg-white/15 px-4 py-1.5 rounded-full mb-4">
                  <Sparkles size={14} /> Now Hosting an Event
                </span>
                <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold leading-tight mb-3">
                  {program.title}
                </h2>
                <p className="text-white/85 max-w-xl leading-relaxed mb-5">
                  “{program.theme}” — a hands-on 3-day experience for makeup lovers and beginner
                  artists. Build your skills and your beauty business.
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Link to="/program" className="btn btn-light">
                    Get Full Details <ArrowRight size={18} />
                  </Link>
                  <Link to="/register" className="btn !bg-white/20 !text-white border border-white/30">
                    Register / Tickets <ArrowRight size={18} />
                  </Link>
                </div>
              </div>

              <div className="lg:w-[320px] shrink-0 grid grid-cols-2 gap-3">
                <div className="bg-white/12 rounded-2xl p-4 backdrop-blur-sm card-hover">
                  <CalendarDays size={20} className="mb-2 opacity-90" />
                  <div className="font-semibold text-sm leading-snug">{program.dates}</div>
                  <div className="text-xs opacity-75 mt-1">{program.duration}</div>
                </div>
                <div className="bg-white/12 rounded-2xl p-4 backdrop-blur-sm card-hover">
                  <Clock size={20} className="mb-2 opacity-90" />
                  <div className="font-semibold text-sm leading-snug">{program.time.morning}</div>
                  <div className="text-xs opacity-75 mt-1">Morning / {program.time.evening}</div>
                </div>
                <div className="bg-white/12 rounded-2xl p-4 backdrop-blur-sm col-span-2 flex flex-col items-center text-center card-hover">
                  <MapPin size={20} className="mb-2 opacity-90" />
                  <div className="text-sm leading-snug">Venue disclosed after ticket purchase</div>
                </div>
              </div>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      {/* ===== INSTAGRAM CTA ===== */}
      <section className="section-pad bg-ink text-cream relative overflow-hidden">
        <div className="absolute inset-0">
          <img src="/images/studio1.png" alt="" className="w-full h-full object-cover opacity-15" loading="lazy" />
        </div>
        <Reveal variant="up">
        <div className="container text-center relative">
          <InstagramIcon size={32} className="mx-auto text-rose mb-4" />
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
