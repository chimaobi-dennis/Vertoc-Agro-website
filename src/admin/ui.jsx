/* Small shared primitives for the admin panel, on the site's own tokens. */
import { useEffect, useState } from 'react'

export const Button = ({ variant = 'primary', className = '', ...p }) => (
  <button
    {...p}
    className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none ${
      { primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        accent: 'bg-accent text-accent-foreground hover:opacity-90',
        outline: 'border border-border bg-card text-foreground hover:bg-muted',
        danger: 'bg-destructive text-destructive-foreground hover:opacity-90',
        ghost: 'text-foreground hover:bg-muted' }[variant]
    } ${className}`}
  />
)

const inputCls = 'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50'
export const Input = p => <input {...p} className={`${inputCls} ${p.className || ''}`} />
export const Textarea = p => <textarea {...p} className={`${inputCls} h-auto min-h-[100px] py-2 ${p.className || ''}`} />
export const Select = p => <select {...p} className={`${inputCls} ${p.className || ''}`} />

export const Field = ({ label, hint, error, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="block text-sm font-medium text-foreground mb-1.5">{label}</span>
    {children}
    {hint && !error && <span className="block text-xs text-muted-foreground mt-1">{hint}</span>}
    {error && <span className="block text-xs text-destructive mt-1">{error}</span>}
  </label>
)

export const Card = ({ className = '', ...p }) => (
  <div {...p} className={`bg-card border border-border rounded-2xl shadow-card ${className}`} />
)

export const Badge = ({ tone = 'muted', children }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
    { muted: 'bg-muted text-muted-foreground', green: 'bg-emerald-100 text-emerald-700',
      blue: 'bg-primary/10 text-primary', amber: 'bg-amber-100 text-amber-700',
      red: 'bg-red-100 text-red-700' }[tone]}`}>{children}</span>
)

export const PageHeader = ({ title, description, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
    <div>
      <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">{title}</h1>
      {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
    </div>
    {action}
  </div>
)

export const Table = ({ head, children }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead><tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
        {head.map(h => <th key={h} className="px-4 py-3 font-semibold">{h}</th>)}
      </tr></thead>
      <tbody className="divide-y divide-border">{children}</tbody>
    </table>
  </div>
)
export const Td = ({ className = '', ...p }) => <td {...p} className={`px-4 py-3 align-middle ${className}`} />

export const Alert = ({ tone = 'error', children }) => (
  <div role="alert" className={`rounded-xl border px-4 py-3 text-sm ${
    tone === 'error' ? 'border-destructive/30 bg-destructive/10 text-destructive'
                     : 'border-accent/30 bg-accent/10 text-foreground'}`}>{children}</div>
)

/** Tiny toast: returns [toast(msg, tone), element]. */
export function useToast() {
  const [t, setT] = useState(null)
  useEffect(() => { if (!t) return; const id = setTimeout(() => setT(null), 3500); return () => clearTimeout(id) }, [t])
  const el = t && (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full px-5 py-2.5 text-sm font-medium shadow-hover ${
      t.tone === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>{t.msg}</div>
  )
  return [(msg, tone = 'ok') => setT({ msg, tone }), el]
}

export const confirmDelete = label => window.confirm(`Delete "${label}"? This cannot be undone.`)
