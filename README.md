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

## Admin panel

Lives at `/admin`, code-split so public visitors never download it. Accounts
are **invite-only** — there is no signup page.

The visual language every admin screen follows is documented in
`src/admin/DESIGN.md` — read it before adding a screen.

### Roles

| Role | Can manage |
|---|---|
| `admin` | everything, including users and the audit log |
| `editor` | products and blog posts |
| `sales` | clients, quotes and email (Phase 2–3) |

Roles are checked **server-side on every request**, re-read from the profile
each time — changing someone's role or deactivating them takes effect on their
very next request, with no re-login. The frontend only hides menus.

### Setup (once)

1. **Run `server/migrations/002_admin.sql`** in the Supabase SQL editor
   (profiles, roles, audit log, media bucket).
2. **Anon key → frontend.** Supabase → Settings → API → `anon` `public` key,
   into `.env` as `VITE_SUPABASE_ANON_KEY`. This key is public by design and
   is only used to sign in; all data still goes through the backend.
3. **Auth URLs.** Supabase → Authentication → URL Configuration:
   - Site URL: your deployed origin, e.g. `https://vertoc-agromain.vercel.app`
   - Redirect URLs: add `<origin>/admin/set-password` for every origin you
     use (production and `http://localhost:5173`). Invite links land there.
4. **`ADMIN_URL`** in `server/.env` / Vercel: the same origin, used to build
   invite links.
5. **First admin** — from your machine, so the password never leaves it:

   ```bash
   node server/create-admin.js you@example.com 'a-strong-password' 'Your Name'
   ```

   Every further user is invited from the panel (Users → Invite).

> Invite emails go through Supabase's built-in mailer, which is rate-limited
> to a few per hour — fine for a small team. Phase 3 switches it to Resend.

### Guards worth knowing

- You cannot remove your own admin access, and the last active admin cannot
  be demoted or deactivated — so the panel can never lock everyone out.
- Every change — by a person in the panel or by Claude through MCP — writes
  an audit row with before/after. Admins see it under Audit log.
- Images upload to the `media` storage bucket via the backend (8 MB cap,
  images only); nothing writes to storage from the browser.

### Clients and enquiries (Phase 2)

- **Clients** (`/admin/clients`) — admin and `sales`. The table columns, the
  form and the exports all follow the fields you define under **Fields**
  (`/admin/clients/fields`): add, reorder, rename, mark required, choose which
  appear in the table. Values are validated server-side against those
  definitions — required, email, number, date, URL, select options. CSV and
  PDF download the current filtered view; the PDF library loads only on click.
- **Enquiries** (`/admin/enquiries`) — quote requests and contact messages on
  separate tabs, each with its own pipeline: quotes move new → contacted →
  quoted → won or lost; messages new → replied; either can be archived. Each
  enquiry carries internal notes and can be linked to a client or spawn one.
  Deleting a client unlinks its enquiries rather than deleting them.
- Claude has the same reach through MCP: `list_client_fields`, `list_clients`,
  `get_client`, `create_client`, `update_client`, `update_enquiry`.
- Needs `server/migrations/003_clients_quotes.sql` (seeds seven starting
  fields). Supabase-only; the SQLite dev fallback stubs these features.

### Testing

With the backend running and steps 1–2 done:

```bash
node server/test-admin.mjs
```

Creates a throwaway admin, signs in the way the browser does, exercises every
admin route including the role and lock-out guards, and removes everything it
made — even on failure.

## Security

Hardened after a live audit of the public repo and Vercel deployment. What is
in place, and why:

- **Secrets never ship.** `service_role`, the Turnstile secret and the MCP
  token exist only in `server/.env` (local) and Vercel's environment. Nothing
  secret is in git history or the served bundle — the only key in the bundle
  is the Turnstile *site* key, which is public by design.
- **MCP write endpoint** is bearer-token gated, compared with
  `crypto.timingSafeEqual` so response timing cannot leak partial matches.
- **CORS is an allowlist**, not `*`. Same-origin needs nothing; the Vite dev
  server is allowed in development; `ALLOWED_ORIGINS` extends it if ever needed.
- **Internal errors are not returned to clients.** They are logged server-side
  and a generic message is sent, so database schema details cannot leak.
- **Headers** (`vercel.json`): `frame-ancestors 'self'` + `X-Frame-Options`
  against clickjacking, `X-Content-Type-Options: nosniff`, a strict
  `Referrer-Policy`, `Permissions-Policy` denying device APIs, and
  `Cache-Control: no-store` on `/api` and `/mcp`. `X-Powered-By` is disabled.
- **Row Level Security** is enabled on all tables; the public `anon` key can
  read published content only and cannot read enquiries at all.
- **Dependencies:** `qs` is overridden to a patched version — Express pins a
  vulnerable range that `npm audit fix` will not cross on its own.

**Recommended follow-up:** a full `Content-Security-Policy` with `script-src`.
It is deliberately not set yet, because `index.html` carries an inline theme
script and Turnstile injects its own; a strict policy must be tested against
both before it is safe to deploy.

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
