import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, MessageCircle } from 'lucide-react'
import InstagramIcon from '../icons/InstagramIcon'
import { siteConfig } from '../../lib/constants'

export default function Footer() {
  return (
    <footer className="bg-ink text-cream mt-20">
      <div className="container section-pad grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-10 text-center sm:text-left">
        <div className="sm:col-span-2">
          <div className="flex items-center justify-center sm:justify-start gap-2.5 mb-4">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-rose to-gold flex items-center justify-center text-white font-display text-lg font-bold">
              S
            </span>
            <span className="font-display text-xl font-semibold">Shawty Beauty Studio</span>
          </div>
          <p className="text-muted text-sm max-w-md leading-relaxed mx-auto sm:mx-0">
            {siteConfig.owner}. {siteConfig.tagline}. From soft glam and bridal makeup to
            classic and volume lashes, we help you look and feel your best.
          </p>
          <a
            href={siteConfig.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary mt-5 !py-2.5 !px-5"
          >
            <MessageCircle size={16} /> Book on WhatsApp
          </a>
        </div>

        <div>
          <h4 className="font-semibold mb-4 text-sm tracking-wide">Quick Links</h4>
          <ul className="space-y-2.5 text-sm text-muted">
            <li><Link to="/" className="hover:text-white">Home</Link></li>
            <li><Link to="/services" className="hover:text-white">Our Services</Link></li>
            <li><Link to="/program" className="hover:text-white">Our Events</Link></li>
            <li><Link to="/sponsor" className="hover:text-white">Our Sponsors</Link></li>
            <li><Link to="/contact" className="hover:text-white">Contact</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-4 text-sm tracking-wide">Get in Touch</h4>
          <ul className="space-y-3 text-sm text-muted">
            <li className="flex items-center sm:items-start justify-center sm:justify-start gap-2.5">
              <InstagramIcon size={16} className="text-rose mt-0.5 shrink-0" />
              <a href={siteConfig.instagram} target="_blank" rel="noreferrer" className="hover:text-white">
                {siteConfig.instagramHandle}
              </a>
            </li>
            <li className="flex items-center sm:items-start justify-center sm:justify-start gap-2.5">
              <Mail size={16} className="text-rose mt-0.5 shrink-0" />
              <a href={`mailto:${siteConfig.email}`} className="hover:text-white break-all">{siteConfig.email}</a>
            </li>
            <li className="flex items-center sm:items-start justify-center sm:justify-start gap-2.5">
              <Phone size={16} className="text-rose mt-0.5 shrink-0" />
              <a href={`tel:${siteConfig.phoneRaw}`} className="hover:text-white">{siteConfig.phone}</a>
            </li>
            <li className="flex items-center sm:items-start justify-center sm:justify-start gap-2.5">
              <MapPin size={16} className="text-rose mt-0.5 shrink-0" />
              <span>Nigeria</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="container pt-6 pb-10 text-center text-xs text-muted">
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
