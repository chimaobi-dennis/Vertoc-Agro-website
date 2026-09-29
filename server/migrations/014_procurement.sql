-- 014: procurement — the sourcing leg, beside sales.
--   suppliers         the procurement "clients": records staff keep, and accounts suppliers open themselves
--   tenders           bidding opportunities published on the site
--   bids              what suppliers offer on a tender, with a status staff move along
--   bid_requests      requests for additional information on a bid, and the answers
--   purchase_orders   PO / LPO issued to a supplier (the procurement counterpart of an invoice)
-- plus supplier/bid/PO links on documents and messages, a `scope` that keeps
-- procurement conversations apart from sales, and a `procurement` staff role.
-- Needs 001–005. Safe to run more than once.

-- A staff role for the procurement team (admins see procurement too).
alter type user_role add value if not exists 'procurement';

-- Supplier accounts sign in with Supabase Auth as well, but they are not
-- staff: no profile row for them, so they never appear under Users and can
-- never reach the panel.
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'account_type', '') = 'supplier' then return new; end if;
  insert into profiles (id, email, active)
  values (new.id, coalesce(new.email, ''), false)
  on conflict (id) do nothing;
  return new;
end $$;

-- ---------------------------------------------------------- suppliers ---
create table if not exists suppliers (
  id              bigint generated always as identity primary key,
  user_id         uuid unique references auth.users(id) on delete set null,   -- set once they open an account
  company_name    text not null,
  contact_person  text not null default '',
  email           text not null default '',
  phone           text not null default '',
  address         text not null default '',
  commodities     text not null default '',          -- what they supply
  notes           text not null default '',          -- internal, never shown to the supplier
  status          text not null default 'active',    -- active | blocked | archived
  source          text not null default 'admin',     -- admin | bid | signup
  verified_at     timestamptz,                       -- email confirmed
  auth_token_hash    text,                           -- one-time link (confirm email / reset password), stored hashed
  auth_token_kind    text,
  auth_token_expires timestamptz,
  created_by      uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists idx_suppliers_email on suppliers (lower(email)) where email <> '';
create index if not exists idx_suppliers_status on suppliers(status);
drop trigger if exists suppliers_touch on suppliers;
create trigger suppliers_touch before update on suppliers for each row execute function touch_updated_at();

-- ------------------------------------------------------------ tenders ---
create table if not exists tenders (
  id                bigint generated always as identity primary key,
  number            text not null unique,              -- VB-2026-0001
  title             text not null,
  commodity         text not null,
  quantity          numeric(14,3) not null default 0,
  unit              text not null default 'MT',
  specification     text not null default '',          -- moisture, foreign matter, damaged grains…
  delivery_location text not null default '',
  delivery_period   text not null default '',          -- "15–30 October 2026"
  delivery_by       date,                              -- latest delivery date, optional
  asking_price      numeric(14,2),                     -- per unit; shown to suppliers
  currency          text not null default 'NGN',
  payment_terms     text not null default '',
  requirements      text not null default '',          -- certifications, inspection, documentation, packaging
  opens_at          timestamptz not null default now(),
  closes_at         timestamptz not null,
  status            text not null default 'draft',     -- draft | published | closed | awarded | cancelled
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_tenders_status on tenders(status, closes_at);
drop trigger if exists tenders_touch on tenders;
create trigger tenders_touch before update on tenders for each row execute function touch_updated_at();

-- --------------------------------------------------------------- bids ---
create table if not exists bids (
  id                 bigint generated always as identity primary key,
  tender_id          bigint not null references tenders(id) on delete cascade,
  supplier_id        bigint references suppliers(id) on delete set null,
  company_name       text not null,                   -- as submitted; survives changes to the supplier record
  contact_person     text not null default '',
  phone              text not null default '',
  email              text not null default '',
  address            text not null default '',
  commodity          text not null default '',
  quantity           numeric(14,3) not null,
  unit               text not null default 'MT',
  price              numeric(14,2) not null,          -- proposed price per unit
  currency           text not null default 'NGN',
  total              numeric(16,2) not null default 0,
  commodity_location text not null default '',
  delivery_date      date,
  accepts_terms      boolean not null default false,  -- accepts the stated payment terms
  terms_note         text not null default '',        -- what they propose instead
  note               text not null default '',
  confirmed_at       timestamptz,                     -- the declaration was ticked
  status             text not null default 'open',    -- open | under_review | shortlisted | awarded | not_selected | withdrawn
  status_note        text not null default '',        -- shown to the supplier with the status
  internal_notes     text not null default '',
  status_changed_at  timestamptz,
  status_changed_by  uuid,
  upload_token_hash    text,                          -- lets a bidder without an account attach files right after submitting
  upload_token_expires timestamptz,
  ip                 text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_bids_tender on bids(tender_id, status);
create index if not exists idx_bids_supplier on bids(supplier_id);
create index if not exists idx_bids_email on bids(lower(email));
drop trigger if exists bids_touch on bids;
create trigger bids_touch before update on bids for each row execute function touch_updated_at();

create table if not exists bid_requests (
  id           bigint generated always as identity primary key,
  bid_id       bigint not null references bids(id) on delete cascade,
  question     text not null,
  asked_by     uuid,
  asked_at     timestamptz not null default now(),
  answer       text not null default '',
  answered_at  timestamptz
);
create index if not exists idx_bid_requests_bid on bid_requests(bid_id, asked_at);

-- ---------------------------------------------------- purchase orders ---
create table if not exists purchase_orders (
  id                bigint generated always as identity primary key,
  kind              text not null default 'lpo',      -- po | lpo
  number            text not null unique,             -- PO-2026-0001 / LPO-2026-0001
  token             text not null unique,             -- the supplier's link: /po/<token>
  supplier_id       bigint references suppliers(id) on delete set null,
  tender_id         bigint references tenders(id)   on delete set null,
  bid_id            bigint references bids(id)      on delete set null,
  supplier_name     text not null default '',         -- snapshot
  supplier_email    text not null default '',
  supplier_address  text not null default '',
  title             text not null default '',
  currency          text not null default 'NGN',
  items             jsonb not null default '[]'::jsonb,
  discount          numeric(14,2) not null default 0,
  tax_rate          numeric(6,3)  not null default 0,
  subtotal          numeric(16,2) not null default 0,
  total             numeric(16,2) not null default 0,
  delivery_location text not null default '',
  delivery_date     date,
  payment_terms     text not null default '',
  notes             text not null default '',
  terms             text not null default '',
  internal_notes    text not null default '',
  status            text not null default 'draft',    -- draft | issued | acknowledged | declined | fulfilled | cancelled
  issued_at         timestamptz,
  viewed_at         timestamptz,
  responded_at      timestamptz,
  response_note     text not null default '',
  created_by        uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_po_supplier on purchase_orders(supplier_id);
create index if not exists idx_po_status on purchase_orders(status);
drop trigger if exists purchase_orders_touch on purchase_orders;
create trigger purchase_orders_touch before update on purchase_orders for each row execute function touch_updated_at();

-- ---------------------------------------- documents and conversations ---
alter table documents add column if not exists supplier_id bigint references suppliers(id) on delete cascade;
alter table documents add column if not exists bid_id      bigint references bids(id) on delete cascade;
alter table documents add column if not exists po_id       bigint references purchase_orders(id) on delete set null;
alter table documents add column if not exists label       text not null default '';   -- "CAC documents", "Quality certificate"…
create index if not exists idx_documents_supplier on documents(supplier_id);
create index if not exists idx_documents_bid on documents(bid_id);

alter table messages add column if not exists supplier_id bigint references suppliers(id) on delete set null;
alter table messages add column if not exists bid_id      bigint references bids(id) on delete set null;
alter table messages add column if not exists po_id       bigint references purchase_orders(id) on delete set null;
alter table messages add column if not exists scope       text not null default 'sales';   -- sales | procurement
create index if not exists idx_messages_supplier on messages(supplier_id);
create index if not exists idx_messages_scope on messages(scope, created_at desc);

-- Backend only (service role): no client policies on any of these.
alter table suppliers       enable row level security;
alter table tenders         enable row level security;
alter table bids            enable row level security;
alter table bid_requests    enable row level security;
alter table purchase_orders enable row level security;
