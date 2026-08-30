import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { galleryImages, program } from '../../lib/constants'

const slides = [
  {
    image: '/images/makeup1.jpg',
    kicker: 'Now Hosting an Event',
    title: program.title,
    desc: program.theme,
    cta: '/program',
    ctaLabel: 'Get Full Details',
  },
  ...galleryImages.map((image) => ({
    image,
    kicker: 'Shawty Beauty Studio',
    title: 'Signature looks',
    desc: 'Handcrafted makeup & lashes, tailored to you.',
    cta: '#services',
    ctaLabel: 'Explore Services',
  })),
]

export default function EventsCarousel() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length)
    }, 3500)
    return () => clearInterval(id)
  }, [])

  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length)
  const next = () => setIndex((i) => (i + 1) % slides.length)

  return (
    <div>
      <div className="relative max-w-4xl mx-auto rounded-2xl md:rounded-3xl overflow-hidden shadow-xl">
          <div
            className="flex transition-transform duration-700 ease-out"
            style={{ transform: `translateX(-${index * 100}%)` }}
          >
            {slides.map((s, i) => (
              <div key={i} className="w-full shrink-0">
                <div className="relative h-52 sm:h-72 md:h-80 w-full">
                  <img src={s.image} alt={s.title} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
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
            aria-label="Previous ad"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 text-ink flex items-center justify-center shadow hover:bg-white"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            onClick={next}
            aria-label="Next ad"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/85 text-ink flex items-center justify-center shadow hover:bg-white"
          >
            <ChevronRight size={22} />
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
