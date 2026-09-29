import { PageHeader } from './ui'
import BidsTable from './BidsTable'

/** Every bid, across all opportunities. */
export default function BidsAdmin() {
  return (
    <>
      <PageHeader eyebrow="Procurement" title="Bids" description="Every bid suppliers have submitted. Open an opportunity to compare its bids against the asking price." />
      <BidsTable />
    </>
  )
}
