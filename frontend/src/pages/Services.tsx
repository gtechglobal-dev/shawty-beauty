import { Link } from 'react-router-dom'
import { ArrowRight, Brush, Eye, MessageCircle } from 'lucide-react'
import { lashServices, makeupServices, siteConfig } from '../lib/constants'
import ServiceGallery from '../components/ServiceGallery'
import Reveal from '../components/Reveal'

export default function Services() {
  return (
    <div>
      {/* Header */}
      <section className="bg-gradient-to-br from-blush via-cream to-white border-b border-black/5">
        <Reveal variant="up">
          <div className="container py-12 md:py-16 text-center">
            <span className="eyebrow mb-4">Our Services</span>
            <h1 className="section-title text-4xl md:text-5xl mb-4">Beauty, tailored to you</h1>
            <p className="text-ink/70 max-w-2xl mx-auto">
              Handcrafted lash extensions and makeup services designed around your natural beauty —
              from everyday soft glam to unforgettable bridal looks.
            </p>
          </div>
        </Reveal>
      </section>

      {/* Lash services */}
      <section className="section-pad bg-white">
        <div className="container">
          <Reveal variant="left">
            <div className="max-w-2xl mb-10 md:mb-12 text-center md:text-left mx-auto md:mx-0">
              <span className="eyebrow mb-3"><Eye size={14} /> Lash Tech</span>
              <h2 className="section-title mt-2">Lash extensions that flatter your eyes</h2>
              <p className="text-ink/70 mt-3">Handcrafted, comfortable lash sets tailored to your natural eye shape and everyday style.</p>
            </div>
          </Reveal>
          <Reveal variant="zoom">
            <ServiceGallery services={lashServices} />
          </Reveal>
        </div>
      </section>

      {/* Makeup services */}
      <section className="section-pad bg-blush border-y border-rose/15">
        <div className="container">
          <Reveal variant="right">
            <div className="max-w-2xl mb-10 md:mb-12 text-center md:text-left mx-auto md:mx-0">
              <span className="eyebrow mb-3"><Brush size={14} /> Makeup Services</span>
              <h2 className="section-title mt-2">Makeup for every moment</h2>
              <p className="text-ink/70 mt-3">From everyday soft glam to unforgettable bridal glam — and 1-on-1 training to build your own skills.</p>
            </div>
          </Reveal>
          <Reveal variant="zoom" delay={100}>
            <ServiceGallery services={makeupServices} />
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <Reveal variant="zoom">
        <div className="container section-pad text-center">
          <h2 className="section-title mb-4">Ready to book your look?</h2>
          <p className="text-ink/70 max-w-xl mx-auto mb-6">
            Book a session on WhatsApp or chat with us about your dream look — we can't wait to glam you up.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href={siteConfig.whatsapp} target="_blank" rel="noreferrer" className="btn btn-primary">
              <MessageCircle size={18} /> Book Now
            </a>
            <Link to="/contact" className="btn btn-outline">
              Contact Us <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  )
}