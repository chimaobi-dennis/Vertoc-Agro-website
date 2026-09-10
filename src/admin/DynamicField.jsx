import { Field, Input, Select, Textarea } from './ui'

/** Renders one user-defined client field by its type. */
export default function DynamicField({ field, value, onChange }) {
  const label = field.required ? `${field.label} *` : field.label
  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2 h-11 text-sm font-medium">
        <input type="checkbox" className="w-4 h-4" checked={Boolean(value)} onChange={e => onChange(e.target.checked)} />
        {field.label}
      </label>
    )
  }
  const common = { value: value ?? '', onChange: e => onChange(e.target.value), required: field.required }
  if (field.type === 'textarea') return <Field label={label} className="md:col-span-2"><Textarea rows={3} {...common} /></Field>
  if (field.type === 'select') {
    return (
      <Field label={label}>
        <Select {...common}>
          <option value="">Select…</option>
          {(field.options || []).map(o => <option key={o} value={o}>{o}</option>)}
        </Select>
      </Field>
    )
  }
  const type = { email: 'email', phone: 'tel', number: 'number', date: 'date', url: 'url' }[field.type] || 'text'
  return <Field label={label}><Input type={type} {...common} /></Field>
}
