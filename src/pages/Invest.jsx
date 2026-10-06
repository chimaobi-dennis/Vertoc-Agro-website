/* The investment portal's landing page. Reached by its link only: nothing on the site points to it. */
import { Link } from 'react-router-dom'
import { ArrowRight, BarChart3, FileCheck2, ShieldCheck, Sprout } from 'lucide-react'

const STEPS = [
  [ShieldCheck, 'Register and verify', 'Open an investor account, confirm your email address and upload your identification. We verify every investor.'],
  [Sprout, 'Choose an opportunity', 'Each opportunity states its minimum amount, its tenor and the return we expect. Read the terms and apply for the amount you choose.'],
  [FileCheck2, 'Fund and get approved', 'Our team reviews your application and sends the payment details. Your investment starts once your payment is confirmed.'],
  [BarChart3, 'Follow it to maturity', 'Your dashboard shows the status, the maturity date, the returns paid and the full history of every investment.'],
]

export default function Invest() {
  return (
    <main className="flex-grow">
      <section className="pt-36 pb-16 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl text-center">
          <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-4">Investment portal</span>
          <h1 className="font-serif text-4xl md:text-5xl font-bold tracking-tight">Invest in agricultural trade with Vertoc Agro</h1>
          <p className="mt-5 text-lg text-primary-foreground/80 leading-relaxed">Fund real commodity cycles, sourced from Nigerian farms and delivered to buyers we already work with. Each opportunity has a stated minimum, tenor and expected return, and you follow your money from the first day to maturity.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/investor/register" className="inline-flex items-center gap-2 h-12 px-7 rounded-full bg-accent text-accent-foreground font-semibold hover:bg-accent/90">Register as an investor<ArrowRight className="w-4 h-4" /></Link>
            <Link to="/investor/login" className="inline-flex items-center gap-2 h-12 px-7 rounded-full border border-primary-foreground/30 font-semibold hover:bg-primary-foreground/10">Investor sign-in</Link>
          </div>
        </div>
      </section>
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <h2 className="font-serif text-3xl font-bold text-foreground text-center mb-10">How it works</h2>
          <ol className="grid sm:grid-cols-2 gap-5">
            {STEPS.map(([Icon, title, text], i) => (
              <li key={title} className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-3"><span className="w-10 h-10 rounded-xl bg-accent/15 text-accent flex items-center justify-center"><Icon className="w-5 h-5" /></span><span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Step {i + 1}</span></div>
                <h3 className="font-semibold text-lg text-foreground">{title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>
          <p className="text-xs text-muted-foreground mt-10 max-w-3xl mx-auto text-center leading-relaxed">Investing puts your money at risk. Expected returns are estimates, not guarantees, and you may get back less than you put in. Opportunities are shown to registered investors only. Read the terms of each opportunity and take independent advice if you are unsure.</p>
        </div>
      </section>
    </main>
  )
}
