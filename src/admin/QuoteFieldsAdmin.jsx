import FieldsAdmin from './FieldsAdmin'

export default function QuoteFieldsAdmin() {
  return <FieldsAdmin base="/quote-fields" eyebrow="Sales" title="Invoice fields" noun="invoices" backTo="/staff360/quotes" backLabel="Invoices"
    description="Extra details every invoice carries — Incoterm, port, payment terms. They appear in the builder, on the PDF and on the client's online view." />
}
