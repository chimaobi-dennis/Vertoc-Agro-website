import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Calendar, Clock } from 'lucide-react'
import { useApi } from '../lib/api'
import { ErrorState } from '../components/PageState'
import { BlogPostSkeleton } from '../components/Skeleton'

const fmtDate = iso =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })

/* Bodies are stored as light markdown: blank-line separated blocks, with
   "## " marking a subheading. Rendered without a markdown dependency. */
function Body({ text }) {
  const blocks = (text || '').split(/\n{2,}/).map(b => b.trim()).filter(Boolean)
  return (
    <div className="max-w-3xl">
      {blocks.map((b, i) =>
        b.startsWith('## ') ? (
          <h2 key={i} className="font-serif text-xl md:text-2xl font-bold text-foreground mt-8 mb-3">
            {b.slice(3)}
          </h2>
        ) : (
          <p key={i} className="text-muted-foreground leading-relaxed mb-4">{b}</p>
        )
      )}
    </div>
  )
}

export default function BlogPost() {
  const { slug } = useParams()
  const { data: post, error, loading } = useApi(`/posts/${slug}`, [slug])

  if (loading) return <main className="flex-grow"><BlogPostSkeleton /></main>
  if (error) return <main><ErrorState error={error} /></main>
  if (!post) return null

  return (
    <main>
      <div className="pt-20 pb-16 bg-background min-h-screen">
        <div className="container mx-auto px-4 md:px-6">
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-accent transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Blog
          </Link>

          <article>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4 max-w-3xl">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {fmtDate(post.published_at)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                {post.read_time}
              </span>
              <span>By {post.author}</span>
            </div>

            {post.image && (
              <div className="rounded-2xl overflow-hidden shadow-card mb-10 aspect-[16/9] max-w-4xl">
                <img src={post.image} alt={post.title} className="w-full h-full object-cover" />
              </div>
            )}

            <Body text={post.body} />
          </article>
        </div>
      </div>
    </main>
  )
}
