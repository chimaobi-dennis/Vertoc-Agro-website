/*
 * The /invest section's content, as published in the staff panel (Invest content).
 * Visitors get the live version; staff opening a page with ?preview=1 get the draft.
 * The texts below are what shows before the content has loaded, or if it cannot be.
 */
import { createContext, useContext, useEffect, useState } from 'react'
import { adminFetch } from './adminApi'

const BASE = import.meta.env.VITE_API_BASE || ''

export const PORTAL_FALLBACK = {
  risk_notice: 'Investing puts your money at risk. Expected returns are estimates, not guarantees, and you may get back less than you put in. Read the terms of each opportunity and take independent advice if you are unsure.',
  view_button: 'View and invest', details_button: 'View details', apply_button: 'Apply to invest',
  payment_note: 'Your application goes to our team for approval. We then send you the payment details; the investment starts once your payment is confirmed.',
  agree_prefix: 'I have read the', agree_suffix: 'and accept these terms. I understand that returns are expected, not guaranteed.',
  agree_fallback: 'I have read the terms of this opportunity and understand that returns are expected, not guaranteed.',
  docs_title: 'Read before you apply',
  empty_title: 'No open opportunities right now', empty_text: 'New opportunities are published here as they become available. We will notify you.',
}

let cache = null
/** { data, ready, preview }: data[key] = { visible, content }. */
export function useInvestContent() {
  const preview = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('preview')
  const [state, setState] = useState(() => ({ data: preview ? null : cache, ready: !preview && Boolean(cache), error: null }))
  useEffect(() => {
    let alive = true
    const load = preview ? adminFetch('/invest-preview') : fetch(`${BASE}/api/invest-content`).then(r => (r.ok ? r.json() : Promise.reject(new Error('The page could not be loaded.'))))
    load.then(d => { if (!preview) cache = d; if (alive) setState({ data: d, ready: true, error: null }) })
      .catch(e => { if (alive) setState(s => ({ ...s, ready: true, error: preview ? 'Sign in to the staff panel in this browser to preview unpublished changes.' : e.message })) })
    return () => { alive = false }
  }, [preview])
  return { ...state, preview }
}

const Ctx = createContext({ data: null, ready: false, preview: false })
export const InvestContentProvider = ({ children }) => { const v = useInvestContent(); return <Ctx.Provider value={v}>{children}</Ctx.Provider> }
export const useInvestPage = key => { const v = useContext(Ctx); return { ...v, page: v.data?.[key] } }
/** The portal's own texts, with the built-in wording while the content loads. */
export const usePortalText = () => { const { data } = useContext(Ctx); return { ...PORTAL_FALLBACK, ...(data?.portal?.visible ? data.portal.content : {}) } }
