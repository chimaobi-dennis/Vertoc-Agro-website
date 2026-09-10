import { CheckCircle2 } from 'lucide-react'

const POINTS = [
  'Products, blog and enquiries in one place',
  'Role-based access for your whole team',
  'Every change recorded in the audit log',
]

/** Split-screen frame for the sign-in and set-password screens. */
export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-background">
      <aside className="relative hidden lg:flex flex-col justify-between p-12 xl:p-16 overflow-hidden text-white">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/assets/img/stock-1625246333195-78d9c38ad449-1920.jpg')" }}
        />
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-br from-primary/95 via-primary/85 to-accent/75" />
        <div aria-hidden="true" className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-accent/30 blur-3xl animate-float" />
        <div aria-hidden="true" className="absolute -bottom-32 -right-16 w-[28rem] h-[28rem] rounded-full bg-white/10 blur-3xl animate-float-slow" />

        <div className="relative">
          <img src="/assets/img/logo.png" alt="Vertoc Agro" className="h-9 brightness-0 invert" />
        </div>

        <div className="relative max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70 mb-4">Admin console</p>
          <h2 className="font-serif text-4xl xl:text-5xl font-bold leading-[1.1] mb-5">
            Growing the future, one harvest at a time.
          </h2>
          <p className="text-white/80 leading-relaxed mb-8">
            Manage your commodities, publish insights and follow every enquiry — from anywhere.
          </p>
          <ul className="space-y-3">
            {POINTS.map(p => (
              <li key={p} className="flex items-center gap-3 text-sm text-white/90">
                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />{p}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} Vertoc Agro Products Limited</p>
      </aside>

      <main className="flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md animate-fade-up">{children}</div>
      </main>
    </div>
  )
}
