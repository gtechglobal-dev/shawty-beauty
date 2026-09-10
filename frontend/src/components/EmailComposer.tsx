import { useRef, useState } from 'react'
import {
  Send,
  LoaderCircle,
  Plus,
  ImagePlus,
  Trash2,
  ChevronUp,
  ChevronDown,
  X,
  AlignLeft,
} from 'lucide-react'
import Modal from './Modal'
import { useToast } from './Toasts'
import { resizeImageBase64, base64ByteLength } from '../lib/image'

export interface EmailComposerRecipient {
  id: string
  email: string
  label: string
  sublabel?: string
}

export interface EmailComposerBlock {
  id: string
  type: 'text' | 'image'
  text?: string
  dataUrl?: string
  width?: 'full' | 'medium' | 'small'
}

type CleanBlock = { type: 'text'; text: string } | { type: 'image'; dataUrl: string; width: string }

interface PendingSend {
  subject: string
  blocks: CleanBlock[]
  emails: string[]
}

const IMG_PCT: Record<string, string> = { full: '100%', medium: '74%', small: '50%' }

const EMAIL_RE = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/

interface EmailComposerProps {
  title: string
  subtitle?: React.ReactNode
  headers: Record<string, string>
  recipients: EmailComposerRecipient[]
  initialSubject?: string
  initialMessage?: string
  sendLabel?: string
  wide?: boolean
  onClose: () => void
  onSend: (payload: {
    subject: string
    blocks: ({ type: 'text'; text: string } | { type: 'image'; dataUrl: string; width: string })[]
    emails: string[]
  }) => Promise<{ total?: number; sent?: number; failed?: number } | undefined>
}
const widthOptions: { key: 'full' | 'medium' | 'small'; label: string }[] = [
  { key: 'full', label: 'Full' },
  { key: 'medium', label: 'Medium' },
  { key: 'small', label: 'Small' },
]

function parseEmails(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const chunk of raw.split(/[\s,;]+/)) {
    const email = chunk.trim().toLowerCase()
    if (!email) continue
    if (!EMAIL_RE.test(email)) continue
    if (seen.has(email)) continue
    seen.add(email)
    out.push(email)
  }
  return out
}

