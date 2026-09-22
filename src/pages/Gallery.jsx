import { useCallback, useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useSite } from '../lib/site'
import { Editable } from '../lib/editing'

/* Photos come from the site data (edited in place by signed-in staff). */

/** Full-screen viewer: arrows, keyboard, backdrop click and Escape all work. */
function Lightbox({ photos, index, onClose, onStep }) {
  const photo = photos[index]
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') onStep(1); if (e.key === 'ArrowLeft') onStep(-1) }
    window.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose, onStep])
  return (
    <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={photo.title} onClick={onClose}>
      <button type="button" onClick={onClose} aria-label="Close" className="absolute top-4 right-4 w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"><X className="w-5 h-5" /></button>
      <button type="button" onClick={e => { e.stopPropagation(); onStep(-1) }} aria-label="Previous photo" className="absolute left-3 md:left-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
      <button type="button" onClick={e => { e.stopPropagation(); onStep(1) }} aria-label="Next photo" className="absolute right-3 md:right-6 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
      <figure className="max-w-5xl w-full" onClick={e => e.stopPropagation()}>
        <img key={photo.src} src={photo.src} alt={photo.alt} className="w-full max-h-[78vh] object-contain rounded-2xl animate-fade-in" />
        <figcaption className="text-center mt-4">
          <p className="text-white font-semibold">{photo.title}</p>
          <p className="text-white/70 text-sm">{photo.caption} · {index + 1} / {photos.length}</p>
        </figcaption>
      </figure>
    </div>
  )
}

export default function Gallery() {
  const site = useSite()
  const photos = site.gallery || []
  const [open, setOpen] = useState(null)   // index of the photo in the lightbox
  const close = useCallback(() => setOpen(null), [])
  const step = useCallback(d => setOpen(i => (i + d + photos.length) % photos.length), [photos.length])
  return (
    <main className="flex-grow">
      <div className="pt-20 pb-16 bg-background min-h-screen">
      <div className="container mx-auto px-4 md:px-6">
      <div className="text-center mb-12">
      <span className="text-sm font-semibold uppercase tracking-wider text-accent">Our Operations</span>
      <h1 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">Gallery</h1>
      <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">A glimpse into our farms, facilities, logistics, and daily operations across Nigeria.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {photos.map((ph, i) => (
      <Editable key={`${ph.src}-${i}`} section="gallery" index={i} label="photo">
      <button type="button" onClick={() => setOpen(i)} aria-label={`Open ${ph.title}: ${ph.alt}`} className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl group border border-border bg-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      <img src={ph.src} alt={ph.alt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
      <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/30 transition-colors duration-300">
      </div>
      <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <p className="text-white text-sm font-medium">{ph.title}</p>
      <p className="text-white/80 text-xs">{ph.caption}</p>
      </div>
      </button>
      </Editable>
      ))}
      <Editable section="gallery" add label="photo" className="aspect-[4/3]" />
      </div>
      </div>
      </div>
      {open !== null && photos[open] && <Lightbox photos={photos} index={open} onClose={close} onStep={step} />}
    </main>
  )
}
