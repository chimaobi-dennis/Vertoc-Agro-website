import { useEffect, useRef, useState } from 'react'

const DURATION = 1600

/*
 * Counts up to `value` the first time the tile scrolls into view.
 *
 * The original site animated these the same way, which is why a static
 * snapshot of the page captures every tile reading "0+" — the real numbers
 * only ever existed in JavaScript.
 */
export default function StatCounter({ icon: Icon, value, suffix = '+', label }) {
  const ref = useRef(null)
  const [display, setDisplay] = useState(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ? value
      : 0
  )

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }
    if (!('IntersectionObserver' in window)) {
      setDisplay(value)
      return
    }

    let raf
    const io = new IntersectionObserver(
      entries => {
        if (!entries[0].isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const tick = now => {
          const p = Math.min((now - start) / DURATION, 1)
          const eased = 1 - Math.pow(1 - p, 3) // ease-out cubic
          setDisplay(Math.round(value * eased))
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        raf = requestAnimationFrame(tick)
      },
      { threshold: 0.4 }
    )

    io.observe(el)
    return () => {
      io.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [value])

  return (
    <div
      ref={ref}
      className="bg-card border border-border rounded-2xl p-6 text-center hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover"
    >
      <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <Icon className="w-6 h-6 text-primary" />
      </div>
      <div className="text-3xl md:text-4xl font-bold text-foreground mb-1">
        {display}
        {suffix}
      </div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  )
}
