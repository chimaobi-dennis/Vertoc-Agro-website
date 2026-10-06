import { useState } from 'react'
import { input } from '../supplier/ui'

export const TITLES = ['Mr.', 'Mrs.', 'Miss', 'Ms.', 'Dr.', 'Prof.', 'Chief', 'Alhaji', 'Alhaja', 'Barr.', 'Engr.', 'Rev.', 'Odogwu', 'Pastor']

/** A title from the list, or "Other" with a short title typed in (up to 5 letters). */
export function TitleInput({ value, onChange, disabled = false, required = false, titles = TITLES }) {
  const custom = Boolean(value) && !titles.includes(value)
  const [other, setOther] = useState(custom)
  return (
    <div className="flex gap-2">
      <select disabled={disabled} required={required} className={input} value={other || custom ? 'Other' : value || ''} onChange={e => { if (e.target.value === 'Other') { setOther(true); onChange('') } else { setOther(false); onChange(e.target.value) } }}>
        <option value="">Choose…</option>{titles.map(t => <option key={t}>{t}</option>)}<option value="Other">Other</option>
      </select>
      {(other || custom) && <input disabled={disabled} required={required} maxLength={5} pattern="[A-Za-z.]{1,5}" title="Up to 5 letters" placeholder="Title" className={`${input} max-w-[7rem]`} value={value || ''} onChange={e => onChange(e.target.value.replace(/[^A-Za-z.]/g, ''))} />}
    </div>
  )
}
