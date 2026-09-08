import { useMemo, useState } from 'react'
import { useApi } from '../lib/api'
import ProductCard from '../components/ProductCard'
import { ErrorState, Empty } from '../components/PageState'
import { CardGridSkeleton, ProductCardSkeleton } from '../components/Skeleton'

const FILTERS = ['All Products', 'Agro Commodities', 'Solid Minerals']
const matches = (product, filter) =>
  filter === 'All Products' || filter.toLowerCase().startsWith(product.category.toLowerCase())

export default function Products() {
  const { data: products, error, loading } = useApi('/products')
  const [filter, setFilter] = useState(FILTERS[0])

  const visible = useMemo(
    () => (products || []).filter(p => matches(p, filter)),
    [products, filter]
  )

  // Structured data is generated from the live catalogue, so it stays correct
  // as products are added or removed through Claude.
  const jsonLd = useMemo(() => {
    if (!products?.length) return null
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: 'Vertoc Agro Agricultural Products',
      description: 'Premium agricultural commodities for export from Nigeria',
      url: 'https://vertocagro.com/products',
      numberOfItems: products.length,
      itemListElement: products.map((p, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://vertocagro.com/products/${p.slug}`,
        name: p.name,
        description: p.description,
        image: p.image,
      })),
    })
  }, [products])

  return (
    <main className="flex-grow">
      {jsonLd && <script type="application/ld+json">{jsonLd}</script>}

      <div className="pt-20 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="inline-block text-sm font-semibold uppercase tracking-widest text-accent mb-3">
              Our Portfolio
            </span>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
              Agricultural Products
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              We trade in a wide range of premium agricultural commodities sourced directly from
              Nigerian farms and trusted partners. Click any product to view full specifications.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mb-10">
            {FILTERS.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                  filter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border text-foreground/70 hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {loading && (
            <CardGridSkeleton
              card={ProductCardSkeleton}
              gridClassName="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12"
              label="Loading products"
            />
          )}
          {error && <ErrorState error={error} />}
          {!loading && !error && !visible.length && (
            <Empty label={`No products in ${filter} yet.`} />
          )}

          {!!visible.length && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {visible.map(p => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
