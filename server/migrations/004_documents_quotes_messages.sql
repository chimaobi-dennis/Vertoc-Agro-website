-- Vertoc Agro Phase 3: documents, outbound quotes, messages, purchases, settings.
-- Run once in Supabase: SQL Editor -> New query -> Run.
-- Safe to re-run: every statement is idempotent.

-- ------------------------------------------------- documents bucket ---
-- PRIVATE. Client files are customer data: never public like `media`.
-- The backend creates short-lived signed URLs for every read and a signed
-- upload URL for every write, so no storage policy is needed at all.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 20971520)   -- 20 MB
on conflict (id) do nothing;

-- -------------------------------------------------------- documents ---
create table if not exists documents (
  id           bigint generated always as identity primary key,
  client_id    bigint references clients(id) on delete cascade,
  quote_id     bigint,                              -- FK added below, after quotes exists
  name         text not null,
  path         text not null unique,                -- object path inside the bucket
  content_type text not null default 'application/octet-stream',
  bytes        bigint not null default 0,
  kind         text not null default 'file',        -- image | file
  status       text not null default 'pending',     -- pending (URL issued) | ready (upload confirmed)
  uploaded_by  uuid,
  created_at   timestamptz not null default now()
);
create index if not exists idx_documents_client on documents(client_id);
create index if not exists idx_documents_quote  on documents(quote_id);

