import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleCheck, LoaderCircle, CircleAlert, CircleX } from 'lucide-react'
import { postJson } from '../lib/api'

export default function PaymentCallback() {
  const [params] = useSearchParams()
  const reference = params.get('reference') || ''
  const [state, setState] = useState<'loading' | 'paid' | 'failed'>('loading')

  useEffect(() => {
    if (!reference) {
      setState('failed')
      return
    }
    postJson('/api/paystack/verify', { reference })
      .then((data) => setState(data.paid ? 'paid' : 'failed'))
      .catch(() => setState('failed'))
  }, [reference])

  return (
    <div className="container py-24 max-w-lg text-center">
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
          <h1 className="section-title text-2xl mb-3">Payment Successful!</h1>
          <p className="text-ink/70 mb-6">
            Thank you! Your registration is confirmed. A confirmation email has been sent to you.
            Kindly join the WhatsApp community with the link below. Welcome Onboard!
          </p>
          <a href="https://chat.whatsapp.com/LsEBJJVVFAJ0rSr8bsx8Sq" target="_blank" rel="noopener noreferrer" className="btn btn-primary mb-3">
            Join WhatsApp Community
          </a>
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
    </div>
  )
}
