import { Link, useParams } from 'react-router-dom'
import {
  ArrowRight, CircleCheckBig, FileCheck, MapPin, Package, ShieldCheck, TrendingUp,
} from 'lucide-react'
import { useApi } from '../lib/api'
import { Loading, ErrorState } from '../components/PageState'

function DetailRow({ icon: Icon, label, value }) {
  if (!value) return null
  return (
    <div className="flex gap-3">
      <div className="w-9 h-9 shrink-0 bg-primary/10 rounded-xl flex items-center justify-center">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
          {label}
        </p>
        <p className="text-sm text-foreground leading-relaxed">{value}</p>
      </div>
    </div>
  )
}

function Chips({ icon: Icon, heading, items }) {
  if (!items?.length) return null
  return (
    <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-5 h-5 text-accent" />
        <h3 className="text-lg font-bold text-foreground">{heading}</h3>
      </div>
      <div className="space-y-2.5">
        {items.map(item => (
          <div key={item} className="flex items-center gap-2 text-sm text-foreground/80">
            <CircleCheckBig className="w-4 h-4 text-accent shrink-0" />
            {item}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProductDetail() {
  const { slug } = useParams()
  const { data: product, error, loading } = useApi(`/products/${slug}`, [slug])
  const { data: all } = useApi('/products')

  if (loading) return <main className="flex-grow"><Loading label="Loading product…" /></main>
  if (error) return <main><ErrorState error={error} /></main>
  if (!product) return null

  const related = (all || []).filter(p => p.slug !== product.slug).slice(0, 3)

  return (
    <main>
      <div className="pt-20 pb-16 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <nav className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
            <Link to="/" className="hover:text-accent transition-colors">Home</Link>
            <span>/</span>
            <Link to="/products" className="hover:text-accent transition-colors">Products</Link>
            <span>/</span>
            <span className="text-foreground font-medium">{product.name}</span>
          </nav>

          <div className="grid lg:grid-cols-2 gap-10 mb-14">
            <div className="rounded-2xl overflow-hidden shadow-card aspect-[4/3]">
              <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
                  {product.category.toUpperCase()} COMMODITY
                </span>
                {product.featured && (
                  <span className="inline-flex items-center gap-1 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
                    <TrendingUp className="w-3 h-3" />
                    HOT PRODUCT
                  </span>
                )}
              </div>

              <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
                {product.name}
              </h1>
              <p className="text-muted-foreground leading-relaxed mb-8">{product.description}</p>

              <div className="grid sm:grid-cols-2 gap-5 mb-8">
                <DetailRow icon={MapPin} label="Origin" value={product.origin} />
                <DetailRow icon={Package} label="Processing" value={product.processing} />
                <DetailRow icon={Package} label="Packaging" value={product.packaging} />
                <DetailRow icon={FileCheck} label="MOQ" value={product.moq} />
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to="/quote"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-7 h-12 text-sm font-semibold text-accent-foreground hover:opacity-90 transition-opacity"
                >
                  Request a Quote <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to="/contact"
                  className="inline-flex items-center justify-center rounded-full border border-border bg-card px-7 h-12 text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Contact Us
                </Link>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-14">
            <Chips icon={Package} heading="Applications" items={product.applications} />
            <Chips icon={ShieldCheck} heading="Certifications" items={product.certifications} />

            <div className="bg-card border border-border rounded-2xl p-6 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <FileCheck className="w-5 h-5 text-accent" />
                <h3 className="text-lg font-bold text-foreground">Specification</h3>
              </div>
              <dl className="space-y-3 text-sm">
                {product.grade && (
                  <div>
                    <dt className="text-muted-foreground mb-0.5">Grade / Spec</dt>
                    <dd className="text-foreground font-medium">{product.grade}</dd>
                  </div>
                )}
                {product.hs_code && (
                  <div>
                    <dt className="text-muted-foreground mb-0.5">HS Code</dt>
                    <dd className="text-foreground font-medium">{product.hs_code}</dd>
                  </div>
                )}
                <div>
                  <dt className="text-muted-foreground mb-0.5">Category</dt>
                  <dd className="text-foreground font-medium">{product.category} Commodity</dd>
                </div>
              </dl>
            </div>
          </div>

          {!!related.length && (
            <div>
              <h2 className="font-serif text-2xl font-bold text-foreground mb-6">Related Products</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {related.map(p => (
                  <Link
                    key={p.slug}
                    to={`/products/${p.slug}`}
                    className="bg-card border border-border rounded-2xl p-5 hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover"
                  >
                    <h4 className="text-base font-bold text-foreground mb-1">{p.name}</h4>
                    <p className="text-sm text-muted-foreground">{p.grade || p.summary}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
