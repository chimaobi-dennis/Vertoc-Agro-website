import FieldsAdmin from './FieldsAdmin'

export default function ClientFieldsAdmin() {
  return <FieldsAdmin base="/client-fields" eyebrow="CRM" title="Client fields" noun="clients" backTo="/admin/clients" backLabel="Clients"
    description="Decide what you track for each client. The form, the table and the exports all follow this list." />
}
