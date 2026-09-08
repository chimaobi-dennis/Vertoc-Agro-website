import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

// Browser-style behaviour for a client-side router: every navigation starts
// at the top of the new page rather than inheriting the previous scroll.
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}
