import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './AuthContext'
import { AdminThemeProvider } from './AdminTheme'
import AdminLayout from './AdminLayout'
import Login from './Login'
import SetPassword from './SetPassword'
import Dashboard from './Dashboard'
import ProductsAdmin from './ProductsAdmin'
import ProductForm from './ProductForm'
import PostsAdmin from './PostsAdmin'
import ReviewsAdmin from './ReviewsAdmin'
import ShipmentDetail from './ShipmentDetail'
import TendersAdmin from './TendersAdmin'
import TenderForm from './TenderForm'
import BidsAdmin from './BidsAdmin'
import BidDetail from './BidDetail'
import SuppliersAdmin from './SuppliersAdmin'
import SupplierDetail from './SupplierDetail'
import PurchaseOrdersAdmin from './PurchaseOrdersAdmin'
import PurchaseOrderForm from './PurchaseOrderForm'
import ProcurementMessages from './ProcurementMessages'
import PostForm from './PostForm'
import UsersAdmin from './UsersAdmin'
import UserDetail from './UserDetail'
import AuditLog from './AuditLog'
import ClientsAdmin from './ClientsAdmin'
import ClientDetail from './ClientDetail'
import ClientFieldsAdmin from './ClientFieldsAdmin'
import EnquiriesAdmin from './EnquiriesAdmin'
import EnquiryDetail from './EnquiryDetail'
import QuotesAdmin from './QuotesAdmin'
import ApprovalsAdmin from './ApprovalsAdmin'
import QuoteForm from './QuoteForm'
import QuoteFieldsAdmin from './QuoteFieldsAdmin'
import SettingsAdmin from './SettingsAdmin'
import MessagesAdmin from './MessagesAdmin'
import MessageDetail from './MessageDetail'
import TemplatesAdmin from './TemplatesAdmin'
import TemplateEditor from './TemplateEditor'
import DeliveriesAdmin from './DeliveriesAdmin'
import PaymentsAdmin from './PaymentsAdmin'
import { InvestmentsAdmin, OpportunityForm, InvestmentDetail, InvestorsAdmin, InvestorDetail } from './Investments'
import ReportsAdmin from './ReportsAdmin'
import { Button, Card, Alert } from './ui'

const Splash = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-12 h-12 rounded-2xl bg-accent/20 animate-pulse" />
  </div>
)

/* Signed in, but the backend refused the profile (inactive, or created outside the panel). */
function Blocked({ reason }) {
  const { signOut } = useAuth()
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 space-y-4">
        <h1 className="font-serif text-2xl font-bold text-foreground">Access not enabled</h1>
        <Alert>{reason || 'Your account cannot use the admin panel yet.'}</Alert>
        <Button variant="outline" onClick={signOut}>Sign out</Button>
      </Card>
    </div>
  )
}

function RequireAuth({ children }) {
  const { session, me, loading, error } = useAuth(); const loc = useLocation()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/staff360/login" state={{ from: loc.pathname + loc.search }} replace />
  if (!me) return <Blocked reason={error} />
  return children
}

function RequireRole({ perm, children }) {
  const { me } = useAuth()
  return me?.permissions?.[perm] ? children : <Alert>Your role doesn't have access to this section.</Alert>
}

const OldUserLink = () => <Navigate to={`/staff360/staff/${useParams().id}`} replace />

const P = (perm, el) => <RequireRole perm={perm}>{el}</RequireRole>

