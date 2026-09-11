import FieldsAdmin from './FieldsAdmin'

export default function QuoteFieldsAdmin() {
  return <FieldsAdmin base="/quote-fields" eyebrow="Sales" title="Quote fields" noun="quotes" backTo="/staff360/quotes" backLabel="Quotes"
    description="Extra details every quote carries — Incoterm, port, payment terms. They appear in the builder, on the PDF and on the client's online view." />
}
