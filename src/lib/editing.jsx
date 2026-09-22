/*
 * In-place editing of the public pages.
 *
 * When a signed-in staff member with the 'frontpages' permission visits the
 * site, every editable card gets an "Edit" control on hover. The editor
 * itself (src/admin/InlineEditor.jsx) is loaded only then, so visitors never
 * download it. Saves go to the same endpoints the panel uses, then the site
 * data is re-fetched and the page updates live.
 */
import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { supabase } from './supabase'
import { adminFetch } from './adminApi'

const Ctx = createContext({ enabled: false, open: () => {} })
const InlineEditor = lazy(() => import('../admin/InlineEditor'))

export function EditingProvider({ children }) {
  const [enabled, setEnabled] = useState(false)
  const [target, setTarget] = useState(null)   // { section, index?, id?, add? }
  useEffect(() => {
    if (!supabase) return
    let alive = true
    const check = async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (!data.session) { alive && setEnabled(false); return }
        const me = await adminFetch('/me')
        alive && setEnabled(Boolean(me?.permissions?.frontpages))
      } catch { alive && setEnabled(false) }
    }
    check()
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => { if (e === 'SIGNED_OUT' || !s) setEnabled(false); else if (e === 'SIGNED_IN') check() })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])
  const open = useCallback(t => setTarget(t), [])
  return (
    <Ctx.Provider value={{ enabled, open }}>
      {children}
      {enabled && target && <Suspense fallback={null}><InlineEditor target={target} onClose={() => setTarget(null)} /></Suspense>}
    </Ctx.Provider>
  )
}

export const useEditing = () => useContext(Ctx)

/**
 * Wrap one card. `section` names the content list (stats, markets, faq…),
 * `index` or `id` picks the item; omit both for a single-value section
 * (mission, vision, markets_captions). With `add`, renders an "Add" tile
 * instead of wrapping children. Visitors see the children unchanged.
 */
export function Editable({ section, index, id, label, add = false, className = '', children }) {
  const { enabled, open } = useEditing()
  if (!enabled) return add ? null : children
  if (add) {
    return (
      <button type="button" onClick={() => open({ section, add: true })} className={`flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-accent/50 text-accent text-sm font-semibold p-6 hover:bg-accent/10 transition-colors ${className}`}>
        <Plus className="w-4 h-4" />Add {label || 'item'}
      </button>
    )
  }
  return (
    <div className={`relative group/edit ${className}`}>
      {children}
      <button type="button" onClick={e => { e.stopPropagation(); open({ section, index, id }) }} aria-label={`Edit ${label || section}`}
        className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold px-2.5 py-1 shadow-md opacity-0 group-hover/edit:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-90 transition-opacity">
        <Pencil className="w-3 h-3" />Edit
      </button>
    </div>
  )
}