export default function AdminApp() {
  return (
    <AdminThemeProvider>
    <AuthProvider>
      <Routes>
        <Route path="login" element={<Login />} />
        <Route path="set-password" element={<SetPassword />} />
        <Route element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="products" element={P('content', <ProductsAdmin />)} />
          <Route path="products/new" element={P('content', <ProductForm />)} />
          <Route path="products/:slug" element={P('content', <ProductForm />)} />
          <Route path="posts" element={P('content', <PostsAdmin />)} />
          <Route path="reviews" element={P('content', <ReviewsAdmin />)} />
          <Route path="posts/new" element={P('content', <PostForm />)} />
          <Route path="posts/:slug" element={P('content', <PostForm />)} />
          <Route path="staff" element={P('staff', <UsersAdmin />)} />
          <Route path="staff/:id" element={P('staff', <UserDetail />)} />
          <Route path="users" element={<Navigate to="/staff360/staff" replace />} />
          <Route path="users/:id" element={<OldUserLink />} />
          <Route path="clients" element={P('clients', <ClientsAdmin />)} />
          <Route path="clients/new" element={P('clients', <ClientDetail />)} />
          <Route path="clients/fields" element={P('clients', <ClientFieldsAdmin />)} />
          <Route path="clients/:id" element={P('clients', <ClientDetail />)} />
          <Route path="approvals" element={<ApprovalsAdmin />} />
          <Route path="quotes" element={P('invoices', <QuotesAdmin />)} />
          <Route path="quotes/new" element={P('invoices', <QuoteForm />)} />
          <Route path="quotes/fields" element={P('invoices', <QuoteFieldsAdmin />)} />
          <Route path="quotes/:id" element={P('invoices', <QuoteForm />)} />
          <Route path="quotes/:id/shipments/:sid" element={P('shipments', <ShipmentDetail />)} />
          <Route path="messages" element={P('messages', <MessagesAdmin />)} />
          <Route path="messages/:id" element={P('messages', <MessageDetail />)} />
          <Route path="templates" element={P('settings', <TemplatesAdmin />)} />
          <Route path="templates/:key" element={P('settings', <TemplateEditor />)} />
          <Route path="settings" element={P('settings', <SettingsAdmin />)} />
          <Route path="enquiries" element={P('enquiries', <EnquiriesAdmin />)} />
          <Route path="enquiries/:id" element={P('enquiries', <EnquiryDetail />)} />
          {/* procurement: the sourcing leg */}
          <Route path="tenders" element={P('bidding', <TendersAdmin />)} />
          <Route path="tenders/new" element={P('bidding', <TenderForm />)} />
          <Route path="tenders/:id" element={P('bidding', <TenderForm />)} />
          <Route path="bids" element={P('bidding', <BidsAdmin />)} />
          <Route path="bids/:id" element={P('bidding', <BidDetail />)} />
          <Route path="suppliers" element={P('suppliers', <SuppliersAdmin />)} />
          <Route path="suppliers/new" element={P('suppliers', <SupplierDetail />)} />
          <Route path="suppliers/:id" element={P('suppliers', <SupplierDetail />)} />
          <Route path="purchase-orders" element={P('purchase_orders', <PurchaseOrdersAdmin />)} />
          <Route path="purchase-orders/new" element={P('purchase_orders', <PurchaseOrderForm />)} />
          <Route path="purchase-orders/:id" element={P('purchase_orders', <PurchaseOrderForm />)} />
          <Route path="procurement/messages" element={P('supplier_messages', <ProcurementMessages />)} />
          <Route path="procurement/messages/:id" element={P('supplier_messages', <MessageDetail scope="procurement" />)} />
          <Route path="deliveries" element={P('shipments', <DeliveriesAdmin />)} />
          <Route path="payments" element={P('payments', <PaymentsAdmin />)} />
          <Route path="investments" element={P('investments', <InvestmentsAdmin />)} />
          <Route path="investments/opportunities/:id" element={P('investments', <OpportunityForm />)} />
          <Route path="investments/:id" element={P('investments', <InvestmentDetail />)} />
          <Route path="investors" element={P('investments', <InvestorsAdmin />)} />
          <Route path="investors/:id" element={P('investments', <InvestorDetail />)} />
          <Route path="reports" element={P('reports', <ReportsAdmin />)} />
          <Route path="audit" element={P('audit', <AuditLog />)} />
          <Route path="*" element={<Navigate to="/staff360" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
    </AdminThemeProvider>
  )
}
