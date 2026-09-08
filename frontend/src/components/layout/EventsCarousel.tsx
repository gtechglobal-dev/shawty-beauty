import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { lashServices, makeupServices, eventRegisterUrl, type StudioEvent } from '../../lib/constants'

const carouselImages: Record<string, string> = {
  'Hybrid Lashes': '/images/carousel/hybrid.jpg',
  'Volume Lashes': '/images/carousel/volume.jpg',
  'Wispy Set / Bottom Lashes': '/images/carousel/wispy.jpg',
  'Soft Glam': '/images/carousel/softglam.jpg',
  'Full Glam': '/images/carousel/fullglam.jpg',
  'Bridal Glam': '/images/carousel/bridal.jpg',
  'Photoshoot Makeup': '/images/carousel/photoshoot.jpg',
}

interface Slide {
  image: string
  kicker: string
  title: string
  desc: string
  cta: string
  ctaLabel: string
  faint?: boolean
}

function buildSlides(live: StudioEvent | null | undefined): Slide[] {
  const slides: Slide[] = []
  if (live?.status === 'live') {
    slides.push({
      image: live.bannerImage || '/images/carousel/event.jpg',
      kicker: 'Tickets On Sale',
      title: live.title,
      desc: live.datesLabel || live.theme || 'Join us for an unforgettable experience',
      cta: eventRegisterUrl(live),
      ctaLabel: 'Get Your Tickets',
      faint: true,
    })
  }
  slides.push(
    ...lashServices
      .filter((s) => s.title !== 'Classic Lashes')
      .map((s) => ({
        image: carouselImages[s.title],
        kicker: 'Lash Tech',
        title: s.title,
        desc: s.desc,
        cta: '/services',
        ctaLabel: 'Explore Services',
      })),
    ...makeupServices.slice(0, 4).map((s) => ({
      image: carouselImages[s.title],
      kicker: 'Makeup',
      title: s.title,
      desc: s.desc,
      cta: '/services',
      ctaLabel: 'Explore Services',
    })),
  )
  return slides
}

export default function EventsCarousel({ live }: { live?: StudioEvent | null }) {
  const [slideKey, setSlideKey] = useState(0)
  const [index, setIndex] = useState(0)
  const startX = useRef<number | null>(null)
  const slides = buildSlides(live ?? null)

  // Reset carousel position when the live event changes
  useEffect(() => {
    setIndex(0)
    setSlideKey((k) => k + 1)
  }, [live?.id])

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, 3500)
    return () => clearInterval(id)
  }, [slides.length, slideKey])

  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length)
  const next = () => setIndex((i) => (i + 1) % slides.length)

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (startX.current === null) return
    const dx = e.changedTouches[0].clientX - startX.current
    if (Math.abs(dx) > 50) {
      if (dx < 0) next()
      else prev()
    }
    startX.current = null
  }

  return (
    <div>
      <div className="relative max-w-3xl mx-auto rounded-2xl md:rounded-3xl overflow-hidden shadow-xl group">
          <div
            className="flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${index * 100}%)`, touchAction: 'pan-y' }}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {slides.map((s, i) => (
              <div key={i} className="w-full shrink-0">
                <div className={`relative h-52 sm:h-72 md:h-80 w-full ${s.faint ? 'bg-gradient-to-br from-rose-dark via-rose to-gold' : ''}`}>
                  <img src={s.image} alt={s.title} className={`absolute inset-0 w-full h-full object-cover ${s.faint ? 'opacity-100' : ''}`} loading="lazy" decoding="async" />
                  <div className={`absolute inset-0 bg-gradient-to-t ${s.faint ? 'from-ink/85 via-ink/50 to-ink/20' : 'from-ink/70 via-ink/20 to-transparent'}`} />
                  <div className="absolute left-0 right-0 bottom-0 p-5 md:p-8 text-white">
<span className="inline-flex items-center gap-2 text-xs font-semibold bg-white/15 border border-white/20 backdrop-blur-sm px-3 py-1 rounded-full mb-2">
  <SparkleDot className={s.faint ? 'bg-green-400' : undefined} /> {s.kicker}
</span>
<h3 className="font-display text-2xl md:text-4xl font-bold leading-tight">{s.title}</h3>
<p className="text-white/85 text-sm md:text-base mt-1 max-w-xl">{s.desc}</p>
<a
  href={s.cta}
  className="inline-flex items-center gap-2 mt-3 bg-[linear-gradient(135deg,#ffffff_0%,#d1d5db_55%,#9ca3af_100%)] text-[#321d24] text-sm font-semibold px-5 py-2 rounded-full shadow-lg hover:bg-[linear-gradient(135deg,#f9fafb_0%,#cbd5e1_55%,#94a3b8_100%)] hover:-translate-y-0.5 transition-all"
>
  {s.ctaLabel} <ChevronRight size={16} />
</a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/45 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/65"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={next}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/45 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/65"
          >
            <ChevronRight size={24} />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        </div>
    </div>
  )
}

function SparkleDot({ className }: { className?: string }) {
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${className ?? 'bg-rose'}`} />
}