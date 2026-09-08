import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck, LoaderCircle, CircleAlert, CircleX } from 'lucide-react'
import { postJson } from '../lib/api'
import Reveal from '../components/Reveal'

const WHATSAPP_TICKET_GROUPS: Record<string, string> = {
  student: 'https://chat.whatsapp.com/JVfcHyovmfBFQnfXyw2X89?mode=gi_t',
  gold: 'https://chat.whatsapp.com/Ib798HDNegI7Wz6bcr6tSg?mode=gi_t',
}

const WHATSAPP_COMMUNITY_DEFAULT = 'https://chat.whatsapp.com/LsEBJJVVFAJ0rSr8bsx8Sq'

function whatsappGroupFor(registration?: {
  ticketType?: string
  ticketLabel?: string
}): string {
  const key = String(registration?.ticketType || registration?.ticketLabel || '').toLowerCase()
  if (key.includes('student')) return WHATSAPP_TICKET_GROUPS.student
  if (key.includes('gold')) return WHATSAPP_TICKET_GROUPS.gold
  return WHATSAPP_COMMUNITY_DEFAULT
}

export default function PaymentCallback() {
  const [params] = useSearchParams()
  const reference = params.get('reference') || ''
  const [state, setState] = useState<'loading' | 'paid' | 'failed'>('loading')
  const [whatsappLink, setWhatsappLink] = useState<string>(WHATSAPP_COMMUNITY_DEFAULT)

  useEffect(() => {
    if (!reference) {
      setState('failed')
      return
    }
    postJson('/api/paystack/verify', { reference })
      .then((data) => {
        setState(data.paid ? 'paid' : 'failed')
        if (data.paid && data.registration) {
          setWhatsappLink(whatsappGroupFor(data.registration))
        }
      })
      .catch(() => setState('failed'))
  }, [reference])

  return (
    <div className="container py-24 max-w-lg text-center">
      <Reveal variant="up">
      {state === 'loading' && (
        <div className="card p-12">
          <LoaderCircle className="mx-auto text-rose animate-spin mb-4" size={44} />
          <h1 className="section-title text-2xl mb-2">Verifying payment…</h1>
          <p className="text-muted text-sm">Please wait while we confirm your transaction.</p>
        </div>
      )}

      {state === 'paid' && (
        <div className="card p-12">
          <CircleCheck className="mx-auto text-green-500 mb-4" size={56} />
          <h1 className="section-title text-2xl mb-3">Payment Successful! Welcome Onboard!</h1>
          <p className="text-ink/70 mb-4">
            Your registration is confirmed and your ticket has been sent to your registered email, kindly
            download and keep safe for the event.
          </p>
          <p className="text-ink/70 mb-6">
            Also check your spam folder if you can&rsquo;t find it in your primary folder. Other information
            will be sent to you via your registered contacts when necessary... See you in class!
          </p>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn btn-primary mb-3">
            Join WhatsApp Community
          </a>
          <div className="mb-6" />
          <Link to="/" className="btn btn-outline">Back to Home</Link>
        </div>
      )}

      {state === 'failed' && (
        <div className="card p-12">
          <CircleX className="mx-auto text-red-500 mb-4" size={56} />
          <h1 className="section-title text-2xl mb-3">Payment not confirmed</h1>
          <p className="text-ink/70 mb-6">
            We couldn’t confirm your payment with reference{' '}
            <code className="text-xs bg-black/5 px-2 py-0.5 rounded">{reference || '—'}</code>.
            If you believe this is a mistake, contact us and we’ll look into it.
          </p>
          <div className="flex justify-center gap-3">
            <Link to="/contact" className="btn btn-outline">Contact Us</Link>
            <Link to="/register" className="btn btn-primary">Try Again</Link>
          </div>
        </div>
      )}
      </Reveal>
    </div>
  )
}