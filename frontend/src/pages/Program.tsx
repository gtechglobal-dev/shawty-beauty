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
} from 'lucide-react'
import { formatNgn, program, tickets } from '../lib/constants'

export default function Program() {
  return (
    <div>
      {/* Header */}
      <section className="bg-gradient-to-br from-blush via-cream to-white">
        <div className="container py-12 md:py-20 text-center">
          <span className="eyebrow mb-4">Hosted by Shawty Beauty Studio</span>
          <h1 className="section-title text-4xl md:text-5xl mb-4">{program.title}</h1>
          <p className="font-display italic text-xl text-ink/70 mb-10">“{program.theme}”</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <div className="flex items-center gap-3 card px-5 py-4">
              <CalendarDays className="text-rose shrink-0" />
              <div className="text-left">
                <div className="text-sm font-semibold">{program.dates}</div>
                <div className="text-xs text-muted">February 2027</div>
              </div>
            </div>
            <div className="flex items-center gap-3 card px-5 py-4">
              <Clock className="text-rose shrink-0" />
              <div className="text-left">
                <div className="text-sm font-semibold">{program.time.morning} / {program.time.evening}</div>
                <div className="text-xs text-muted">Morning & Evening sections</div>
              </div>
            </div>
            <div className="flex items-center gap-3 card px-5 py-4">
              <MapPin className="text-rose shrink-0" />
              <div className="text-left">
                <div className="text-sm font-semibold">Venue TBA</div>
                <div className="text-xs text-muted">Disclosed after purchase</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container section-pad space-y-14 md:space-y-20">
        {/* Who it's for */}
        <section>
          <span className="eyebrow">Who it's for</span>
          <h2 className="section-title mt-3 mb-6">Made for you</h2>
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            {program.whoFor.map((w) => (
              <span key={w} className="tag-chip !text-sm !py-2">{w}</span>
            ))}
          </div>
        </section>

        {/* What you'll learn */}
        <section>
          <span className="eyebrow">Curriculum</span>
          <h2 className="section-title mt-3 mb-2">What participants will learn</h2>
          <p className="text-ink/70 mb-8 max-w-2xl">{program.plus}</p>
          <div className="grid md:grid-cols-2 gap-4">
            {program.learn.map((item) => (
              <div key={item} className="card p-6 flex items-start gap-3">
                <CircleCheck className="text-rose shrink-0 mt-0.5" size={22} />
                <span className="text-ink/80">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Difference */}
        <section className="grid md:grid-cols-2 gap-10 items-start">
          <div className="card p-8">
            <div className="w-12 h-12 rounded-xl bg-blush flex items-center justify-center mb-4">
              <Lightbulb className="text-rose-dark" size={22} />
            </div>
            <h3 className="section-title text-2xl mb-3">What makes this program different</h3>
            <p className="text-ink/75">
              This isn’t just about teaching people how to apply makeup. Participants will also be
              introduced to the business and mindset side of the beauty industry — understanding the
              difference between simply being a makeup artist and building yourself into a{' '}
              <strong className="text-rose-dark">Beauty CEO</strong>.
            </p>
          </div>

          <div className="card p-8">
            <div className="w-12 h-12 rounded-xl bg-blush flex items-center justify-center mb-4">
              <Package className="text-rose-dark" size={22} />
            </div>
            <h3 className="section-title text-2xl mb-3">What to come with</h3>
            <p className="text-ink/75">
              Participants should come with their own personal makeup products and tools.
            </p>
          </div>
        </section>

        {/* Ticket options */}
        <section>
          <span className="eyebrow">Registration / Tickets</span>
          <h2 className="section-title mt-3 mb-2">Choose your ticket</h2>
          <p className="text-ink/70 mb-10">The exact date and details will be communicated. Venue is disclosed to registered students after ticket purchase.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {tickets.map((t) => (
              <div key={t.id} className={`card p-6 flex flex-col ${t.highlighted ? 'ring-2 ring-rose' : ''}`}>
                <span className="text-sm font-semibold text-rose-dark">{t.label}</span>
                <div className="mt-2 mb-4">
                  <span className="font-display text-4xl font-bold">{formatNgn(t.price)}</span>
                  <span className="text-sm text-muted ml-1">/ {t.unitName}</span>
                </div>
                <ul className="space-y-2 text-sm text-ink/75 mb-6">
                  {t.includes.map((inc) => (
                    <li key={inc} className="flex items-start gap-2">
                      <CircleCheck className="text-rose shrink-0 mt-0.5" size={16} />
                      {inc}
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="btn btn-primary mt-auto w-full">
                  Get {t.label}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <Sparkles className="mx-auto text-rose mb-4" size={30} />
          <h2 className="section-title mb-4">Ready to begin your beauty journey?</h2>
          <Link to="/register" className="btn btn-primary">
            Register Now <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  )
}
