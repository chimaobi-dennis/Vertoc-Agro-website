import { lazy, Suspense, useEffect } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import About from './pages/About'
import Services from './pages/Services'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Sustainability from './pages/Sustainability'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import Gallery from './pages/Gallery'
import Contact from './pages/Contact'
import Quote from './pages/Quote'
import NotFound from './pages/NotFound'
import QuoteView from './pages/QuoteView'
import Testimonials from './pages/Testimonials'
import Industries from './pages/Industries'
import WhyChooseUs from './pages/WhyChooseUs'
import Process from './pages/Process'
import Faq from './pages/Faq'
import Disclaimer from './pages/Disclaimer'
import TermsOfService from './pages/TermsOfService'
import PrivacyPolicy from './pages/PrivacyPolicy'
import { SiteProvider } from './lib/site'
import { EditingProvider } from './lib/editing'
import { SupplierProvider } from './lib/supplier'
import Bidding from './pages/Bidding'
import BiddingDetail from './pages/BiddingDetail'
import PurchaseOrderView from './pages/PurchaseOrderView'

// Code-split: public visitors never download the admin panel.
const AdminApp = lazy(() => import('./admin/AdminApp'))
// …nor the supplier portal, until they open it.
const SupplierApp = lazy(() => import('./supplier/SupplierApp'))
// …nor the client portal and the investment portal.
const ClientApp = lazy(() => import('./client/ClientApp'))
const InvestorApp = lazy(() => import('./investor/InvestorApp'))
const Invest = lazy(() => import('./pages/Invest'))
const InvestTerms = lazy(() => import('./pages/Invest').then(m => ({ default: m.InvestTerms })))
const InvestExtraPage = lazy(() => import('./pages/Invest').then(m => ({ default: m.InvestExtraPage })))
const portalFallback = <main className="flex-grow"><div className="min-h-screen bg-background" /></main>

/** Procurement pages know whether a supplier is signed in (to fill in the bid form, to open the portal). */
const WithSupplier = () => <SupplierProvider><Outlet /></SupplierProvider>

function LegacyAdminRedirect() {
  const { pathname, search, hash } = useLocation()
  return <Navigate to={pathname.replace(/^\/admin/, '/staff360') + search + hash} replace />
}

// The portals and private links are reached by their address only: keep them out of search engines too.
function Robots() {
  const { pathname } = useLocation()
  useEffect(() => {
    const hidden = /^\/(bidding|supplier|client|investor|invest|staff360|q|po)(\/|$)/.test(pathname)
    document.querySelector('meta[name="robots"]')?.setAttribute('content', hidden ? 'noindex, nofollow' : 'index, follow')
  }, [pathname])
  return null
}

export default function App() {
  return (
    <SiteProvider>
    <EditingProvider>
    <Robots />
    <Routes>
      <Route
        path="/staff360/*"
        element={<Suspense fallback={<div className="min-h-screen bg-background" />}><AdminApp /></Suspense>}
      />
      {/* The panel used to live at /admin; keep old links (and already-sent invite emails) working. */}
      <Route path="/admin/*" element={<LegacyAdminRedirect />} />
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/services" element={<Services />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:slug" element={<ProductDetail />} />
        <Route path="/sustainability" element={<Sustainability />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/blog/:slug" element={<BlogPost />} />
        <Route path="/gallery" element={<Gallery />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/quote" element={<Quote />} />
        <Route path="/q/:token" element={<QuoteView />} />
        <Route path="/po/:token" element={<PurchaseOrderView />} />
        <Route element={<WithSupplier />}>
          <Route path="/bidding" element={<Bidding />} />
          <Route path="/bidding/:number" element={<BiddingDetail />} />
          <Route path="/supplier/*" element={<Suspense fallback={<main className="flex-grow"><div className="min-h-screen bg-background" /></main>}><SupplierApp /></Suspense>} />
        </Route>
        <Route path="/client/*" element={<Suspense fallback={portalFallback}><ClientApp /></Suspense>} />
        <Route path="/investor/*" element={<Suspense fallback={portalFallback}><InvestorApp /></Suspense>} />
        <Route path="/invest" element={<Suspense fallback={portalFallback}><Invest /></Suspense>} />
        <Route path="/invest/terms" element={<Suspense fallback={portalFallback}><InvestTerms /></Suspense>} />
        <Route path="/invest/p/:slug" element={<Suspense fallback={portalFallback}><InvestExtraPage /></Suspense>} />
        <Route path="/testimonials" element={<Testimonials />} />
        <Route path="/industries" element={<Industries />} />
        <Route path="/industries/why-choose-us" element={<WhyChooseUs />} />
        <Route path="/process" element={<Process />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/disclaimer" element={<Disclaimer />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </EditingProvider>
    </SiteProvider>
  )
}
