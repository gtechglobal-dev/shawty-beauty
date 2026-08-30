import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, X, MessageCircle } from 'lucide-react'
import { siteConfig } from '../../lib/constants'

const links = [
  { to: '/', label: 'Home' },
  { to: '/#services', label: 'Services', hash: true },
  { to: '/program', label: 'The Program' },
  { to: '/sponsor', label: 'Sponsor' },
  { to: '/contact', label: 'Contact' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  const isActive = (to: string, hash?: boolean) => {
    if (hash) return false
    return pathname === to
  }

  return (
    <header className="sticky top-0 z-50 bg-cream/90 backdrop-blur-md border-b border-black/5">
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
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  'text-ink/70 hover:text-rose-dark hover:bg-black/5'
                }`}
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.to}
                to={l.to}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive(l.to)
                    ? 'text-rose-dark bg-blush'
                    : 'text-ink/70 hover:text-rose-dark hover:bg-black/5'
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
            className="btn btn-primary ml-2 !py-2.5 !px-5"
          >
            <MessageCircle size={16} /> Book a Session
          </a>
        </nav>

        <button
          className="md:hidden p-2 -mr-1 text-ink"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {open && (
        <nav className="md:hidden px-5 pb-6 pt-2 space-y-1 border-t border-black/5 bg-cream/95 backdrop-blur-md">
          {links.map((l) =>
            l.hash ? (
              <a
                key={l.to}
                href={l.to}
                onClick={() => setOpen(false)}
                className={`block px-4 py-3 rounded-lg text-[15px] font-medium text-ink/75`}
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
