import { useEffect, useState } from 'react'
import { Routes, Route, useLocation, Link } from 'react-router-dom'
import { BookOpenText } from 'lucide-react'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import Loader from './components/Loader'
import Home from './pages/Home'
import Services from './pages/Services'
import Program from './pages/Program'
import Register from './pages/Register'
import PaymentCallback from './pages/PaymentCallback'
import Sponsor from './pages/Sponsor'
import Contact from './pages/Contact'
import Admin from './pages/Admin'
import Diary from './pages/Diary'
import Attendance from './pages/Attendance'
import { ToastProvider } from './components/Toasts'
import { isLoggedIn, subscribeAuth } from './lib/authState'

// Floating "back to the Diary" pill for the signed-in owner so they can jump
// straight back to management from anywhere on the public site.
function DiaryFab() {
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())

  useEffect(() => subscribeAuth(() => setLoggedIn(isLoggedIn())), [])

  if (!loggedIn) return null
  return (
    <Link
      to="/diary"
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-br from-rose to-rose-deep px-4 py-3 rounded-full shadow-[0_14px_30px_-12px_rgba(145,78,108,0.7)] hover:scale-[1.03] active:scale-95 transition-transform"
      title="Open Shawty's Diary"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
      <BookOpenText size={15} /> Diary
    </Link>
  )
}

export default function App() {
  const { pathname, hash } = useLocation()

  const isAdmin = pathname.startsWith('/admin')
  const isDiary = pathname.startsWith('/diary')
  // Attendance check-in is deliberately standalone: no nav/footer, no Diary
  // shortcut, no links back to the main site — mark present, then close.
  const isAttendance = pathname.startsWith('/attendance')

  const [loading, setLoading] = useState(true)
  const [fading, setFading] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)

  // Scroll to top on navigation; if landing with a #hash, the browser scrolls to it
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  // Loader: show on first load (longer) and on navigation (shorter);
  // fade out smoothly before revealing the page.
  useEffect(() => {
    setLoading(true)
    setFading(false)
    const holdMs = initialLoad ? 1200 : 650
    const t = setTimeout(() => {
      setLoading(false)
      setFading(true)
      if (initialLoad) setInitialLoad(false)
    }, holdMs)
    return () => clearTimeout(t)
  }, [pathname])

  const handleFadeEnd = () => {
    setFading(false)
    setLoading(false)
  }

  if (isAdmin) {
    return (
      <ToastProvider>
        <Admin />
      </ToastProvider>
    )
  }

  // The Diary is fully standalone — the owner's private area, rendered
  // without the public site's chrome (no navbar/footer/loader).
  if (isDiary) {
    return (
      <ToastProvider>
        <Diary />
      </ToastProvider>
    )
  }

  // The attendance check-in page is a standalone, single-purpose screen: the
  // holder marks themselves present and closes the tab — no public chrome or
  // navigation out to the main site or the Diary.
  if (isAttendance) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-cream text-ink">
          <main className="page-enter">
            <Attendance />
          </main>
        </div>
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-cream text-ink flex flex-col">
        <Loader show={loading} fading={fading} onFadeEnd={handleFadeEnd} />
        <Navbar />
        <DiaryFab />
        <main key={pathname} className="flex-1 page-enter overflow-x-clip">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/services" element={<Services />} />
            <Route path="/program" element={<Program />} />
            <Route path="/register" element={<Register />} />
            <Route path="/register/payment-callback" element={<PaymentCallback />} />
            <Route path="/sponsor" element={<Sponsor />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/attendance" element={<Attendance />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </ToastProvider>
  )
}
