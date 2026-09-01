import { useEffect, useState } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
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

export default function App() {
  const { pathname, hash } = useLocation()

  const isAdmin = pathname.startsWith('/admin')

  const [loading, setLoading] = useState(true)

  // Scroll to top on navigation; if landing with a #hash, the browser scrolls to it
  useEffect(() => {
    if (!hash) window.scrollTo(0, 0)
  }, [pathname, hash])

  // Loader: show on first load and on every navigation; brief but measurable
  // to give an anticipatory feel rather than a flash.
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 1100)
    return () => clearTimeout(t)
  }, [pathname])

  if (isAdmin) {
    return <Admin />
  }

  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col">
      <Loader show={loading} />
      <Navbar />
      <main key={pathname} className="flex-1 page-enter overflow-x-clip">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/services" element={<Services />} />
          <Route path="/program" element={<Program />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/payment-callback" element={<PaymentCallback />} />
          <Route path="/sponsor" element={<Sponsor />} />
          <Route path="/contact" element={<Contact />} />
        </Routes>
      </main>
      <Footer />
    </div>
  )
}
