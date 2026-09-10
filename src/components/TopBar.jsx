import { Clock, Mail, Phone } from 'lucide-react'
import { useSite, phoneHref } from '../lib/site'

export default function TopBar() {
  const site = useSite()
  return (
    <div className="bg-primary text-primary-foreground py-2.5">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-5">
            <a
              href={`mailto:${site.email}`}
              className="flex items-center gap-1.5 hover:text-accent transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{site.email}</span>
            </a>
            <a
              href={phoneHref(site.phone)}
              className="flex items-center gap-1.5 hover:text-accent transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{site.phone}</span>
            </a>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden md:inline">{site.hours}</span>
            <span className="md:hidden">{site.hours_short}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
