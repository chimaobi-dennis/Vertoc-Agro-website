import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/** A password field with an eye button to show or hide what was typed. Hidden by default. */
export default function PasswordInput({ className = '', icon: Icon = null, ...p }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      {Icon && <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />}
      <input {...p} type={show ? 'text' : 'password'} className={`${className} pr-11 ${Icon ? 'pl-10' : ''}`} />
      <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} title={show ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}
