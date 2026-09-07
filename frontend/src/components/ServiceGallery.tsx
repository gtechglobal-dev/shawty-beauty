import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import { type Service, siteConfig } from '../lib/constants'
import Modal from './Modal'

export default function ServiceGallery({ services }: { services: Service[] }) {
  const [selected, setSelected] = useState<Service | null>(null)

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {services.map((s) => (
          <button
            key={s.title}
            onClick={() => setSelected(s)}
            className="card card-silk p-4 text-left group flex items-center gap-4 cursor-pointer hover:-translate-y-1 hover:shadow-lg"
          >
            <div className="w-1/4 shrink-0">
              <div className="relative overflow-hidden rounded-xl ring-1 ring-rose/15">
                <img
                  src={s.image}
                  alt={s.title}
                  className="w-full aspect-square object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold leading-snug">{s.title}</h3>
              <p className="text-xs sm:text-sm text-muted mt-1 leading-snug line-clamp-2">{s.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <Modal open={selected !== null} onClose={() => setSelected(null)}>
        {selected && (
          <div>
            <h3 className="font-display text-3xl font-bold mb-5">{selected.title}</h3>
            <div className="flex items-start gap-5 sm:gap-6">
              <div className="w-1/4 shrink-0">
                <div className="relative overflow-hidden rounded-xl ring-1 ring-rose/15">
                  <img
                    src={selected.image}
                    alt={selected.title}
                    className="w-full aspect-square object-cover"
                  />
                </div>
              </div>
              <p className="flex-1 text-ink/70 leading-relaxed">{selected.long}</p>
            </div>
            <a
              href={`${siteConfig.whatsapp}?text=${encodeURIComponent(`Hi! I'd like to book ${selected.title} at Shawty Beauty Studio.`)}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary w-full mt-6"
            >
              <MessageCircle size={18} /> Book Now
            </a>
          </div>
        )}
      </Modal>
    </div>
  )
}