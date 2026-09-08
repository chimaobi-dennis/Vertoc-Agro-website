import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center py-32">
      <div className="container mx-auto px-4 md:px-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-accent mb-3">404</p>
        <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
          Page not found
        </h1>
        <p className="text-muted-foreground mb-8">
          The page you are looking for doesn&rsquo;t exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-full bg-accent px-8 h-12 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity"
        >
          Back to Home
        </Link>
      </div>
    </main>
  )
}
