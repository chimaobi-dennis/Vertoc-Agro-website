import { createContext, useCallback, useContext, useEffect, useState } from 'react'

const KEY = 'vertoc-admin-theme'
const Ctx = createContext(null)

/*
 * The admin panel owns its own theme and defaults to LIGHT, so the public
 * site's dark-mode toggle never bleeds into the dashboard. Leaving the admin
 * area restores whatever the public site had chosen.
 */
export function AdminThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(KEY) || 'light' } catch { return 'light' }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try { localStorage.setItem(KEY, theme) } catch { /* private mode */ }
  }, [theme])

  useEffect(() => () => {
    let pub = null
    try { pub = localStorage.getItem('vertoc-theme') } catch { /* ignore */ }
    document.documentElement.classList.toggle('dark', pub === 'dark')   // public site: light unless the visitor chose dark
  }, [])

  const toggle = useCallback(() => setTheme(t => (t === 'dark' ? 'light' : 'dark')), [])
  return <Ctx.Provider value={{ theme, toggle, isDark: theme === 'dark' }}>{children}</Ctx.Provider>
}

export const useAdminTheme = () => useContext(Ctx)
