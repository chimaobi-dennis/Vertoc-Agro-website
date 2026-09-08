import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import Header from './Header'
import Footer from './Footer'
import WhatsAppButton from './WhatsAppButton'
import ScrollToTop from './ScrollToTop'

export default function Layout() {
  return (
    <div className="flex flex-col min-h-screen">
      <ScrollToTop />
      <TopBar />
      <Header />
      <Outlet />
      <Footer />
      <WhatsAppButton />
    </div>
  )
}
