import { MessageCircle } from 'lucide-react'
import { CONTACT } from '../lib/nav'

export default function WhatsAppButton() {
  return (
    <a
      href={CONTACT.whatsapp}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-hover transition-transform hover:scale-105"
    >
      <MessageCircle className="h-6 w-6" />
    </a>
  )
}
