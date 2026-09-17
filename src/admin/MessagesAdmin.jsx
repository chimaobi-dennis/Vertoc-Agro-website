import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { adminFetch } from '../lib/adminApi'
import { useAuth } from './AuthContext'
import { Alert } from './ui'
import Conversations from './Conversations'

/** Every email thread with clients, mail-client style: list on the left, the thread as a chat on the right. */
export default function MessagesAdmin() {
  const { me } = useAuth()
  const [settings, setSettings] = useState(null)
  useEffect(() => { adminFetch('/settings').then(setSettings).catch(() => {}) }, [])
  return (
    // Edge to edge: cancel the page padding so the panes run from the top bar to the bottom of the window.
    <div className="-m-4 sm:-m-6 lg:-m-10 h-[calc(100dvh-4rem)] flex flex-col">
      {settings && !settings.email.inbound_configured && (
        <div className="px-4 pt-4 shrink-0"><Alert tone="info">Received emails aren't flowing in yet.{me?.permissions?.settings ? <> Connect Resend inbound under <Link to="/staff360/settings?tab=email" className="font-semibold text-accent">Settings → Email → Inbound</Link>.</> : ' Ask an admin to connect Resend inbound in Settings.'}</Alert></div>
      )}
      <Conversations useUrl title flush className="flex-1 min-h-0" />
    </div>
  )
}
