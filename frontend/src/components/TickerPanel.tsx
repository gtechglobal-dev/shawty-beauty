import { useEffect, useRef, useState } from 'react'
import { ScrollText, Save, Eye, Palette, Sparkles, LoaderCircle } from 'lucide-react'
import { getJson, putJson } from '../lib/api'
import { useToast } from './Toasts'

// Admin panel for the homepage scrolling ticker. Self-loads its current
// values (GET /api/admin/settings) and saves via PUT — used from both the
// Diary and the legacy admin page.
export default function TickerPanel({ token }: { token: string }) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [enabled, setEnabled] = useState(true)
  const [content, setContent] = useState('')
  const [bgColor, setBgColor] = useState('#5f2436')
  const [textColor, setTextColor] = useState('#fdf0f2')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const s = await getJson('/api/admin/settings', { Authorization: `Bearer ${token}` })
      setEnabled(typeof s.ticker?.enabled === 'boolean' ? s.ticker.enabled : true)
      setContent((s.ticker?.messages || []).join('\n'))
      setBgColor(s.ticker?.bgColor || '#5f2436')
      setTextColor(s.ticker?.textColor || '#fdf0f2')
      setSaving(false)
    } catch (err: any) {
      toast.push(err.message || 'Failed to load settings', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token])

  const save = async (opts?: { enabled?: boolean }) => {
    setSaving(true)
    try {
      const targetEnabled = opts?.enabled !== undefined ? opts.enabled : enabled
      const messages = content.split('\n').map((m) => m.trim()).filter(Boolean)
      const headers = { Authorization: `Bearer ${token}` }
      const saved = await putJson<{ settings?: { ticker?: { enabled: boolean } } }>(
        '/api/admin/settings',
        { ticker: { enabled: targetEnabled, messages, bgColor, textColor } },
        headers,
      )
      // Re-read from the database to confirm what actually persisted.
      const check = await getJson<{ ticker?: { enabled: boolean } }>('/api/admin/settings', headers)
      const savedEnabled = check?.ticker?.enabled ?? saved?.settings?.ticker?.enabled
      setEnabled(Boolean(savedEnabled))
      if (targetEnabled !== Boolean(savedEnabled)) {
        toast.push(
          'Save did not persist — the database still reports the ticker as ' +
          (savedEnabled ? 'ON' : 'OFF') + '. The backend may need to be redeployed.',
          'err',
        )
        return
      }
      if (opts?.enabled === false) {
        toast.push('Scrolling text turned off — the homepage ticker is now hidden.')
      } else if (opts?.enabled === true) {
        toast.push('Scrolling text turned on — the homepage ticker is now showing.')
      } else {
        toast.push('Scrolling text saved. The homepage ticker updates within seconds.')
      }
    } catch (err: any) {
      toast.push(err.message || 'Failed to save settings', 'err')
    } finally {
      setSaving(false)
    }
  }

  const toggle = () => {
    const next = !enabled
    setEnabled(next)
    save({ enabled: next })
  }

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current
    if (!el) { setContent((c) => c + emoji); return }
    const start = el.selectionStart ?? content.length
    const end = el.selectionEnd ?? content.length
    const next = content.slice(0, start) + emoji + content.slice(end)
    setContent(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
    })
  }

  const PRESETS: { bg: string; text: string; label: string }[] = [
    { bg: '#5f2436', text: '#fdf0f2', label: 'Burgundy' },
    { bg: '#1a1a1a', text: '#ffffff', label: 'Black' },
    { bg: '#8a3547', text: '#fff8f8', label: 'Rose' },
    { bg: '#0f4c3a', text: '#ffffff', label: 'Deep Green' },
    { bg: '#1f3a5f', text: '#ffffff', label: 'Navy' },
    { bg: '#fdf0f2', text: '#5f2436', label: 'Ivory' },
  ]

  const EMOJI_PACKS: string[][] = [
    ['✨', '🌟', '🎉', '🎊', '🔥', '💯'],
    ['🎟️', '🎫', '📣', '📍', '🆕', '⏰'],
    ['💄', '👄', '💅', '🌸', '💖', '👑'],
    ['📅', '🕘', '🪑', '🎁', '🤝', '🥳'],
    ['✅', '👉', '📲', '💬', '🔗', '❤️'],
  ]

  return (
    <div className="card p-6">
      <h2 className="font-display text-lg font-bold flex items-center gap-2"><ScrollText size={18} /> Scrolling Text</h2>
      <p className="text-sm text-muted mt-1">Controls the announcement bar that scrolls across the top of the homepage.</p>

      {loading ? (
        <div className="flex items-center gap-2 text-muted mt-6"><LoaderCircle size={18} className="animate-spin" /> Loading settings…</div>
      ) : (
        <div className="space-y-6 mt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">Show on homepage</div>
              <div className="text-sm text-muted">Toggle the scrolling text on or off.</div>
            </div>
            <button
                onClick={toggle}
                disabled={saving}
                aria-pressed={enabled}
                className={`relative w-14 h-8 rounded-full transition-colors ${enabled ? 'bg-rose' : 'bg-black/20'} ${saving ? 'opacity-60 cursor-wait' : ''}`}
              >
                <span className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow transition-all ${enabled ? 'left-7' : 'left-1'}`} />
              </button>
          </div>

          <div>
            <label className="text-sm font-semibold block mb-1">Scrolling text — one line per message</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {EMOJI_PACKS.map((pack, i) => (
                <div key={i} className="flex items-center gap-0.5 rounded-full bg-blush px-2 py-1">
                  {pack.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => insertEmoji(emoji)}
                      title={`Insert ${emoji}`}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white text-base transition-colors"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              ))}
            </div>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm outline-none focus:border-rose"
              placeholder={'One announcement per line, e.g.\n3BMC — 3 Days Beginner Makeup Class\nRegistrations Open Now!'}
            />
            <p className="text-xs text-muted mt-1">Make a line clickable with an arrow (<span className="font-semibold">→</span> or <span className="font-semibold">-&gt;</span>): <span className="font-semibold">Register Now → https://chat.whatsapp.com/…</span>. A bare URL line also becomes a link. "Partner With Us" keeps its built-in link to the sponsor page.</p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold block mb-1 flex items-center gap-1.5"><Palette size={14} /> Background colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-10 h-10 rounded-lg border border-black/10 cursor-pointer" />
                <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm w-32 outline-none focus:border-rose" />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold block mb-1 flex items-center gap-1.5"><Palette size={14} /> Text colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-10 h-10 rounded-lg border border-black/10 cursor-pointer" />
                <input type="text" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm w-32 outline-none focus:border-rose" />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold block mb-1.5">Quick colour schemes</label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => { setBgColor(p.bg); setTextColor(p.text) }}
                  className="flex items-center gap-2 rounded-full border border-black/10 px-3 py-1.5 text-xs font-semibold hover:border-rose transition-colors"
                  style={{ backgroundColor: p.bg, color: p.text }}
                >
                  <Eye size={13} /> {p.label}
                </button>
              ))}
            </div>
          </div>

          <div
            className="rounded-2xl overflow-hidden border"
            style={{ backgroundColor: bgColor, color: textColor, borderColor: bgColor }}
          >
            <div className="flex items-center gap-3 px-3 py-2 text-xs sm:text-sm font-bold uppercase tracking-wider whitespace-nowrap overflow-hidden">
              <Sparkles size={13} aria-hidden />
              <span style={{ color: textColor }}>{content.split('\n').filter(Boolean)[0] || 'Preview'}</span>
              <span style={{ color: textColor }}>·</span>
              <span style={{ color: textColor }}>{content.split('\n').filter(Boolean)[1] || 'Your scrolling text will appear here'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button onClick={() => save()} disabled={saving}
              className="btn btn-primary disabled:opacity-60 flex items-center gap-2 whitespace-nowrap">
              {saving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />} {saving ? 'Saving…' : 'Save Scrolling Text'}
            </button>
            <span className="text-xs text-muted">The toggle saves instantly — no "Save" needed for on/off.</span>
          </div>
        </div>
      )}
    </div>
  )
}