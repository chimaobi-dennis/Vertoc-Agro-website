import { MessageCircle } from 'lucide-react'
import { useSite, waHref } from '../lib/site'

export default function WhatsAppButton() {
  const site = useSite()
  return (
    <a
      href={waHref(site.whatsapp)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-hover transition-transform hover:scale-105"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  )
}
