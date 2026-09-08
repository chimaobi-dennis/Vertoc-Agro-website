import { Link } from 'react-router-dom'
import { ArrowRight, TrendingUp } from 'lucide-react'

export default function ProductCard({ product }) {
  return (
    <Link
      to={`/products/${product.slug}`}
      className="bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-300 shadow-card hover:shadow-hover h-full flex flex-col group"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {product.featured && (
          <div className="absolute top-3 left-3 flex items-center gap-1 bg-accent text-white text-xs font-bold px-3 py-1 rounded-full">
            <TrendingUp className="w-3 h-3" />
            HOT
          </div>
        )}
        <div className="absolute top-3 right-3">
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-emerald-100 text-emerald-700">
            {product.category.toUpperCase()}
          </span>
        </div>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <h4 className="text-lg font-bold mb-1 text-foreground">{product.name}</h4>
        <p className="text-sm text-muted-foreground leading-relaxed flex-1">
          {product.summary || product.description}
        </p>
        <div className="mt-3 flex items-center text-sm font-semibold text-primary">
          View Details <ArrowRight className="w-4 h-4 ml-1" />
        </div>
      </div>
    </Link>
  )
}
