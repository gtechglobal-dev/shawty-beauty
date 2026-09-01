import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { lashServices, makeupServices } from '../../lib/constants'

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

const slides: Slide[] = [
  {
    image: '/images/carousel/event.jpg',
    kicker: 'Tickets On Sale',
    title: '3-Days Beginner Makeup Class',
    desc: '4th – 6th February 2027',
    cta: '/register',
    ctaLabel: 'Book Your Slot',
    faint: true,
  },
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
]

export default function EventsCarousel() {
  const [index, setIndex] = useState(0)
  const startX = useRef<number | null>(null)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, 3500)
    return () => clearInterval(id)
  }, [index])

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
      <div className="relative max-w-4xl mx-auto rounded-2xl md:rounded-3xl overflow-hidden shadow-xl group">
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
                  <div className={`absolute inset-0 bg-gradient-to-t ${s.faint ? 'from-black/85 via-black/50 to-black/20' : 'from-black/70 via-black/20 to-transparent'}`} />
                  <div className="absolute left-0 right-0 bottom-0 p-5 md:p-8 text-white">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full mb-2">
                      <SparkleDot /> {s.kicker}
                    </span>
                    <h3 className="font-display text-2xl md:text-4xl font-bold leading-tight">{s.title}</h3>
                    <p className="text-white/85 text-sm md:text-base mt-1 max-w-xl">{s.desc}</p>
                    <a
                      href={s.cta}
                      className="inline-flex items-center gap-2 mt-3 bg-white text-ink text-sm font-semibold px-4 py-2 rounded-full hover:bg-cream transition-colors"
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
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 text-ink flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronLeft size={24} />
          </button>
          <button
            onClick={next}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 text-ink flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <ChevronRight size={24} />
          </button>

          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        </div>
    </div>
  )
}

function SparkleDot() {
  return <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose" />
}