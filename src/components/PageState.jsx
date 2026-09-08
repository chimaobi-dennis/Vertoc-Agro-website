/* Shared loading / empty / error states for the API-backed pages. */
export function Loading({ label = 'Loading…' }) {
  return (
    <div className="py-24 text-center text-muted-foreground" role="status" aria-live="polite">
      {label}
    </div>
  )
}

export function ErrorState({ error }) {
  return (
    <div className="py-24 text-center">
      <p className="text-foreground font-semibold mb-2">Couldn&rsquo;t load this content.</p>
      <p className="text-sm text-muted-foreground">
        {error?.message || 'Please try again shortly.'}
      </p>
    </div>
  )
}

export function Empty({ label }) {
  return <div className="py-24 text-center text-muted-foreground">{label}</div>
}
