import { useCallback, useState } from 'react'

const BASE = import.meta.env.VITE_API_BASE || ''

/*
 * Shared submit logic for the contact and quote forms.
 *
 * `website` is a honeypot: it stays visually hidden, so a human never fills it
 * and the server silently discards anything that does.
 */
export function useEnquiryForm(kind, initialFields) {
  const [values, setValues] = useState({ ...initialFields, website: '' })
  const [token, setToken] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [error, setError] = useState(null)

  const field = useCallback(name => ({
    value: values[name] ?? '',
    onChange: e => setValues(v => ({ ...v, [name]: e.target.value })),
  }), [values])

  const submit = useCallback(async e => {
    e.preventDefault()
    setError(null)

    if (!values.name?.trim()) return setError('Please enter your name.')
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email || '')) {
      return setError('Please enter a valid email address.')
    }
    if (!token) return setError('Please complete the security check.')

    setStatus('sending')
    try {
      const res = await fetch(`${BASE}/api/enquiries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, kind, captchaToken: token }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
      setStatus('sent')
      setValues({ ...initialFields, website: '' })
    } catch (err) {
      setStatus('error')
      setError(err.message)
    }
  }, [values, token, kind, initialFields])

  return { values, field, setToken, submit, status, error, setValues }
}
