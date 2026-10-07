/*
 * Storage driver selection.
 *
 * Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both set;
 * otherwise the local SQLite file, so development needs no network or keys.
 *
 * SQLite is a development convenience only. On a serverless platform the
 * filesystem is ephemeral and not shared between invocations, so a SQLite
 * fallback there would appear to work, then quietly lose every write. We fail
 * loudly instead.
 */
const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

// Vercel/Netlify/Lambda all set one of these.
const serverless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY
)
const production = process.env.NODE_ENV === 'production'

if (!hasSupabase && (serverless || production)) {
  throw new Error(
    'No database configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
    'The SQLite fallback is for local development only — a serverless ' +
    'filesystem is ephemeral, so writes would be silently discarded.'
  )
}

export const driver = hasSupabase ? 'supabase' : 'sqlite'

const store = hasSupabase
  ? await import('./supabase.js')
  : await import('./sqlite.js')

export const {
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  listPosts, getPost, createPost, updatePost, deletePost,
  createEnquiry, getEnquiry, listEnquiries, updateEnquiryStatus, updateEnquiry,
  listClientFields, getClientField, createClientField, updateClientField, deleteClientField, reorderClientFields,
  listClients, getClient, createClient, updateClient, deleteClient, listClientEnquiries,
  // Phase 3
  listQuoteFields, getQuoteField, createQuoteField, updateQuoteField, deleteQuoteField, reorderQuoteFields,
  getSettings, updateSettings, readSecrets, writeSecret,
  createDocument, completeDocument, getDocument, listDocuments, documentUrl, downloadDocument, deleteDocument,
  listQuotes, getQuote, getQuoteByToken, createQuote, updateQuote, deleteQuote, markQuoteSent, markQuoteViewed, respondToQuote, publicQuote, convertQuoteToPurchase,
  listShipments, getShipment, createShipment, updateShipment, deleteShipment, addCheckpoint, updateCheckpoint, deleteCheckpoint, publicShipment, SHIPMENT_STATUSES, SHIPMENT_MODES, SHIPMENTS_MIGRATION_HINT, SHIPMENT_DETAILS_HINT, SHIPMENT_DEPARTURE_HINT,
  createMessage, updateMessage, getMessage, listMessages, markMessageRead, getMessageByProviderId, latestOutboundTo, countUnreadInbound, findClientByEmail, getQuoteByNumber,
  listThreads, getThread, markThreadRead, splitQuoted, parseThreadKey, threadKeyOf, cleanSubject, hasScopeColumn, MESSAGE_SCOPES,
  getLabelCatalogue, setLabelCatalogue, setThreadLabel, LABEL_COLORS, DEFAULT_LABELS,
  listDepartments, setDepartments, resolveSender,
  getHomepageStats, setHomepageStats, DEFAULT_STATS, STAT_ICON_NAMES,
  getHomepageMarkets, setHomepageMarkets, DEFAULT_MARKETS, DEFAULT_REVIEWS,
  getCompanyProfile, setCompanyProfile, DEFAULT_ABOUT,
  getGallery, setGallery, getFaq, setFaq, getServices, setServices, DEFAULT_GALLERY, DEFAULT_FAQ, DEFAULT_SERVICES,
  getSustainability, setSustainability, DEFAULT_SUSTAINABILITY, POLICY_COLORS, getWhy, setWhy, DEFAULT_WHY, getHero, setHero, DEFAULT_HERO,
  listReviews, listApprovedReviews, getReview, createReview, updateReview, deleteReview, REVIEW_STATUSES, REVIEWS_MIGRATION_HINT,
  listTemplates, getTemplate, upsertTemplate, updateTemplate, createDocumentFromBuffer,
  listPurchases, getPurchase, createPurchase, updatePurchase, deletePurchase,
} = store

