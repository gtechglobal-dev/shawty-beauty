import { apiUrl } from '../lib/constants'

declare global {
  interface Window {
    PaystackPop?: {
      setup: (opts: any) => { openIframe: () => void; open: () => void }
    }
  }
}

let paystackScriptPromise: Promise<void> | null = null

export function loadPaystackScript(): Promise<void> {
  if (window.PaystackPop) return Promise.resolve()
  if (paystackScriptPromise) return paystackScriptPromise

  paystackScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-paystack]')
    if (existing) {
      ;(existing as HTMLScriptElement).onload = () => resolve()
      ;(existing as HTMLScriptElement).onerror = () => reject(new Error('Failed to load Paystack'))
      return
    }
    const script = document.createElement('script')
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.setAttribute('data-paystack', 'true')
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load Paystack'))
    document.body.appendChild(script)
  })

  return paystackScriptPromise
}

export interface PaystackConfig {
  paystackEnabled: boolean
  publicKey: string
  baseUrl: string
  tickets: { id: string; label: string; price: number; unitName: string; includes: string[] }[]
}

export async function fetchPaystackConfig(): Promise<PaystackConfig> {
  const res = await fetch(`${apiUrl}/paystack/config`)
  if (!res.ok) throw new Error('Failed to load payment config')
  return res.json()
}
