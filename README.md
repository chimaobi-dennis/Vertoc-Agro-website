# Vertoc Agro

The vertocagro.com site, recovered from the medo.dev builder as editable source,
plus a small backend so products and blog posts can be managed by chatting with
Claude.

## Layout

```
vertoc-app/
├── index.html            Vite entry, fonts, pre-paint theme script
├── tailwind.config.js    Design tokens recovered from the original build
├── src/
│   ├── App.jsx           Routes
│   ├── index.css         Light/dark CSS variables
│   ├── components/       Header, Footer, MobileMenu, ProductCard, StatCounter…
│   ├── pages/            One component per route
│   └── lib/              nav config, theme hook, API client
├── public/assets/img/    35 images, all local — no CDN dependency
└── server/
    ├── db.js             SQLite schema
    ├── content.js        The content core (shared by REST + MCP)
    ├── mcp.js            MCP tool definitions
    ├── mcp-stdio.js      stdio transport (Claude Desktop)
    ├── index.js          REST API + MCP over HTTP
    └── seed-data.js      Your recovered content
```

## Running it

Two processes. Backend first:

```bash
cd server && npm install && npm run seed && npm start   # :8787
```

Then the site (Vite proxies `/api` to the backend automatically):

```bash
npm install && npm run dev                              # :5173
```

`npm run seed` is safe to re-run — it updates existing entries by slug rather
than duplicating them.

> Node prints an "SQLite is experimental" warning on start. It is only a
> warning; `node:sqlite` is built in and needs no native compilation.

## Managing content by chatting with Claude

Ten tools are exposed: `list/get/create/update/delete` for both `product` and
`post`. Both transports serve the same tools from the same content core, so it
does not matter which one you use.

### Claude Desktop (local — simplest, works immediately)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vertoc-agro": {
      "command": "node",
      "args": ["/Users/igsoftwebstudio/Documents/IGSOFT Web/vertoc-app/server/mcp-stdio.js"]
    }
  }
}
```

Restart Claude Desktop, then just talk to it:

- "Add a product: Shea Butter, unrefined Grade A, MOQ 5 tonnes, from Niger State"
- "Write a blog post about the 2026 sesame harvest and publish it"
- "Change the cocoa MOQ to 20 tonnes and mark it featured"

### claude.ai (remote — works from any device, including mobile)

Needs the backend deployed behind public HTTPS. Set a token first:

```bash
export VERTOC_MCP_TOKEN="$(openssl rand -hex 32)"
npm start
```

Then in Claude → Settings → Connectors → Add custom connector, point it at
`https://your-domain.com/mcp` with that bearer token.

**The token is the only thing standing between the open internet and write
access to your site — do not deploy without setting it.** With no token set the
endpoint accepts unauthenticated writes, which is fine on localhost and unsafe
anywhere else.

## Database (Supabase)

The store is pluggable. With no Supabase credentials it uses a local SQLite
file, so development needs no network and no keys. Set both variables below and
it switches to hosted Postgres — the server prints which store is active on
boot.

**Setup**

1. **Run the schema.** Supabase dashboard → SQL Editor → New query → paste
   `server/migrations/001_init.sql` → Run.
2. **Get the key.** Project Settings → API → `service_role` key.
3. **Put it in `server/.env`** (copy from `server/.env.example`):

   ```
   SUPABASE_URL=https://qeogredokbndssfrcjmo.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   ```

4. **Migrate the content:** `cd server && npm run seed`

> **The `service_role` key bypasses Row Level Security completely.** It belongs
> only in `server/.env`, never in a `VITE_*` variable — Vite inlines those into
> the browser bundle, so shipping it there hands every visitor full read/write
> access to the database. The frontend never talks to Supabase directly; it
> only calls this backend.

RLS is enabled on all three tables by the migration. The policies allow the
public `anon` key to read *published* products and posts only, and to read no
enquiries at all — so even a leaked anon key cannot expose customer details.

## Spam protection (Cloudflare Turnstile)

The original site used a canvas captcha generated and checked in the browser,
which is not protection — the answer lives in client JavaScript, and a bot can
post straight past it. It is replaced with Turnstile, verified **server-side**.

1. Cloudflare dashboard → Turnstile → Add site → copy both keys.
2. Frontend: put the **site key** in `.env` at the project root:
   `VITE_TURNSTILE_SITE_KEY=0x...`
3. Backend: export the **secret key** where the server runs:
   `export TURNSTILE_SECRET_KEY=0x...`

With no keys set, forms stay usable locally and submissions are accepted
unverified. `NODE_ENV=production` without `TURNSTILE_SECRET_KEY` refuses to
start, so the public form can never silently run unprotected.

Submissions are stored in the `enquiries` table and readable through the MCP
tools — ask Claude "any new enquiries?". Defence layers, in order: hidden
honeypot field, format validation, per-IP throttle (5 per 10 min), then
Turnstile.

## Deploying to Vercel

The frontend builds to static files; `api/index.js` exposes the same Express
app as a serverless function. `vercel.json` routes `/api/*` and `/mcp` to that
function and rewrites everything else to `index.html` so deep links work.

**Supabase is required in production.** Serverless filesystems are ephemeral
and not shared between invocations, so the SQLite fallback would appear to work
and then silently discard every write. `server/store/index.js` refuses to start
rather than let that happen.

### Environment variables

Set these in Vercel → Project → Settings → Environment Variables. `server/.env`
is local-only and is never deployed.

| Variable | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://qeogredokbndssfrcjmo.supabase.co` | runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key | runtime, secret |
| `TURNSTILE_SECRET_KEY` | Turnstile secret | runtime, secret — **required**, Vercel sets `NODE_ENV=production` |
| `VERTOC_MCP_TOKEN` | `openssl rand -hex 32` | runtime, secret — **required**, `/mcp` is now publicly reachable |
| `VITE_TURNSTILE_SITE_KEY` | Turnstile site key | **build-time** |
| `VITE_API_BASE` | leave empty | same origin as the site |

`VITE_*` values are read when the bundle is built, so changing one needs a
redeploy, not just a restart.

### First deploy

```bash
npm i -g vercel
vercel link
vercel --prod
```

Then run `server/migrations/001_init.sql` in the Supabase SQL editor and seed
Postgres once from your machine:

```bash
cd server && npm run seed     # with SUPABASE_* set in server/.env
```

### Your MCP endpoint becomes public

Deploying gives you the HTTPS URL that claude.ai custom connectors need:
`https://<your-app>.vercel.app/mcp`, using `VERTOC_MCP_TOKEN` as the bearer
token. That is what unlocks managing content from your phone rather than only
from Claude Desktop.

### One caveat

The per-IP throttle on the enquiry form is in-memory, so on serverless it only
applies within a warm instance and resets on cold starts. Turnstile is the real
protection; treat the throttle as a speed bump. If you want a hard limit, move
it into Postgres or put Cloudflare rate limiting in front.

## Deploying

The frontend is static (`npm run build` → `dist/`) and can go on any host. The
backend needs a Node process and a persistent disk for `server/data/content.db`.
Point the frontend at the deployed API with `VITE_API_BASE` at build time.

Because it is a single-page app, configure the host to rewrite unknown paths to
`index.html`, or deep links like `/products/cocoa` will 404 on refresh.
