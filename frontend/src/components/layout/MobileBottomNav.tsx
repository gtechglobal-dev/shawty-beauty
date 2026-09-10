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
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-pinkgold/25 bg-cream/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch justify-around">
        {links.map((l) => {
          const Icon = l.icon
          const on = active(l.to)
          return (
            <Link
              key={l.to}
              to={l.to}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 pt-1.5 pb-1 ${
                on ? 'text-rose-deep' : 'text-faint hover:text-rose-dark'
              }`}
            >
              <Icon size={17} strokeWidth={on ? 2.4 : 2} />
              <span className={`text-[8.5px] leading-none font-semibold tracking-wide ${on ? '' : 'text-ink/55'}`}>{l.label}</span>
            </Link>
          )
        })}
        <Link
          to="/diary"
          className={`flex flex-col items-center justify-center gap-0.5 flex-1 min-w-0 pt-1.5 pb-1 ${
            active('/diary') ? 'text-rose-deep' : 'text-faint hover:text-rose-dark'
          }`}
        >
          <span className="relative">
            <BookOpenText size={17} strokeWidth={active('/diary') ? 2.4 : 2} />
            {loggedIn && <span className="absolute -top-0.5 -right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          </span>
          <span className={`text-[8.5px] leading-none font-semibold tracking-wide ${active('/diary') ? '' : 'text-ink/55'}`}>
            {loggedIn ? 'Diary' : "Shawty's"}
          </span>
        </Link>
      </div>
    </nav>
  )
}