// A flexible composer used by the applicants and sponsors email senders. The
// body is made of ordered blocks — paragraphs and inline images — that the
// admin can add, reorder and delete as the message takes shape. An optional
// "external email" field appends addresses the admin types in manually.
export default function EmailComposer({
  title,
  subtitle,
  headers,
  recipients,
  initialSubject = '',
  initialMessage = '',
  sendLabel = 'Send email',
  wide = false,
  onClose,
  onSend,
}: EmailComposerProps) {
  const [subject, setSubject] = useState(initialSubject)
  const [blocks, setBlocks] = useState<EmailComposerBlock[]>(() => {
    const text = initialMessage.trim()
    if (!text) return []
    return [{ id: 'b0', type: 'text', text }]
  })
  const [selected, setSelected] = useState<Set<string>>(() => new Set(recipients.map((r) => r.id)))
  const [external, setExternal] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingSend | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const idRef = useRef(1)
  const toast = useToast()

  const nextId = () => `b${idRef.current++}`
  const extEmails = parseEmails(external)

  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= bs.length) return bs
      const copy = [...bs]
      const [b] = copy.splice(i, 1)
      copy.splice(j, 0, b)
      return copy
    })
  }

  function removeBlock(id: string) {
    setBlocks((bs) => bs.filter((b) => b.id !== id))
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('Could not read image'))
        reader.readAsDataURL(file)
      })
      const resized = await resizeImageBase64(dataUrl, 1600)
      if (base64ByteLength(resized) > 3_000_000) {
        toast.push('Image is too large (max 3 MB). Try a smaller one.', 'err')
        return
      }
      setBlocks((bs) => [...bs, { id: nextId(), type: 'image', dataUrl: resized, width: 'full' }])
    } catch (err: any) {
      toast.push(err.message || 'Could not read image.', 'err')
    }
  }

  const toggle = (id: string) =>
    setSelected((s) => {
      const copy = new Set(s)
      if (copy.has(id)) copy.delete(id)
      else copy.add(id)
      return copy
    })

  function buildPending(): PendingSend | null {
    const cleanBlocks = blocks
      .filter((b) => (b.type === 'text' ? !!b.text?.trim() : !!b.dataUrl))
      .map((b) =>
        b.type === 'text'
          ? { type: 'text' as const, text: b.text!.trim() }
          : { type: 'image' as const, dataUrl: b.dataUrl!, width: b.width || 'full' },
      )
    if (!subject.trim()) {
      toast.push('Add a subject first.', 'err')
      return null
    }
    if (cleanBlocks.length === 0) {
      toast.push('Add some text or an image to send.', 'err')
      return null
    }
    const chosen = recipients.filter((r) => selected.has(r.id)).map((r) => r.email)
    const emails = Array.from(new Set([...chosen, ...extEmails]))
    if (emails.length === 0) {
      toast.push('Select at least one recipient or add an external email.', 'err')
      return null
    }
    return { subject: subject.trim(), blocks: cleanBlocks, emails }
  }

  // First tap on "Send" shows a preview of the finished email so the admin can
  // confirm exactly how it will look before anything leaves the box.
  function send() {
    const payload = buildPending()
    if (payload) setPending(payload)
  }

  async function confirmSend() {
    if (!pending) return
    setBusy(true)
    try {
      const data = await onSend(pending)
      if (data) {
        toast.push(
          data.total
            ? `Email sent to ${data.sent} of ${data.total} recipient${data.total === 1 ? '' : 's'}${data.failed ? ` (${data.failed} failed)` : ''}.`
            : 'No recipients could be emailed.',
          data.sent && data.sent > 0 ? 'ok' : 'err',
        )
        if (data.sent && data.sent > 0) onClose()
      }
    } catch (err: any) {
      toast.push(err.message || 'Failed to send email.', 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open wide={wide} onClose={onClose}>
      {pending ? (
        <EmailPreview
          subject={pending.subject}
          blocks={pending.blocks}
          emails={pending.emails}
          sendLabel={sendLabel}
          busy={busy}
          onBack={() => setPending(null)}
          onConfirm={confirmSend}
        />
      ) : (
        <>
          <h3 className="text-lg font-bold pr-8">{title}</h3>
          {subtitle && <div className="text-sm text-muted mt-1">{subtitle}</div>}

          <div className="mt-5 space-y-4">
        <div>
          <label className="field-label">Subject</label>
          <input
            className="input-field"
            placeholder="e.g. Exciting news from Shawty Beauty Studio"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div>
          <label className="field-label">Message</label>
          <div className="space-y-3">
            {blocks.length === 0 && (
              <p className="text-sm text-muted">Add paragraphs and images below — reorder them however you like.</p>
            )}
            {blocks.map((b, i) => (
              <div key={b.id} className="border border-black/10 rounded-xl overflow-hidden bg-white">
                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-black/[0.02] border-b border-black/5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-ink/50 uppercase tracking-wide">
                    {b.type === 'text' ? <AlignLeft size={13} /> : <ImagePlus size={13} />}
                    {b.type === 'text' ? 'Paragraph' : 'Image'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveBlock(b.id, -1)} disabled={i === 0}
                      className="p-1 rounded-md text-ink/50 hover:bg-black/5 disabled:opacity-30" title="Move up">
                      <ChevronUp size={15} />
                    </button>
                    <button type="button" onClick={() => moveBlock(b.id, 1)} disabled={i === blocks.length - 1}
                      className="p-1 rounded-md text-ink/50 hover:bg-black/5 disabled:opacity-30" title="Move down">
                      <ChevronDown size={15} />
                    </button>
                    <button type="button" onClick={() => removeBlock(b.id)}
                      className="p-1 rounded-md text-red-500 hover:bg-red-50" title="Remove">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {b.type === 'text' ? (
                  <textarea
                    className="w-full border-0 focus:outline-none p-3 min-h-24 resize-y bg-transparent text-sm"
                    placeholder="Write your paragraph…"
                    value={b.text || ''}
                    onChange={(e) =>
                      setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, text: e.target.value } : x)))
                    }
                  />
                ) : (
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      <img
                        src={b.dataUrl}
                        alt=""
                        className="w-20 h-20 object-cover rounded-lg border border-black/10 shrink-0"
                      />
                      <div className="flex flex-wrap gap-1.5">
                        {widthOptions.map((w) => (
                          <button
                            key={w.key}
                            type="button"
                            onClick={() =>
                              setBlocks((bs) => bs.map((x) => (x.id === b.id ? { ...x, width: w.key } : x)))
                            }
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
                              (b.width || 'full') === w.key
                                ? 'bg-rose text-white border-rose'
                                : 'border-black/10 text-ink/60 hover:bg-black/5'
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted mt-2">Shown at {(b.width || 'full') === 'full' ? 'full width' : (b.width || 'full') === 'medium' ? 'medium width' : 'small width'} in the email.</p>
                  </div>
                )}
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setBlocks((bs) => [...bs, { id: nextId(), type: 'text', text: '' }])}
                className="btn btn-outline !py-2 flex items-center gap-1.5"
              >
                <Plus size={15} /> Add paragraph
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="btn btn-outline !py-2 flex items-center gap-1.5"
              >
                <ImagePlus size={15} /> Add image
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFileChosen} />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-semibold">
              Recipients ({selected.size + extEmails.length})
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelected(new Set(recipients.map((r) => r.id)))} className="text-xs font-semibold text-rose-deep hover:underline">All</button>
              <button onClick={() => setSelected(new Set())} className="text-xs font-semibold text-rose-deep hover:underline">None</button>
            </div>
          </div>
          <div className="max-h-44 overflow-y-auto border border-black/10 rounded-xl divide-y divide-black/5">
            {recipients.length === 0 && (
              <div className="p-4 text-sm text-muted">No recipients yet — add an external email below or send once there are some.</div>
            )}
            {recipients.map((r) => (
              <label key={r.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-black/[0.02]">
                <input
                  type="checkbox"
                  className="accent-rose w-4 h-4 shrink-0"
                  checked={selected.has(r.id)}
                  onChange={() => toggle(r.id)}
                />
                <span className="text-sm font-medium flex-1 truncate">{r.label}</span>
                {r.sublabel && <span className="text-xs text-muted shrink-0">{r.sublabel}</span>}
              </label>
            ))}
          </div>

          <label className="field-label mt-4">Also send to external email(s)</label>
          <input
            className="input-field"
            placeholder="person@example.com, another@example.com"
            value={external}
            onChange={(e) => setExternal(e.target.value)}
          />
          {extEmails.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {extEmails.map((e) => (
                <span key={e} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blush text-rose-deep text-xs font-semibold">
                  {e}
                  <button
                    type="button"
                    onClick={() => setExternal((v) => v.split(/[\s,;]+/).filter((x) => x.trim().toLowerCase() !== e).join(', '))}
                    className="text-rose-deep/60 hover:text-rose-deep"
                    aria-label={`Remove ${e}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:items-stretch">
          <button onClick={onClose} className="btn btn-light flex-1">Cancel</button>
          <button onClick={send} disabled={busy} className="btn btn-primary flex-1 flex items-center justify-center gap-1.5 disabled:opacity-60">
            {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />} {sendLabel}
          </button>
        </div>
      </div>
        </>
      )}
    </Modal>
  )
}

// ---------- Email preview (confirmation step) ----------

function EmailPreview({
  subject,
  blocks,
  emails,
  sendLabel,
  busy,
  onBack,
  onConfirm,
}: {
  subject: string
  blocks: CleanBlock[]
  emails: string[]
  sendLabel: string
  busy: boolean
  onBack: () => void
  onConfirm: () => void
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-lg font-bold">Preview email</h3>
          <p className="text-sm text-muted mt-1">
            Exactly how it will look to recipients. Confirm below to send to {emails.length} recipient{emails.length === 1 ? '' : 's'}.
          </p>
        </div>
      </div>

      <div className="mt-4 max-h-[55vh] overflow-y-auto rounded-xl border border-black/10 bg-[#fdf9f4] p-2">
        <div className="rounded-2xl overflow-hidden border border-[#f0dbe4] bg-white max-w-[560px] mx-auto">
          <div className="bg-gradient-to-br from-[#8f4b68] via-[#b36380] to-[#d9a37a] px-7 py-8 text-center">
            <div className="font-serif text-[12px] tracking-[0.2em] uppercase text-[#f6e3ec] mb-2">Shawty Beauty Studio</div>
            <div className="w-[42px] h-[3px] bg-[#f6e3ec] rounded-full mx-auto mb-4" />
            <h1 className="font-serif text-2xl font-semibold text-white leading-relaxed">{subject}</h1>
          </div>
          <div className="px-7 pt-6 pb-2">
            {blocks.map((b, i) =>
              b.type === 'text' ? (
                <div key={i}>
                  {b.text.split(/\n{2,}/).map((p, j) => (
                    <p key={j} className="text-sm leading-relaxed text-[#2a1b22] mb-4 whitespace-pre-wrap">{p}</p>
                  ))}
                </div>
              ) : (
                <img
                  key={i}
                  src={b.dataUrl}
                  alt=""
                  className={`rounded-xl border border-[#f0dbe4] mb-4 ${b.width === 'medium' || b.width === 'small' ? 'mx-auto' : ''}`}
                  style={{ width: IMG_PCT[b.width] || '100%' }}
                />
              ),
            )}
          </div>
          <div className="bg-[#f6e3ec] px-7 py-4">
            <p className="text-xs text-[#914e6c]">© {new Date().getFullYear()} Shawty Beauty Studio</p>
            <p className="text-[11px] text-[#b39aa5] mt-2">Unsubscribe from these emails</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-sm font-semibold mb-2">Sending to {emails.length} recipient{emails.length === 1 ? '' : 's'}</div>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {emails.map((e) => (
            <span key={e} className="px-2.5 py-1 rounded-full bg-blush text-rose-deep text-xs font-semibold">{e}</span>
          ))}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mt-6 sm:items-stretch">
        <button onClick={onBack} disabled={busy} className="btn btn-light flex-1">Back</button>
        <button onClick={onConfirm} disabled={busy} className="btn btn-primary flex-1 flex items-center justify-center gap-1.5 disabled:opacity-60">
          {busy ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />} Confirm &amp; {sendLabel.toLowerCase()}
        </button>
      </div>
    </>
  )
}