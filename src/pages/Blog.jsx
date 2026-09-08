import { Link } from 'react-router-dom'
import { Calendar, Clock, Tag } from 'lucide-react'
import { useApi } from '../lib/api'
import { Loading, ErrorState, Empty } from '../components/PageState'

const fmtDate = iso =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

export default function Blog() {
  const { data: posts, error, loading } = useApi('/posts')

  return (
    <main className="flex-grow">
      <div className="pt-20 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <span className="text-sm font-semibold uppercase tracking-wider text-accent">
              Insights &amp; Updates
            </span>
            <h1 className="text-2xl md:text-3xl font-bold mt-2 text-foreground">Blog</h1>
            <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
              Expert perspectives on Nigerian agriculture, commodity markets, export best
              practices, and industry trends.
            </p>
          </div>

          {loading && <Loading label="Loading posts…" />}
          {error && <ErrorState error={error} />}
          {!loading && !error && !posts?.length && <Empty label="No posts published yet." />}

          {!!posts?.length && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map(post => (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="bg-card border border-border rounded-2xl overflow-hidden hover:-translate-y-1 transition-all duration-200 h-full flex flex-col"
                >
                  <div className="aspect-[16/9] w-full overflow-hidden">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-2xl">
                        <Tag className="w-3 h-3" />
                        {post.category}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-foreground leading-snug mb-2">
                      {post.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                      {post.excerpt}
                    </p>
                    <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {fmtDate(post.published_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {post.read_time}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
