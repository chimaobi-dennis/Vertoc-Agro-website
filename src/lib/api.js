/*
 * Content API client.
 *
 * In dev, vite proxies /api to the backend on :8787 (see vite.config.js).
 * In production set VITE_API_BASE to wherever the backend is deployed.
 */
import { useEffect, useState } from 'react'

const BASE = import.meta.env.VITE_API_BASE || ''

export async function fetchJson(path) {
  const res = await fetch(`${BASE}/api${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

/** Small data hook: { data, error, loading }. */
export function useApi(path, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  useEffect(() => {
    let alive = true
    setState(s => ({ ...s, loading: true }))
    fetchJson(path)
      .then(data => alive && setState({ data, error: null, loading: false }))
      .catch(error => alive && setState({ data: null, error, loading: false }))
    return () => { alive = false }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  return state
}
