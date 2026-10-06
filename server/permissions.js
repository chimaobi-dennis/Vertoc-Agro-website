/*
 * Staff permissions: what each role may do, module by module, action by
 * action. Kept in one place so the server (which enforces them on every
 * request) and the panel (which only hides what a person cannot use) read
 * the same table.
 *
 * A staff member's permissions are, in order: their own set
 * (profiles.permissions) if one was given, else their role's — a built-in
 * role below or a custom one from the staff_roles table.
 */
export const ACTIONS = ['view', 'create', 'edit', 'approve', 'delete', 'export', 'award', 'unlock', 'manage']
export const ACTION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', approve: 'Approve', delete: 'Delete', export: 'Export', award: 'Award', unlock: 'Unlock', manage: 'Manage' }

/** Every module, with the actions that mean something in it. */
export const MODULES = {
  content:           { label: 'Website content', hint: 'Products, blog, reviews, editing the public pages', actions: ['view', 'create', 'edit', 'delete'] },
  enquiries:         { label: 'Enquiries', hint: 'Quote requests and contact messages', actions: ['view', 'edit', 'delete'] },
  invoices:          { label: 'Invoices', hint: 'Approve = approve invoices and amendments made by others. View-only staff do not see amounts', actions: ['view', 'create', 'edit', 'approve', 'delete', 'export'] },
  shipments:         { label: 'Shipments', hint: 'Invoice shipments and supplier deliveries. Approve = confirm a delivery', actions: ['view', 'create', 'edit', 'approve', 'delete'] },
  clients:           { label: 'Clients', hint: 'Records, documents, purchases. Approve = make a new client official', actions: ['view', 'create', 'edit', 'approve', 'delete', 'export'] },
  payments:          { label: 'Payments', hint: 'Approve = confirm or reject a payment', actions: ['view', 'create', 'edit', 'approve', 'delete', 'export'] },
  messages:          { label: 'Sales messages', hint: 'The inbox with clients', actions: ['view', 'create'] },
  bidding:           { label: 'Bidding', hint: 'Opportunities and bids', actions: ['view', 'create', 'edit', 'delete', 'export', 'award', 'unlock'] },
  purchase_orders:   { label: 'LPO / PO', hint: 'Approve = approve orders and amendments made by others. View-only staff do not see amounts', actions: ['view', 'create', 'edit', 'approve', 'delete', 'export'] },
  suppliers:         { label: 'Suppliers', hint: 'Records and documents. Approve = make a new supplier official', actions: ['view', 'create', 'edit', 'approve', 'delete', 'export'] },
  inventory:         { label: 'Inventory', hint: 'Goods received against approved orders', actions: ['view', 'create', 'edit', 'approve'] },
  supplier_messages: { label: 'Procurement messages', hint: 'The inbox with suppliers', actions: ['view', 'create'] },
  investments:       { label: 'Investments', hint: 'Opportunities, investors, applications, payouts', actions: ['view', 'create', 'edit', 'approve', 'delete', 'export'] },
  reports:           { label: 'Reports', hint: '', actions: ['view', 'export'] },
  staff:             { label: 'Staff', hint: 'Manage = roles and permissions', actions: ['view', 'create', 'edit', 'delete', 'manage'] },
  audit:             { label: 'Audit log', hint: '', actions: ['view', 'export'] },
  settings:          { label: 'System settings', hint: 'Settings and email templates', actions: ['view', 'edit'] },
}
export const MODULE_KEYS = Object.keys(MODULES)

const all = () => Object.fromEntries(MODULE_KEYS.map(m => [m, [...MODULES[m].actions]]))
const only = spec => Object.fromEntries(Object.entries(spec).map(([m, a]) => [m, a === '*' ? [...MODULES[m].actions] : a]))

