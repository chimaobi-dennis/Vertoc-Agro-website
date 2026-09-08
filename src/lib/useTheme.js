import { useCallback, useEffect, useState } from 'react'

const KEY = 'vertoc-theme'

/*
 * Tailwind is configured for class-based dark mode, so the toggle just owns
 * the `dark` class on <html>. index.html applies the stored value before
 * first paint; this hook keeps React in sync with it afterwards.
 */
export function useTheme() {
  const [theme, setTheme] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
      ? 'dark'
      : 'light'
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* private mode — the in-memory value still drives the session */
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'))
  }, [])

  return { theme, toggle, isDark: theme === 'dark' }
}
