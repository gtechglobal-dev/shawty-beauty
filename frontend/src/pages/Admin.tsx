import { useEffect, useState } from 'react'
import {
  LoaderCircle, LogOut, LayoutDashboard, Users, Handshake,
  MessageSquare, Ticket, Crown, TrendingUp, CircleAlert,
} from 'lucide-react'
import { getJson, patchJson } from '../lib/api'
import { formatNgn, tickets } from '../lib/constants'

interface Registration {
  id: string
  fullName: string
  phone: string
  email: string
  instagram: string
  dateOfBirth?: string
  state?: string
  nationality?: string
  address?: string
  experienceLevel: string
  emergencyContact: string
  ticketType: string
  quantity: number
  amount: number
  status: string
  reason: string
  hearAbout: string
  createdAt: string
}

interface Sponsor {
  id: string
  brandName: string
  contactName: string
  email: string
  phone: string
  packageType: string
  amount: number
  notes: string
  status: string
  featured: boolean
  createdAt: string
}

interface ContactMsg {
  id: string
  name: string
  email: string
  subject: string
  message: string
  read: boolean
  createdAt: string
}

const SPONSOR_LABELS: Record<string, string> = {
  supporter: 'Supporter', partner: 'Partner', featured: 'Featured', title: 'Title/Major',
  product: 'Product', service: 'Service', custom: 'Custom',
}

