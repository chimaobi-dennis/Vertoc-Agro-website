/*
 * Storage driver selection.
 *
 * Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are both set;
 * otherwise the local SQLite file, so development needs no network or keys.
 *
 * SQLite is a development convenience only. On a serverless platform the
 * filesystem is ephemeral and not shared between invocations, so a SQLite
 * fallback there would appear to work, then quietly lose every write. We fail
 * loudly instead.
 */
const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)

// Vercel/Netlify/Lambda all set one of these.
const serverless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NETLIFY
)
const production = process.env.NODE_ENV === 'production'

if (!hasSupabase && (serverless || production)) {
  throw new Error(
    'No database configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n' +
    'The SQLite fallback is for local development only — a serverless ' +
    'filesystem is ephemeral, so writes would be silently discarded.'
  )
}

export const driver = hasSupabase ? 'supabase' : 'sqlite'

const store = hasSupabase
  ? await import('./supabase.js')
  : await import('./sqlite.js')

export const {
  listProducts, getProduct, createProduct, updateProduct, deleteProduct,
  listPosts, getPost, createPost, updatePost, deletePost,
  createEnquiry, getEnquiry, listEnquiries, updateEnquiryStatus,
} = store
