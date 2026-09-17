import { useCallback, useEffect, useRef, useState } from 'react'
import { fmtDateTime } from './format'

const PREFIX = 'staff360:draft:'
const read = key => {
  try { const raw = localStorage.getItem(PREFIX + key); if (!raw) return null; const d = JSON.parse(raw); return d && typeof d === 'object' && d.value !== undefined ? d : null }
  catch { return null }
}

/**
 * Form state that survives a reload or a closed tab: mirrored to
 * localStorage (debounced) under `key` while `enabled`, and dropped with
 * `clear()` once the record is saved. Returns [value, setValue, draft] where
 * draft = { restored, savedAt, clear }. `restored` is true when the initial
 * value came from storage, so the form can say so.
 */
export function useDraft(key, initial, { enabled = true } = {}) {
  const [saved] = useState(() => (enabled ? read(key) : null))
  const [value, setValue] = useState(() => (saved ? saved.value : initial))
  const [restored, setRestored] = useState(Boolean(saved))
  const skip = useRef(true)   // never write the initial (or just-restored) value straight back
  useEffect(() => {
    if (!enabled) return
    if (skip.current) { skip.current = false; return }
    if (value == null) return
    const t = setTimeout(() => { try { localStorage.setItem(PREFIX + key, JSON.stringify({ value, savedAt: new Date().toISOString() })) } catch {} }, 300)
    return () => clearTimeout(t)
  }, [key, value, enabled])
  const clear = useCallback(next => {
    try { localStorage.removeItem(PREFIX + key) } catch {}
    setRestored(false)
    skip.current = true   // the reset that follows a discard must not be written back
    if (next !== undefined) setValue(next)
  }, [key])
  return [value, setValue, { restored, savedAt: saved?.savedAt || null, clear }]
}

/** "Draft restored" strip with a Discard action; renders nothing unless a draft was restored. */
export function DraftNotice({ draft, onDiscard }) {
  if (!draft?.restored) return null
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2.5 text-sm">
      <span>Unsaved draft restored{draft.savedAt ? ` from ${fmtDateTime(draft.savedAt)}` : ''}. It is kept on this device until you save.</span>
      <button type="button" onClick={onDiscard} className="font-semibold text-accent hover:underline">Discard draft</button>
    </div>
  )
}
