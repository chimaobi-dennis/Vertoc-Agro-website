/*
 * Pulsing skeletons for the API-backed pages.
 *
 * Each one mirrors the real component's layout — same card classes, aspect
 * ratios, grid and padding — so nothing reflows when the data arrives. The
 * wrapper announces itself to assistive tech; the individual bones are hidden
 * from it so a screen reader hears "Loading" once, not a dozen empty boxes.
 */

export function Bone({ className = '' }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-muted ${className}`} />
}

/* --------------------------------------------------------- list cards --- */

export function ProductCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden h-full flex flex-col">
      <div aria-hidden="true" className="aspect-[4/3] w-full animate-pulse bg-muted" />
      <div className="p-5 flex flex-col flex-1">
        <Bone className="h-5 w-2/3 mb-3" />
        <Bone className="h-4 w-full mb-2" />
        <Bone className="h-4 w-5/6 mb-2" />
        <Bone className="h-4 w-3/5" />
        <Bone className="h-4 w-24 mt-auto pt-3" />
      </div>
    </div>
  )
}

export function BlogCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden h-full flex flex-col">
      <div aria-hidden="true" className="aspect-[16/9] w-full animate-pulse bg-muted" />
      <div className="p-5 flex flex-col flex-1">
        <Bone className="h-6 w-28 rounded-2xl mb-3" />
        <Bone className="h-5 w-11/12 mb-1.5" />
        <Bone className="h-5 w-2/3 mb-3" />
        <Bone className="h-4 w-full mb-1.5" />
        <Bone className="h-4 w-full mb-1.5" />
        <Bone className="h-4 w-3/4" />
        <div className="flex items-center gap-4 mt-auto pt-4">
          <Bone className="h-3 w-24" />
          <Bone className="h-3 w-16" />
        </div>
      </div>
    </div>
  )
}

/** Renders `count` list-card skeletons inside the page's own grid classes. */
export function CardGridSkeleton({ card: Card, count = 6, gridClassName, label }) {
  return (
    <div className={gridClassName} role="status" aria-live="polite" aria-label={label}>
      {Array.from({ length: count }, (_, i) => <Card key={i} />)}
    </div>
  )
}

/* -------------------------------------------------------- detail pages --- */

function DetailRowSkeleton() {
  return (
    <div className="flex gap-3">
      <Bone className="w-9 h-9 shrink-0 rounded-xl" />
      <div className="flex-1">
        <Bone className="h-3 w-16 mb-2" />
        <Bone className="h-4 w-full" />
      </div>
    </div>
  )
}

function ChipCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Bone className="w-5 h-5 rounded" />
        <Bone className="h-5 w-32" />
      </div>
      <div className="space-y-3">
        <Bone className="h-4 w-11/12" />
        <Bone className="h-4 w-4/5" />
        <Bone className="h-4 w-5/6" />
        <Bone className="h-4 w-3/4" />
      </div>
    </div>
  )
}

export function ProductDetailSkeleton() {
  return (
    <div className="pt-20 pb-16 bg-background" role="status" aria-live="polite" aria-label="Loading product">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center gap-2 mb-8">
          <Bone className="h-4 w-12" /><Bone className="h-4 w-2" />
          <Bone className="h-4 w-16" /><Bone className="h-4 w-2" />
          <Bone className="h-4 w-28" />
        </div>

        <div className="grid lg:grid-cols-2 gap-10 mb-14">
          <div aria-hidden="true" className="rounded-2xl overflow-hidden aspect-[4/3] animate-pulse bg-muted" />
          <div>
            <div className="flex gap-2 mb-4">
              <Bone className="h-6 w-32 rounded-full" />
              <Bone className="h-6 w-28 rounded-full" />
            </div>
            <Bone className="h-10 w-3/4 mb-4" />
            <Bone className="h-4 w-full mb-2" />
            <Bone className="h-4 w-full mb-2" />
            <Bone className="h-4 w-5/6 mb-8" />
            <div className="grid sm:grid-cols-2 gap-5 mb-8">
              <DetailRowSkeleton /><DetailRowSkeleton />
              <DetailRowSkeleton /><DetailRowSkeleton />
            </div>
            <div className="flex gap-3">
              <Bone className="h-12 w-44 rounded-full" />
              <Bone className="h-12 w-32 rounded-full" />
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-14">
          <ChipCardSkeleton /><ChipCardSkeleton /><ChipCardSkeleton />
        </div>

        <Bone className="h-8 w-48 mb-6" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5">
              <Bone className="h-5 w-2/3 mb-2" />
              <Bone className="h-4 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function BlogPostSkeleton() {
  return (
    <div className="pt-20 pb-16 bg-background min-h-screen" role="status" aria-live="polite" aria-label="Loading post">
      <div className="container mx-auto px-4 md:px-6">
        <Bone className="h-4 w-24 mb-8" />
        <Bone className="h-10 w-full max-w-3xl mb-2" />
        <Bone className="h-10 w-2/3 max-w-3xl mb-4" />
        <div className="flex items-center gap-4 mb-8">
          <Bone className="h-4 w-28" /><Bone className="h-4 w-20" /><Bone className="h-4 w-36" />
        </div>
        <div aria-hidden="true" className="rounded-2xl overflow-hidden mb-10 aspect-[16/9] max-w-4xl animate-pulse bg-muted" />
        <div className="max-w-3xl space-y-3">
          <Bone className="h-4 w-full" /><Bone className="h-4 w-full" /><Bone className="h-4 w-11/12" />
          <Bone className="h-7 w-1/2 mt-8 mb-3" />
          <Bone className="h-4 w-full" /><Bone className="h-4 w-full" /><Bone className="h-4 w-4/5" />
          <Bone className="h-7 w-2/5 mt-8 mb-3" />
          <Bone className="h-4 w-full" /><Bone className="h-4 w-5/6" />
        </div>
      </div>
    </div>
  )
}
