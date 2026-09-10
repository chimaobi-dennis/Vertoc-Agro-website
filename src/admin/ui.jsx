/* Shared admin primitives. See DESIGN.md for the language they implement. */
import { useEffect, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

const VARIANTS = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
  accent:  'bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm shadow-accent/25',
  outline: 'border border-border bg-card text-foreground hover:bg-muted',
  ghost:   'text-foreground hover:bg-muted',
  danger:  'bg-destructive text-destructive-foreground hover:bg-destructive/90',
}
export const Button = ({ variant = 'primary', className = '', ...p }) => (
  <button
    {...p}
    className={`inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${VARIANTS[variant]} ${className}`}
  />
)

const control =
  'w-full rounded-xl border border-border bg-card px-3.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-50'
export const Input = ({ className = '', ...p }) => <input {...p} className={`${control} h-11 ${className}`} />
export const Textarea = ({ className = '', ...p }) => <textarea {...p} className={`${control} min-h-[110px] py-2.5 ${className}`} />
export const Select = ({ className = '', ...p }) => <select {...p} className={`${control} h-11 ${className}`} />

/** Input with a leading icon — used on the auth screens. */
export const IconInput = ({ icon: Icon, className = '', ...p }) => (
  <div className="relative">
    <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
    <Input {...p} className={`pl-10 ${className}`} />
  </div>
)

export const Field = ({ label, hint, error, children, className = '' }) => (
  <label className={`block ${className}`}>
    <span className="block text-sm font-semibold text-foreground mb-1.5">{label}</span>
    {children}
    {hint && !error && <span className="block text-xs text-muted-foreground mt-1.5">{hint}</span>}
    {error && <span className="block text-xs text-destructive mt-1.5">{error}</span>}
  </label>
)

export const Card = ({ className = '', hover = false, ...p }) => (
  <div
    {...p}
    className={`bg-card border border-border rounded-2xl shadow-sm ${
      hover ? 'transition-all duration-300 hover:shadow-md hover:-translate-y-0.5' : ''} ${className}`}
  />
)

const TONES = {
  muted:  'bg-muted text-muted-foreground',
  green:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  blue:   'bg-primary/10 text-primary dark:bg-primary/20',
  amber:  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  red:    'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  accent: 'bg-accent/15 text-accent',
}
export const Badge = ({ tone = 'muted', children, className = '' }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wide ${TONES[tone]} ${className}`}>
    {children}
  </span>
)

export const PageHeader = ({ eyebrow, title, description, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-4 mb-8 animate-fade-up">
    <div>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1.5">{eyebrow}</p>}
      <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground mt-1.5">{description}</p>}
    </div>
    {action}
  </div>
)

export const Table = ({ head, children }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
          {head.map((h, i) => <th key={i} className="px-5 py-3.5 font-semibold">{h}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">{children}</tbody>
    </table>
  </div>
)
export const Td = ({ className = '', ...p }) => <td {...p} className={`px-5 py-3.5 align-middle ${className}`} />

const ALERT = {
  error: ['border-destructive/25 bg-destructive/10 text-destructive', AlertCircle],
  ok:    ['border-accent/30 bg-accent/10 text-foreground', CheckCircle2],
  info:  ['border-primary/20 bg-primary/5 text-foreground', Info],
}
export const Alert = ({ tone = 'error', children }) => {
  const [cls, Icon] = ALERT[tone]
  return (
    <div role="alert" className={`flex gap-3 rounded-xl border px-4 py-3 text-sm ${cls}`}>
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/** Tiny toast: returns [toast(msg, tone), element]. */
export function useToast() {
  const [t, setT] = useState(null)
  useEffect(() => { if (!t) return; const id = setTimeout(() => setT(null), 3500); return () => clearTimeout(id) }, [t])
  const el = t && (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl px-5 py-3 text-sm font-medium shadow-lg animate-fade-up ${
      t.tone === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-primary text-primary-foreground'}`}>{t.msg}</div>
  )
  return [(msg, tone = 'ok') => setT({ msg, tone }), el]
}

export const confirmDelete = label => window.confirm(`Delete "${label}"? This cannot be undone.`)

/** Centred dialog (bottom sheet on phones). Closes on Escape and backdrop click. */
export function Modal({ open, onClose, title, children, footer, wide = false }) {
  useEffect(() => {
    if (!open) return
    const k = e => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="absolute inset-0 bg-primary/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <Card className={`relative z-10 w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[92vh] flex flex-col animate-fade-up rounded-b-none sm:rounded-b-2xl`}>
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-border">
          <h2 className="font-serif text-xl font-bold text-foreground">{title}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" aria-label="Close"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-border flex flex-wrap items-center justify-end gap-2">{footer}</div>}
      </Card>
    </div>
  )
}

/** Underline tabs. tabs: [{ key, label, icon?, count? }] */
export const Tabs = ({ tabs, value, onChange }) => (
  <div className="flex gap-1 overflow-x-auto border-b border-border mb-6 animate-fade-up" role="tablist">
    {tabs.map(({ key, label, icon: Icon, count }) => (
      <button key={key} role="tab" aria-selected={value === key} type="button" onClick={() => onChange(key)}
        className={`relative flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors ${value === key ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}>
        {Icon && <Icon className="w-4 h-4" />}{label}
        {count != null && <span className="ml-0.5 text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{count}</span>}
        {value === key && <span className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full bg-accent" />}
      </button>
    ))}
  </div>
)

export const Empty = ({ children }) => <div className="py-12 text-center text-sm text-muted-foreground">{children}</div>