const TICKET_LABELS: Record<string, string> = {
  student: 'Student', gold: 'Gold',
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    paid: 'bg-green-100 text-green-700',
    approved: 'bg-green-100 text-green-700',
    confirmed: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-600',
  }
  return `px-2.5 py-1 rounded-full text-xs font-semibold ${map[status] || 'bg-black/5 text-ink/60'}`
}

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem('sbs_admin_token') || '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  const [tab, setTab] = useState<'stats' | 'registrations' | 'sponsors' | 'contacts'>('stats')
  const [stats, setStats] = useState<any>(null)
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [sponsors, setSponsors] = useState<Sponsor[]>([])
  const [contacts, setContacts] = useState<ContactMsg[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (token) refresh('stats')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function refresh(which = tab) {
    setLoading(true)
    setError('')
    const headers = { Authorization: `Bearer ${token}` }
    try {
      if (which === 'stats' || which === 'registrations' || which === 'sponsors' || which === 'contacts') {
        const s = await getJson('/api/admin/stats', headers)
        setStats(s)
      }
      if (which === 'registrations' || tab === 'registrations') {
        const r = await getJson('/api/admin/registrations', headers)
        setRegistrations(r.registrations || [])
      }
      if (which === 'sponsors' || tab === 'sponsors') {
        const sp = await getJson('/api/admin/sponsors', headers)
        setSponsors(sp.sponsors || [])
      }
      if (which === 'contacts' || tab === 'contacts') {
        const c = await getJson('/api/admin/contacts', headers)
        setContacts(c.contacts || [])
      }
    } catch (err: any) {
      setError(err.message)
      if (err.message.includes('Unauthorized') || err.message.includes('Invalid')) {
        setToken('')
        localStorage.removeItem('sbs_admin_token')
      }
    } finally {
      setLoading(false)
    }
  }

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')
    try {
      const data = await getJsonThis('/api/auth/login', { username, password })
      setToken(data.token)
      localStorage.setItem('sbs_admin_token', data.token)
    } catch (err: any) {
      setLoginError(err.message)
    } finally {
      setLoginLoading(false)
    }
  }

  async function setRegStatus(id: string, status: string) {
    try {
      await patchJson(`/api/admin/registrations/${id}`, { status }, { Authorization: `Bearer ${token}` })
      refresh('registrations')
    } catch (err: any) { setError(err.message) }
  }

  async function setSponsorStatus(id: string, status: string) {
    try {
      await patchJson(`/api/admin/sponsors/${id}`, { status }, { Authorization: `Bearer ${token}` })
      refresh('sponsors')
    } catch (err: any) { setError(err.message) }
  }

  async function toggleFeatured(id: string, featured: boolean) {
    try {
      await patchJson(`/api/admin/sponsors/${id}`, { featured }, { Authorization: `Bearer ${token}` })
      refresh('sponsors')
    } catch (err: any) { setError(err.message) }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <form onSubmit={login} className="card p-10 w-full max-w-sm mx-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-rose to-gold flex items-center justify-center text-white font-display font-bold">S</span>
            <h1 className="font-display text-xl font-bold">Admin Login</h1>
          </div>
          <p className="text-sm text-muted mb-6">Shawty Beauty Studio · Dashboard</p>
          {loginError && <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{loginError}</div>}
          <div className="space-y-4">
            <input className="input-field" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required />
            <input type="password" className="input-field" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button className="btn btn-primary w-full" disabled={loginLoading}>
              {loginLoading ? <LoaderCircle size={18} className="animate-spin" /> : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-ink text-cream">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-gradient-to-br from-rose to-gold flex items-center justify-center font-display font-bold">S</span>
            <span className="font-display text-lg font-semibold">Shawty Beauty Studio Admin</span>
          </div>
          <button
            onClick={() => { setToken(''); localStorage.removeItem('sbs_admin_token') }}
            className="flex items-center gap-2 text-sm text-muted hover:text-white"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </header>

      <div className="container py-8">
        <div className="flex flex-wrap gap-2 mb-8">
          {([
            ['stats', 'Overview', LayoutDashboard],
            ['registrations', 'Registrations', Users],
            ['sponsors', 'Sponsors', Handshake],
            ['contacts', 'Messages', MessageSquare],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => { setTab(id); refresh(id) }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-colors ${
                tab === id ? 'bg-rose text-white' : 'bg-white text-ink/70 hover:bg-black/5'
              }`}>
              <Icon size={16} /> {label}
            </button>
          ))}
        </div>

        {error && <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2"><CircleAlert size={20} className="shrink-0" />{error}</div>}
        {loading && <div className="flex items-center gap-2 text-muted mb-6"><LoaderCircle size={18} className="animate-spin" /> Loading…</div>}

        {tab === 'stats' && stats && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard icon={Users} label="Total Registrations" value={stats.totalRegistrations} />
              <StatCard icon={Ticket} label="Paid Tickets" value={stats.paidRegistrations} />
              <StatCard icon={Crown} label="Confirmed Sponsors" value={stats.confirmedSponsors} />
              <StatCard icon={TrendingUp} label="Estimated Revenue" value={formatNgn(stats.revenue)} />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="card p-6">
                <h3 className="font-semibold mb-3">Registrations</h3>
                <div className="space-y-1 text-sm text-muted">
                  <Row label="Pending" value={stats.pendingRegistrations} />
                  <Row label="Paid" value={stats.paidRegistrations} />
                  <Row label="Approved" value={stats.approvedRegistrations} />
                </div>
              </div>
              <div className="card p-6">
                <h3 className="font-semibold mb-3">Sponsors</h3>
                <div className="space-y-1 text-sm text-muted">
                  <Row label="Total" value={stats.totalSponsors} />
                  <Row label="Pending" value={stats.pendingSponsors} />
                  <Row label="Confirmed" value={stats.confirmedSponsors} />
                </div>
              </div>
              <div className="card p-6">
                <h3 className="font-semibold mb-3">Inbox & Subscribers</h3>
                <div className="space-y-1 text-sm text-muted">
                  <Row label="Messages" value={stats.totalMessages} />
                  <Row label="Unread" value={stats.unreadMessages} />
                  <Row label="Newsletter" value={stats.totalSubscribers} />
                </div>
              </div>
            </div>

            {stats.recentRegistrations?.length > 0 && (
              <div className="card mt-8 overflow-hidden">
                <div className="p-6 pb-0 font-semibold">Recent Registrations</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm mt-4">
                    <thead>
                      <tr className="text-left text-muted text-xs border-b border-black/8">
                        <th className="px-6 py-2">Name</th>
                        <th className="px-6 py-2">Ticket</th>
                        <th className="px-6 py-2">Amount</th>
                        <th className="px-6 py-2">Status</th>
                        <th className="px-6 py-2">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.recentRegistrations.map((r: Registration) => (
                        <tr key={r.id} className="border-b border-black/5">
                          <td className="px-6 py-3">{r.fullName}</td>
                          <td className="px-6 py-3">{TICKET_LABELS[r.ticketType] || r.ticketType}</td>
                          <td className="px-6 py-3">{formatNgn(r.amount)}</td>
                          <td className="px-6 py-3"><span className={statusBadge(r.status)}>{r.status}</span></td>
                          <td className="px-6 py-3 text-muted">{new Date(r.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'registrations' && (
          <div className="card overflow-hidden">
            <div className="p-6 flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-semibold">Student Registrations ({registrations.length})</h3>
              <button onClick={() => refresh('registrations')} className="btn btn-outline !py-2">Refresh</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted text-xs border-b border-black/8">
                    <th className="px-6 py-2">Student</th>
                    <th className="px-6 py-2">Contact</th>
                    <th className="px-6 py-2">Ticket</th>
                    <th className="px-6 py-2">Amount</th>
                    <th className="px-6 py-2">Status</th>
                    <th className="px-6 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((r) => (
                    <tr key={r.id} className="border-b border-black/5 align-top">
                      <td className="px-6 py-3">
                        <div className="font-medium">{r.fullName}</div>
                        <div className="text-xs text-muted">@{r.instagram || '—'} · {r.experienceLevel || '—'}</div>
                      </td>
                      <td className="px-6 py-3">
                        <div className="text-xs">{r.email}</div>
                        <div className="text-xs text-muted">{r.phone}</div>
                        <div className="text-xs text-muted">
                          {[r.nationality, r.state].filter(Boolean).join(' · ') || '—'}
                        </div>
                        {r.address && <div className="text-xs text-muted">📍 {r.address}</div>}
                      </td>
                      <td className="px-6 py-3">
                        <div>{TICKET_LABELS[r.ticketType] || r.ticketType} × {r.quantity}</div>
                        <div className="text-xs text-muted">{r.reason?.slice(0, 50)}</div>
                      </td>
                      <td className="px-6 py-3">{formatNgn(r.amount)}</td>
                      <td className="px-6 py-3"><span className={statusBadge(r.status)}>{r.status}</span></td>
                      <td className="px-6 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {r.status === 'pending' && (
                            <button onClick={() => setRegStatus(r.id, 'paid')} className="px-2.5 py-1 rounded-lg text-xs bg-green-600 text-white hover:bg-green-700">Mark Paid</button>
                          )}
                          {r.status === 'paid' && (
                            <button onClick={() => setRegStatus(r.id, 'approved')} className="px-2.5 py-1 rounded-lg text-xs bg-rose-dark text-white hover:opacity-90">Approve</button>
                          )}
                          {r.status !== 'cancelled' && (
                            <button onClick={() => setRegStatus(r.id, 'cancelled')} className="px-2.5 py-1 rounded-lg text-xs bg-black/10 hover:bg-black/20">Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {registrations.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-10 text-center text-muted">No registrations yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'sponsors' && (
          <div className="card overflow-hidden">
            <div className="p-6 flex items-center justify-between flex-wrap gap-3">
              <h3 className="font-semibold">Sponsors ({sponsors.length})</h3>
              <button onClick={() => refresh('sponsors')} className="btn btn-outline !py-2">Refresh</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted text-xs border-b border-black/8">
                    <th className="px-6 py-2">Brand</th>
                    <th className="px-6 py-2">Contact</th>
                    <th className="px-6 py-2">Package</th>
                    <th className="px-6 py-2">Amount</th>
                    <th className="px-6 py-2">Status</th>
                    <th className="px-6 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sponsors.map((s) => (
                    <tr key={s.id} className="border-b border-black/5 align-top">
                      <td className="px-6 py-3">
                        <div className="font-medium">{s.brandName}</div>
                        {s.featured && <div className="text-xs text-gold font-semibold flex items-center gap-1"><Crown size={12} /> Featured</div>}
                      </td>
                      <td className="px-6 py-3">
                        <div className="text-xs">{s.contactName}</div>
                        <div className="text-xs text-muted">{s.email} · {s.phone}</div>
                      </td>
                      <td className="px-6 py-3">{SPONSOR_LABELS[s.packageType] || s.packageType}</td>
                      <td className="px-6 py-3">{s.amount > 0 ? formatNgn(s.amount) : 'In-kind'}</td>
                      <td className="px-6 py-3"><span className={statusBadge(s.status)}>{s.status}</span></td>
                      <td className="px-6 py-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {s.status === 'pending' && (
                            <button onClick={() => setSponsorStatus(s.id, 'confirmed')} className="px-2.5 py-1 rounded-lg text-xs bg-green-600 text-white hover:bg-green-700">Confirm</button>
                          )}
                          <button onClick={() => toggleFeatured(s.id, !s.featured)} className="px-2.5 py-1 rounded-lg text-xs bg-gold text-ink hover:opacity-90">{s.featured ? 'Unfeature' : 'Feature'}</button>
                          {s.status !== 'cancelled' && (
                            <button onClick={() => setSponsorStatus(s.id, 'cancelled')} className="px-2.5 py-1 rounded-lg text-xs bg-black/10 hover:bg-black/20">Cancel</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sponsors.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-10 text-center text-muted">No sponsors yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'contacts' && (
          <div className="space-y-4">
            {contacts.map((c) => (
              <div key={c.id} className="card p-6">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="font-medium">{c.name} <span className="text-muted text-xs">· {c.email}</span></div>
                    <div className="text-sm text-rose-dark font-medium mt-0.5">{c.subject}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!c.read && <span className="tag-chip">Unread</span>}
                    <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-sm text-ink/75 mt-3 whitespace-pre-wrap">{c.message}</p>
              </div>
            ))}
            {contacts.length === 0 && <div className="card p-10 text-center text-muted">No messages yet.</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ icon: Icon, label, value }: any) {
  return (
    <div className="card p-6">
      <div className="w-10 h-10 rounded-xl bg-blush flex items-center justify-center mb-3"><Icon className="text-rose-dark" size={20} /></div>
      <div className="font-display text-2xl font-bold">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  )
}

function Row({ label, value }: any) {
  return <div className="flex justify-between"><span>{label}</span><span className="font-semibold text-ink">{value}</span></div>
}

async function getJsonThis(url: string, body: any) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Login failed')
  return data
}
