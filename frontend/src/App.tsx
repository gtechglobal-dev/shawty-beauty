import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import Home from './pages/Home'
import Program from './pages/Program'
import Register from './pages/Register'
import PaymentCallback from './pages/PaymentCallback'
import Sponsor from './pages/Sponsor'
import Contact from './pages/Contact'
import Admin from './pages/Admin'

export default function App() {
  const { pathname } = useLocation()

  const isAdmin = pathname.startsWith('/admin')

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  if (isAdmin) {
    return <Admin />
  }

  return (
    <div className="min-h-screen bg-cream text-ink flex flex-col">
      <Navbar />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
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
