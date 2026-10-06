/* Labels shared by the staff panel and the investor portal. */
export const INVESTMENT_STATUSES = ['pending', 'active', 'matured', 'paid_out', 'rejected', 'cancelled']
export const INVESTMENT_LABELS = { pending: 'Awaiting approval', active: 'Active', matured: 'Matured', paid_out: 'Paid out', rejected: 'Not approved', cancelled: 'Cancelled' }
export const investmentTone = s => ({ pending: 'amber', active: 'green', matured: 'accent', paid_out: 'blue', rejected: 'red', cancelled: 'muted' })[s] || 'muted'
export const OPPORTUNITY_LABELS = { draft: 'Draft', upcoming: 'Opens soon', open: 'Open', closed: 'Closed', cancelled: 'Cancelled', published: 'Published' }
export const opportunityTone = s => ({ draft: 'muted', upcoming: 'blue', open: 'green', closed: 'muted', cancelled: 'red' })[s] || 'muted'
export const KYC_LABELS = { pending: 'KYC pending', verified: 'KYC verified', rejected: 'KYC rejected' }
export const kycTone = s => ({ pending: 'amber', verified: 'green', rejected: 'red' })[s] || 'muted'
export const tenor = m => (m % 12 === 0 && m >= 12 ? `${m / 12} year${m === 12 ? '' : 's'}` : `${m} month${m === 1 ? '' : 's'}`)
export const ID_TYPES = ['National ID (NIN)', 'International passport', "Driver's licence", "Voter's card", 'Company registration (CAC)']
