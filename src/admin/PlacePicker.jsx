/* Origin / destination picker: a state capital or a port from the list, or
   any other place with its coordinates. Value: { name, state, lat, lng }. */
import { Field, Input, Select } from './ui'
import { NG_PORTS, NG_STATES } from '../lib/ngStates'

export const EMPTY_PLACE = { name: '', state: '', lat: null, lng: null }

export default function PlacePicker({ label, value, onChange, hint }) {
  const v = value || EMPTY_PLACE
  const key = v.preset ?? (v.name ? 'custom' : '')
  const choose = k => {
    if (!k) return onChange({ ...EMPTY_PLACE, preset: '' })
    if (k === 'custom') return onChange({ ...v, preset: 'custom' })
    const kind = k[0], name = k.slice(2)
    if (kind === 's') { const s = NG_STATES.find(x => x.state === name); if (s) onChange({ name: `${s.capital}, ${s.state}`, state: s.state, lat: s.lat, lng: s.lng, preset: k }) }
    else { const p = NG_PORTS.find(x => x.name === name); if (p) onChange({ name: p.name, state: p.state, lat: p.lat, lng: p.lng, preset: k }) }
  }
  const num = (k, raw) => onChange({ ...v, preset: 'custom', [k]: raw === '' ? null : Number(raw) })
  return (
    <Field label={label} hint={hint}>
      <div className="grid gap-2">
        <Select value={key} onChange={e => choose(e.target.value)}>
          <option value="">Choose a port or a state…</option>
          <optgroup label="Ports">{NG_PORTS.map(p => <option key={p.name} value={`p:${p.name}`}>{p.name}</option>)}</optgroup>
          <optgroup label="States (capital city)">{NG_STATES.map(s => <option key={s.state} value={`s:${s.state}`}>{s.state} — {s.capital}</option>)}</optgroup>
          <option value="custom">Somewhere else…</option>
        </Select>
        <Input value={v.name || ''} onChange={e => onChange({ ...v, name: e.target.value })} placeholder="Place name the client will see" />
        {key === 'custom' && (
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" step="0.00001" placeholder="Latitude" value={v.lat ?? ''} onChange={e => num('lat', e.target.value)} />
            <Input type="number" step="0.00001" placeholder="Longitude" value={v.lng ?? ''} onChange={e => num('lng', e.target.value)} />
          </div>
        )}
      </div>
    </Field>
  )
}