// Procurement (the sourcing leg) lives in its own module; Supabase only.
const procurement = hasSupabase ? await import('./procurement.js') : {}
export const {
  PROCUREMENT_MIGRATION_HINT, procurementStats,
  SUPPLIER_STATUSES, safeSupplier, listSuppliers, getSupplier, getSupplierByUser, findSupplierByEmail, createSupplier, updateSupplier, deleteSupplier,
  issueSupplierToken, supplierForToken, attachSupplierAccount, markSupplierVerified,
  TENDER_STATUSES, TENDER_PREFIX, tenderState, listTenders, getTender, createTender, updateTender, deleteTender, publicTender, listPublicTenders, getPublicTender,
  BID_STATUSES, BID_LABELS, BID_DECLARATION, BID_MAX_FILES, createBid, bidForUploadToken, countBidFiles, listBids, getBid, updateBid, deleteBid, closeOutTender,
  askBid, deleteBidRequest, publicBid, listSupplierBids, getSupplierBid, withdrawBid, answerBidRequest,
  PO_KINDS, PO_KIND_LABELS, PO_PREFIX, PO_STATUSES, listPurchaseOrders, getPurchaseOrder, getPurchaseOrderByToken, getPurchaseOrderByNumber,
  UPGRADE_HINT, awardSummary, unlockBid, lockBid, reviseBid,
  PO_SHIPMENT_STATUSES, listPoShipments, getPoShipment, fulfilment, createPoShipment, updatePoShipment, reportPoShipment, deletePoShipment, publicPoShipment,
  createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, markPurchaseOrderIssued, markPurchaseOrderViewed, respondToPurchaseOrder, publicPurchaseOrder, listSupplierOrders,
} = procurement

// Email codes, portal notifications, client accounts and payments, investments (migration 015).
const portals = hasSupabase ? await import('./portals.js') : {}
export const {
  PORTALS_HINT, OTP_MINUTES, issueOtp, consumeOtp, maskEmail, notify, listNotifications, readNotifications,
  issueAccountToken, accountForToken, clearAccountToken, attachAccountUser, setAccountEmail, accountByUser, accountByEmail, markAccountVerified,
  COVER_LABEL, opportunityCovers, setDocumentLabel,
  publicClient, findClientRecordByEmail, createClientAccount, attachClientAccount, detachClientAccount, updateClientAccount,
  PAYMENT_STATUSES, listPayments, getPayment, createPayment, setPaymentReceipt, updatePayment, deletePayment, paidByQuote, listClientInvoices,
  OPPORTUNITY_STATUSES, INVESTMENT_STATUSES, INVESTMENT_LABELS, opportunityState, listOpportunities, getOpportunity, createOpportunity, updateOpportunity, deleteOpportunity, publicOpportunity,
  KYC_STATUSES, INVESTOR_TITLES, CONTROLLED_FIELDS, safeInvestor, publicInvestor, createInvestor, updateInvestor, attachInvestorAvatar, getInvestor, deleteInvestor, listInvestors,
  listInvestments, getInvestment, createInvestment, updateInvestment, setInvestmentProof, deleteInvestment, addPayout, deletePayout, publicInvestment, investmentTotals,
} = portals

// Approval workflow and amendments (migration 016).
const approvals = hasSupabase ? await import('./approvals.js') : {}
export const {
  APPROVAL_HINT, APPROVAL_TABLES, APPROVAL_MODULE, getApproval, stampSubmission, resubmit, decide, listPending, countPending,
  createAmendment, listAmendments, getAmendment, closeAmendment,
} = approvals

// Inventory: goods received against approved orders (migration 017).
const inventory = hasSupabase ? await import('./inventory.js') : {}
export const {
  INVENTORY_HINT, INVENTORY_STATUSES, INVENTORY_LABELS, listExpected, getExpected, grnData, receive, deleteReceipt, setClosed, stock, inventoryCounts,
} = inventory

// Investor profile change requests (migration 019).
const investorChanges = hasSupabase ? await import('./investor-changes.js') : {}
export const {
  CHANGES_HINT, SUPPORT_LABEL, PICTURE_LABEL, REQUEST_STATUSES, REQUEST_LABELS, CHANGE_GROUPS, changeMeta, createRequest, listRequests, getRequest, pendingRequests, cancelRequest, reviewRequest,
} = investorChanges

// Bid invitations sent to suppliers (migration 020).
const tenderNotices = hasSupabase ? await import('./tender-notices.js') : {}
export const { NOTICES_HINT, listNotices, recordNotice, biddersOf } = tenderNotices