-- ----------------------------------------------------- quote fields ---
-- Same shape as client_fields: the user decides what a quote tracks
-- (Incoterm, port of loading, payment terms...). Rendered by the same code.
create table if not exists quote_fields (
  id           bigint generated always as identity primary key,
  key          text not null unique,
  label        text not null,
  type         text not null default 'text',
  options      jsonb not null default '[]'::jsonb,
  required     boolean not null default false,
  show_in_list boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists quote_fields_touch on quote_fields;
create trigger quote_fields_touch before update on quote_fields
  for each row execute function touch_updated_at();

-- ------------------------------------------------------------ quotes ---
-- Outbound, priced quotations. `token` is the secret in the public link
-- /q/<token>; `number` is the human reference (VQ-2026-0001).
create table if not exists quotes (
  id             bigint generated always as identity primary key,
  number         text not null unique,
  token          text not null unique,
  client_id      bigint references clients(id) on delete set null,
  client_name    text not null default '',          -- snapshot, survives client deletion
  client_email   text not null default '',
  title          text not null default '',
  status         text not null default 'draft',     -- draft|sent|viewed|accepted|declined|expired
  currency       text not null default 'USD',
  items          jsonb not null default '[]'::jsonb,-- [{description, quantity, unit, unit_price, total}]
  discount       numeric(14,2) not null default 0,
  tax_rate       numeric(6,3)  not null default 0,  -- percent
  subtotal       numeric(14,2) not null default 0,
  total          numeric(14,2) not null default 0,
  notes          text not null default '',          -- shown to the client
  terms          text not null default '',          -- shown to the client
  internal_notes text not null default '',          -- never leaves the panel
  data           jsonb not null default '{}'::jsonb,-- values keyed by quote_fields.key
  valid_until    date,
  sent_at        timestamptz,
  viewed_at      timestamptz,
  responded_at   timestamptz,
  response_note  text not null default '',
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists idx_quotes_client on quotes(client_id);
create index if not exists idx_quotes_status on quotes(status);
drop trigger if exists quotes_touch on quotes;
create trigger quotes_touch before update on quotes
  for each row execute function touch_updated_at();

do $$ begin
  alter table documents add constraint documents_quote_fk
    foreign key (quote_id) references quotes(id) on delete set null;
exception when duplicate_object then null; end $$;

-- Per-year counter behind quote numbers. The upsert is atomic, so two
-- people creating quotes at the same moment can never share a number.
create table if not exists quote_counters (
  year integer primary key,
  n    integer not null default 0
);

create or replace function next_quote_number() returns text
language plpgsql as $$
declare y integer := extract(year from now())::integer; v integer;
begin
  insert into quote_counters (year, n) values (y, 1)
  on conflict (year) do update set n = quote_counters.n + 1
  returning n into v;
  return format('VQ-%s-%s', y, lpad(v::text, 4, '0'));
end $$;

-- ---------------------------------------------------------- messages ---
-- Every email the team sends to a client, with the delivery result. Written
-- only by the backend after it talks to Resend.
create table if not exists messages (
  id          bigint generated always as identity primary key,
  client_id   bigint references clients(id)   on delete set null,
  quote_id    bigint references quotes(id)    on delete set null,
  enquiry_id  bigint references enquiries(id) on delete set null,
  direction   text not null default 'out',        -- out (in: reserved)
  to_email    text not null,
  to_name     text not null default '',
  from_email  text not null default '',
  subject     text not null default '',
  body        text not null default '',           -- plain text as written
  html        text not null default '',           -- what was actually sent
  status      text not null default 'queued',     -- queued | sent | failed
  provider_id text,                               -- Resend message id
  error       text not null default '',
  attachments jsonb not null default '[]'::jsonb, -- [{document_id, name}]
  sent_by     uuid,
  created_at  timestamptz not null default now()
);
create index if not exists idx_messages_client  on messages(client_id);
create index if not exists idx_messages_quote   on messages(quote_id);
create index if not exists idx_messages_enquiry on messages(enquiry_id);

-- --------------------------------------------------------- purchases ---
create table if not exists purchases (
  id           bigint generated always as identity primary key,
  client_id    bigint references clients(id) on delete set null,
  quote_id     bigint references quotes(id)  on delete set null,
  reference    text not null default '',         -- PO / invoice / quote number
  description  text not null default '',
  currency     text not null default 'USD',
  amount       numeric(14,2) not null default 0,
  status       text not null default 'pending',  -- pending|paid|shipped|delivered|cancelled
  items        jsonb not null default '[]'::jsonb,
  notes        text not null default '',
  purchased_at date not null default current_date,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_purchases_client on purchases(client_id);
create index if not exists idx_purchases_status on purchases(status);
drop trigger if exists purchases_touch on purchases;
create trigger purchases_touch before update on purchases
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------- settings ---
-- Editable business details: site identity and contact data, company block
-- on quotes, payment instructions, default currency, email sender, MCP
-- access. The `secrets` row (written by the backend only) holds API keys
-- encrypted with AES-256-GCM under a key derived from the service role key.
create table if not exists settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
drop trigger if exists settings_touch on settings;
create trigger settings_touch before update on settings
  for each row execute function touch_updated_at();

insert into settings (key, value) values
  ('site',    '{"name":"Vertoc Agro","legal_name":"Vertoc Agro Products Limited","tagline":"Premium Agricultural Commodities","description":"Cultivation, sourcing, processing, storage, logistics, and export of premium agricultural commodities across Nigeria and beyond.","logo":"/assets/img/logo.png","favicon":"/assets/img/favicon.png","email":"sales@vertocagro.com","phone":"+234 913 500 9001","whatsapp":"2349135009001","address":"Akala Express Way, Ibadan, Oyo State, Nigeria","hours":"Mon - Fri: 8:00 AM - 5:00 PM (WAT)","hours_short":"Mon-Fri 8AM-5PM","facebook":"https://facebook.com/VertocAgro","instagram":"https://instagram.com/vertocagro","linkedin":"https://linkedin.com/company/vertocagro","twitter":"https://x.com/vertocagro","threads":"https://www.threads.com/@vertocagro"}'),
  ('mcp',     '{"enabled":true,"token_hash":"","token_hint":"","rotated_at":null}'),
  ('company', '{"name":"Vertoc Agro","address":"Akala Express Way, Ibadan, Oyo State, Nigeria","phone":"+234 913 500 9001","email":"sales@vertocagro.com","website":"https://vertocagro.com"}'),
  ('quotes',  '{"default_currency":"USD","valid_days":14,"terms":"","payment_text":""}'),
  ('email',   '{"from":"Vertoc Agro <sales@vertocagro.com>","reply_to":"sales@vertocagro.com","signature":"Vertoc Agro\n+234 913 500 9001\nsales@vertocagro.com"}')
on conflict (key) do nothing;

-- Starter quote fields (all editable or deletable from the panel).
insert into quote_fields (key, label, type, options, required, show_in_list, sort_order) values
  ('incoterm',        'Incoterm',        'select', '["FOB","CIF","CFR","EXW","DAP"]', false, true,  10),
  ('port_of_loading', 'Port of loading', 'text',   '[]',                              false, true,  20),
  ('destination',     'Destination',     'text',   '[]',                              false, true,  30),
  ('payment_terms',   'Payment terms',   'text',   '[]',                              false, false, 40),
  ('delivery_time',   'Delivery time',   'text',   '[]',                              false, false, 50)
on conflict (key) do nothing;

-- RLS on, no policies: the backend (service_role) is the only reader and
-- writer. Nothing here may ever be reachable with the public anon key.
alter table documents      enable row level security;
alter table quote_fields   enable row level security;
alter table quotes         enable row level security;
alter table quote_counters enable row level security;
alter table messages       enable row level security;
alter table purchases      enable row level security;
alter table settings       enable row level security;
