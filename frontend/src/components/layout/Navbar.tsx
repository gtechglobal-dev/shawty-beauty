import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, BookOpenText } from 'lucide-react'
import { siteConfig } from '../../lib/constants'
import { isLoggedIn, subscribeAuth } from '../../lib/authState'

const links = [
  { to: '/', label: 'Home' },
  { to: '/services', label: 'Our Services' },
  { to: '/program', label: 'Our Events' },
  { to: '/sponsor', label: 'Our Sponsors' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())
  const { pathname, hash } = useLocation()

  useEffect(() => subscribeAuth(() => setLoggedIn(isLoggedIn())), [])

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

  const isActive = (to: string) => {
    // Home: active on homepage only when no section hash is set
    if (to === '/') {
      return pathname === '/' && hash === ''
    }
    return pathname === to
  }

  return (
    <header
      ref={headerRef}
      onClick={() => setOpen(false)}
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled || open
          ? 'bg-cream/85 backdrop-blur-xl border-b border-pinkgold/20 shadow-[0_8px_30px_-14px_rgba(122,48,69,0.28)]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="container flex items-center justify-between h-16 md:h-[72px] gap-3">
        <Link to="/" className="flex items-center gap-3 shrink-0 group" onClick={() => setOpen(false)}>
          {/* Signature double-ring monogram */}
          <span className="relative w-10 h-10 md:w-11 md:h-11">
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-rose via-pinkgold to-gold opacity-25 blur-[6px] group-hover:opacity-40 transition-opacity" />
            <span className="relative w-full h-full rounded-full bg-gradient-to-br from-rose to-rose-deep flex items-center justify-center text-white font-display text-lg md:text-xl font-bold shadow-[0_6px_16px_-6px_rgba(145,78,108,0.55)]">
              {siteConfig.name.charAt(0)}
            </span>
            <span className="absolute -inset-1 rounded-full border border-pinkgold/50" />
          </span>
          <span className="leading-tight">
            <span className="font-display text-lg md:text-xl font-semibold block">
              Shawty <span className="gradient-text">Beauty Studio</span>
            </span>
            <span className="hidden md:block text-[10px] tracking-[0.28em] uppercase text-faint mt-0.5">
              Makeup · Lashes · Beauty
            </span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`nav-link ${isActive(l.to) ? 'nav-active' : ''}`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/diary"
            className={`nav-link flex items-center gap-1.5 ml-2 ${isActive('/diary') ? 'nav-active' : ''} ${loggedIn ? 'diary-pill' : ''}`}
          >
            <BookOpenText size={14} />
            <span>{loggedIn ? 'My Diary' : "Shawty's Diary"}</span>
            {loggedIn && <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />}
          </Link>
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
        <nav onClick={(e) => e.stopPropagation()} className="md:hidden relative z-50 px-5 pb-6 pt-2 space-y-1 border-t border-[#321d24]/10 bg-cream/95 backdrop-blur-md">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setOpen(false)}
              className={`block px-4 py-3 rounded-lg text-[15px] font-medium ${
                isActive(l.to) ? 'text-[#7a3045] bg-blush' : 'text-ink/75'
              }`}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/diary"
            onClick={() => setOpen(false)}
            className={`mt-1 flex items-center justify-between px-4 py-3 rounded-lg text-[15px] font-semibold ${
              isActive('/diary')
                ? 'text-rose-deep bg-blush'
                : loggedIn
                  ? 'text-white bg-gradient-to-br from-rose to-rose-deep shadow-[0_10px_22px_-12px_rgba(145,78,108,0.8)]'
                  : 'text-ink/75'
            }`}
          >
            <span className="flex items-center gap-2">
              <BookOpenText size={17} />
              {loggedIn ? 'My Diary' : "Shawty's Diary"}
            </span>
            {loggedIn && <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-90"><span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" /> Owner</span>}
          </Link>
        </nav>
      )}
    </header>
  )
}