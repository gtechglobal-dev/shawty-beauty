import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, MessageCircle } from 'lucide-react'
import { siteConfig } from '../../lib/constants'

const links = [
  { to: '/', label: 'Home' },
  { to: '/#services', label: 'Our Services', hash: true },
  { to: '/program', label: 'Our Events' },
  { to: '/sponsor', label: 'Our Sponsors' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { pathname, hash } = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [pathname, hash])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const headerRef = useRef<HTMLElement | null>(null)

  // Close mobile menu when clicking/tapping anywhere outside the header
  useEffect(() => {
    if (!open) return
    const onDocClick = (e: MouseEvent | TouchEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    document.addEventListener('touchstart', onDocClick)
    return () => {
      document.removeEventListener('click', onDocClick)
      document.removeEventListener('touchstart', onDocClick)
    }
  }, [open])

  const isActive = (to: string, isHashLink?: boolean) => {
    if (isHashLink) {
      // Hash links (homepage sections) are active when their hash matches the URL
      const targetHash = to.split('#')[1]
      return pathname === '/' && targetHash === hash.slice(1)
    }
    // Home: active on homepage only when no section hash is set
    if (to === '/') {
      return pathname === '/' && hash === ''
    }
    return pathname === to
  }

  return (
    <header ref={headerRef} onClick={() => setOpen(false)} className={`sticky top-0 z-50 bg-cream/90 backdrop-blur-md border-b transition-all duration-300 ${scrolled ? 'border-black/10 shadow-md' : 'border-black/5'}`}>
      <div className="container flex items-center justify-between h-16 md:h-[72px] gap-3">
        <Link to="/" className="flex items-center gap-2.5 shrink-0" onClick={() => setOpen(false)}>
          <span className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-rose to-gold flex items-center justify-center text-white font-display text-lg md:text-xl font-bold">
            S
          </span>
          <span className="font-display text-lg md:text-xl font-semibold leading-tight">
            Shawty <span className="gradient-text">Beauty Studio</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) =>
            l.hash ? (
              <a
                key={l.to}
                href={l.to}
                className={`nav-link ${isActive(l.to, true) ? 'nav-active' : ''}`}
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.to}
                to={l.to}
                className={`nav-link ${isActive(l.to) ? 'nav-active' : ''}`}
              >
                {l.label}
              </Link>
            ),
          )}
          <a
            href={siteConfig.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary ml-2 !py-2.5 !px-5"
          >
            <MessageCircle size={16} /> Book a Session
          </a>
        </nav>

        <button
          className="md:hidden p-2 -mr-1 text-ink"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
          aria-label="Toggle menu"
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {open && (
        <nav onClick={(e) => e.stopPropagation()} className="md:hidden relative z-50 px-5 pb-6 pt-2 space-y-1 border-t border-black/5 bg-cream/95 backdrop-blur-md">
          {links.map((l) =>
            l.hash ? (
              <a
                key={l.to}
                href={l.to}
                onClick={() => setOpen(false)}
                className={`block px-4 py-3 rounded-lg text-[15px] font-medium ${
                  isActive(l.to, true) ? 'text-rose-dark bg-blush' : 'text-ink/75'
                }`}
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className={`block px-4 py-3 rounded-lg text-[15px] font-medium ${
                  isActive(l.to) ? 'text-rose-dark bg-blush' : 'text-ink/75'
                }`}
              >
                {l.label}
              </Link>
            ),
          )}
          <a
            href={siteConfig.whatsapp}
            target="_blank"
            rel="noreferrer"
            onClick={() => setOpen(false)}
            className="btn btn-primary w-full mt-3"
          >
            <MessageCircle size={18} /> Book a Session on WhatsApp
          </a>
        </nav>
      )}
    </header>
  )
}
