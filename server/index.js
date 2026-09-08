/*
 * Local development entry point.
 *
 * Vercel never runs this file — it imports the app through api/index.js.
 */
import './load-env.js'
import app from './app.js'
import { driver } from './store/index.js'

const PORT = process.env.PORT || 8787

app.listen(PORT, () => {
  console.log(`Vertoc Agro API   http://localhost:${PORT}/api`)
  console.log(`Content store     ${driver}${driver === 'sqlite' ? ' (set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to use Postgres)' : ''}`)
  console.log(`MCP endpoint      http://localhost:${PORT}/mcp${process.env.VERTOC_MCP_TOKEN ? ' (token required)' : ' (no token set — local only)'}`)
})
