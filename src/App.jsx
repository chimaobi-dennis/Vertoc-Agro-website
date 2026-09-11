import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import { SiteProvider } from './lib/site'

// Code-split: public visitors never download the admin panel.
const AdminApp = lazy(() => import('./admin/AdminApp'))

function LegacyAdminRedirect() {
  const { pathname, search, hash } = useLocation()
  return <Navigate to={pathname.replace(/^\/admin/, '/staff360') + search + hash} replace />
}

export default function App() {
  return (
    <SiteProvider>
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
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
    </SiteProvider>
  )
}
