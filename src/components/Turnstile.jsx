import { useEffect, useRef, useState } from 'react'

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

let scriptPromise = null
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = SCRIPT_SRC
    el.async = true
    el.defer = true
    el.onload = () => resolve(window.turnstile)
    el.onerror = () => reject(new Error('Could not load Turnstile'))
    document.head.appendChild(el)
  })
  return scriptPromise
}

/*
 * Cloudflare Turnstile widget.
 *
 * Produces a token that the server exchanges with Cloudflare before accepting
 * a submission — the widget alone proves nothing (see server/verify-turnstile.js).
 *
 * With no site key configured the form stays usable in local development; the
 * server refuses to boot in production without its matching secret.
 */
export default function Turnstile({ onVerify, onExpire, className = '' }) {
  const hostRef = useRef(null)
  const widgetId = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!SITE_KEY) {
      onVerify?.('dev-no-sitekey')
      return
    }
    let cancelled = false

    loadTurnstile()
      .then(ts => {
        if (cancelled || !hostRef.current || widgetId.current !== null) return
        widgetId.current = ts.render(hostRef.current, {
          sitekey: SITE_KEY,
          callback: token => onVerify?.(token),
          'expired-callback': () => { onExpire?.(); onVerify?.('') },
          'error-callback': () => setError('Verification failed to load.'),
          theme: 'auto',
        })
      })
      .catch(e => !cancelled && setError(e.message))

    return () => {
      cancelled = true
      if (widgetId.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetId.current) } catch { /* already gone */ }
        widgetId.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!SITE_KEY) {
    return (
      <p className={`text-xs text-muted-foreground ${className}`}>
        Spam protection is inactive — <code>VITE_TURNSTILE_SITE_KEY</code> is not set.
      </p>
    )
  }

  return (
    <div className={className}>
      <div ref={hostRef} />
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
    </div>
  )
}

export const turnstileConfigured = Boolean(SITE_KEY)
