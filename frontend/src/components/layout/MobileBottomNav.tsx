import { Link, useLocation } from 'react-router-dom'
import { House, Sparkles, CalendarDays, Handshake, MessageCircle, BookOpenText } from 'lucide-react'
import { isLoggedIn } from '../../lib/authState'

const links = [
  { to: '/', label: 'Home', icon: House },
  { to: '/services', label: 'Services', icon: Sparkles },
  { to: '/program', label: 'Events', icon: CalendarDays },
  { to: '/sponsor', label: 'Sponsors', icon: Handshake },
  { to: '/contact', label: 'Contact', icon: MessageCircle },
]

// Slim, always-visible bottom navigation for phones: an icon with its label
// tucked just underneath. Desktop keeps the normal top navbar.
export default function MobileBottomNav() {
  const { pathname } = useLocation()
  const loggedIn = isLoggedIn()

  const active = (to: string) => (to === '/' ? pathname === '/' : pathname === to)

  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 backdrop-blur-xl bg-ink/95 border-t border-white/10 px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]">
      <div className="flex items-stretch justify-around gap-1">
        {links.map((l) => {
          const Icon = l.icon
          const on = active(l.to)
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1 rounded-xl ${
                on ? 'text-pinkgold' : 'text-white/45 hover:text-white/80'
              }`}
            >
              <Icon size={18} strokeWidth={on ? 2.4 : 2} />
              <span className={`text-[9px] leading-none font-semibold tracking-wide ${on ? 'text-white' : 'text-white/50'}`}>{l.label}</span>
            </Link>
          )
        })}
        <Link
          to="/diary"
          className={`flex flex-col items-center justify-center gap-1 flex-1 min-w-0 py-1 rounded-xl ${
            active('/diary') ? 'text-pinkgold' : 'text-white/45 hover:text-white/80'
          }`}
        >
          <span className="relative">
            <BookOpenText size={18} strokeWidth={active('/diary') ? 2.4 : 2} />
            {loggedIn && <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </span>
          <span className={`text-[9px] leading-none font-semibold tracking-wide ${active('/diary') ? 'text-white' : 'text-white/50'}`}>
            Diary
          </span>
        </Link>
      </div>
    </nav>
  )
}