/** Built-in roles. They cannot be edited; copy one into a custom role to adjust it. */
export const BUILT_IN_ROLES = {
  super_admin: { name: 'Super Admin', description: 'Full system access, including staff roles and permissions.', permissions: all() },
  admin: { name: 'Admin', description: 'Full system access: staff, permissions, bidding, clients, suppliers, investments, audit log and settings.', permissions: all() },
  procurement: { name: 'Procurement', description: 'Bidding, suppliers, LPO / PO and supplier deliveries; Sales, Logistics and Inventory to read. New orders, suppliers and clients wait for an admin to approve them.',
    permissions: only({ bidding: ['view', 'create', 'edit', 'delete', 'export', 'award'], purchase_orders: ['view', 'create', 'edit', 'delete', 'export'], suppliers: ['view', 'create', 'edit', 'delete', 'export'], supplier_messages: '*',
      shipments: ['view', 'create', 'edit', 'approve'], invoices: ['view'], clients: ['view', 'create', 'edit'], enquiries: ['view'], inventory: ['view'], reports: ['view'] }) },
  sales: { name: 'Sales', description: 'Enquiries, invoices, clients and the sales inbox; Procurement, Logistics and Inventory to read. New invoices, clients and suppliers wait for an admin to approve them.',
    permissions: only({ enquiries: '*', invoices: ['view', 'create', 'edit', 'delete', 'export'], shipments: ['view', 'create', 'edit'], clients: ['view', 'create', 'edit', 'export'], messages: '*', payments: ['view', 'create'],
      suppliers: ['view', 'create', 'edit'], purchase_orders: ['view'], bidding: ['view'], inventory: ['view'], reports: ['view'] }) },
  finance: { name: 'Finance', description: 'Invoices to read, payments to manage, financial reports.',
    permissions: only({ invoices: ['view', 'export'], payments: '*', clients: ['view'], purchase_orders: ['view', 'export'], investments: ['view', 'export'], reports: '*' }) },
  logistics: { name: 'Logistics', description: 'Client and supplier shipments: create, view, update locations and status. Orders and invoices are read-only and show no prices; no client list.',
    permissions: only({ shipments: ['view', 'create', 'edit'], purchase_orders: ['view'], invoices: ['view'], suppliers: ['view'] }) },
  inventory: { name: 'Inventory', description: 'Receive goods against approved orders and record what was accepted. Procurement, Sales and Logistics to read (no prices); the client list is read-only.',
    permissions: only({ inventory: ['view', 'create', 'edit'], purchase_orders: ['view'], suppliers: ['view'], clients: ['view'], invoices: ['view'], bidding: ['view'], enquiries: ['view'], shipments: ['view'] }) },
  investment: { name: 'Investment', description: 'Investment opportunities, investors and applications.',
    permissions: only({ investments: '*', reports: ['view'] }) },
  editor: { name: 'Editor', description: 'Products, blog, reviews and the public pages.', permissions: only({ content: '*' }) },
}
/** The old `role` enum, for accounts from before roles had keys. */
export const LEGACY_ROLE = { admin: 'super_admin', editor: 'editor', sales: 'sales', procurement: 'procurement' }
/** What the old enum column is set to for a role key, so older code keeps working. */
export const enumFor = key => (['super_admin', 'admin'].includes(key) ? 'admin' : ['editor', 'sales', 'procurement'].includes(key) ? key : 'editor')

/** Keep only modules and actions that exist. */
export function cleanPermissions(input) {
  const out = {}
  if (!input || typeof input !== 'object') return out
  for (const m of MODULE_KEYS) {
    const list = Array.isArray(input[m]) ? input[m] : []
    const ok = MODULES[m].actions.filter(a => list.includes(a))
    // Nothing works without seeing the module.
    if (ok.length && !ok.includes('view')) ok.unshift('view')
    if (ok.length) out[m] = ok
  }
  return out
}
export const has = (perms, module, action = 'view') => Boolean(perms?.[module]?.includes(action))
export const hasUser = (user, module, action = 'view') => has(user?.perms, module, action)
/**
 * Prices and totals are shown to anyone who works with money: who may create, edit, approve or export
 * invoices or orders, or see payments. Staff with view-only access (logistics, inventory) see the document without amounts.
 */
export const seesAmounts = perms => ['invoices', 'purchase_orders'].some(m => ['create', 'edit', 'approve', 'export'].some(a => has(perms, m, a))) || has(perms, 'payments', 'view')

/** The action a request needs when the route does not name one. */
export function actionFor(method, module) {
  const a = { GET: 'view', HEAD: 'view', POST: 'create', PUT: 'edit', PATCH: 'edit', DELETE: 'delete' }[method] || 'edit'
  const allowed = MODULES[module]?.actions || []
  // A module without that exact action (messages have no "edit") asks for the nearest write it does have.
  return allowed.includes(a) ? a : (a === 'view' ? 'view' : ['edit', 'create', 'view'].find(x => allowed.includes(x)))
}

/** Changes between two permission sets, for the audit log: { added: ['bidding:unlock'], removed: [...] }. */
export function diffPermissions(before = {}, after = {}) {
  const flat = p => new Set(Object.entries(p || {}).flatMap(([m, list]) => (list || []).map(a => `${m}:${a}`)))
  const a = flat(before), b = flat(after)
  return { added: [...b].filter(x => !a.has(x)).sort(), removed: [...a].filter(x => !b.has(x)).sort() }
}

/** The booleans the panel's menus use (kept under their old names too). */
export function menuFlags(perms) {
  const v = m => has(perms, m)
  const flags = Object.fromEntries(MODULE_KEYS.map(m => [m, v(m)]))
  // Logistics reaches invoices and orders only through shipments: no menu entries for them.
  if (!seesAmounts(perms) && has(perms, 'shipments', 'create')) { flags.invoices = false; flags.purchase_orders = false; flags.clients = false }
  return {
    ...flags,
    products: v('content'), posts: v('content'), frontpages: has(perms, 'content', 'edit'), users: v('staff'),
    quotes: v('invoices') || v('enquiries'), email: v('messages'),
    procurement: v('bidding') || v('purchase_orders') || v('suppliers') || v('supplier_messages'),
  }
}
