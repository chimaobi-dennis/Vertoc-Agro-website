/*
 * Ordering for lists. Every list starts newest first; the visitor may pick
 * another order. Display only: nothing about the records changes.
 *
 *   const [sorted, sortControl] = useSort(rows, { name: 'title', more: [{ key: 'amount', label: 'Amount, highest first', get: 'total', desc: true }] })
 */
import { useMemo, useRef, useState } from 'react'
import { ArrowDownUp } from 'lucide-react'

const read = (row, get) => (typeof get === 'function' ? get(row) : row?.[get])
const empty = v => v == null || v === ''
function compare(a, b) {
  if (empty(a) || empty(b)) return empty(a) ? (empty(b) ? 0 : 1) : -1          // blanks last, whichever way
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' })
}

export function sortOptions({ date = 'created_at', name = null, more = [] } = {}) {
  return [
    { key: 'newest', label: 'Newest first', get: date, desc: true },
    { key: 'oldest', label: 'Oldest first', get: date },
    ...(name ? [{ key: 'az', label: 'A – Z', get: name }, { key: 'za', label: 'Z – A', get: name, desc: true }] : []),
    ...more,
  ]
}

export function useSort(rows, config = {}, { className = '' } = {}) {
  const [key, setKey] = useState(config.initial || 'newest')
  const options = sortOptions(config)
  const latest = useRef(options); latest.current = options
  const sorted = useMemo(() => {
    if (!rows) return rows
    const o = latest.current.find(x => x.key === key) || latest.current[0]
    return [...rows].sort((x, y) => { const a = read(x, o.get), b = read(y, o.get); if (empty(a) || empty(b)) return compare(a, b); return o.desc ? compare(b, a) : compare(a, b) })
  }, [rows, key])
  const control = (
    <label className={`inline-flex items-center gap-1.5 text-muted-foreground ${className}`}>
      <ArrowDownUp className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">Sort by</span>
      <select value={key} onChange={e => setKey(e.target.value)} className="h-10 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25">
        {options.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </label>
  )
  return [sorted, control, key]
}
