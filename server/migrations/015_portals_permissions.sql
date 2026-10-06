-- 015: staff permissions, email codes, bid unlock and split awards, supplier
-- shipments, client accounts and payments, the investment section, and
-- portal notifications. Needs 001–014. Safe to run more than once.

-- ------------------------------------------------- staff permissions ---
-- A staff member has a role (profiles.role_key: one of the built-in roles
-- in server/permissions.js, or a custom one from staff_roles) and, when
-- needed, their own permission set (profiles.permissions) that replaces
-- the role's. The old enum column `role` stays for compatibility.
create table if not exists staff_roles (
  key         text primary key,
  name        text not null,
  description text not null default '',
  permissions jsonb not null default '{}'::jsonb,   -- { module: [actions] }
  created_by  uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table staff_roles enable row level security;
alter table profiles add column if not exists role_key    text;
alter table profiles add column if not exists permissions jsonb;
-- Everyone who was an admin so far keeps full control.
update profiles set role_key = case role::text when 'admin' then 'super_admin' else role::text end where role_key is null;

-- Portal accounts (suppliers, clients, investors) are not staff: no profile row.
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(new.raw_user_meta_data->>'account_type', '') in ('supplier', 'client', 'investor') then return new; end if;
  insert into profiles (id, email, active)
  values (new.id, coalesce(new.email, ''), false)
  on conflict (id) do nothing;
  return new;
end $$;

-- --------------------------------------------------------- email codes ---
-- One-time codes emailed before an invoice is accepted or an order acknowledged.
create table if not exists otp_codes (
  id         bigint generated always as identity primary key,
  purpose    text not null,                 -- quote_accept | po_acknowledge
  ref_id     bigint not null,
  email      text not null,
  code_hash  text not null,
  attempts   integer not null default 0,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_otp_ref on otp_codes(purpose, ref_id, created_at desc);
alter table otp_codes enable row level security;

-- ------------------------------------------- bids: unlock, split award ---
alter table tenders add column if not exists required_documents jsonb not null default '[]'::jsonb;  -- document kinds a bid must carry
alter table bids add column if not exists withdrawn_at     timestamptz;
alter table bids add column if not exists unlocked_at      timestamptz;      -- set while the supplier may edit after closing
alter table bids add column if not exists unlocked_by      uuid;
alter table bids add column if not exists unlock_reason    text not null default '';
alter table bids add column if not exists revision         integer not null default 0;
alter table bids add column if not exists revised_at       timestamptz;
alter table bids add column if not exists awarded_quantity numeric(14,3);
alter table bids add column if not exists awarded_price    numeric(14,2);
create table if not exists bid_revisions (
  id               bigint generated always as identity primary key,
  bid_id           bigint not null references bids(id) on delete cascade,
  reason           text not null default '',
  unlocked_by      uuid,
  unlocked_by_name text not null default '',
  unlocked_at      timestamptz not null default now(),
  before           jsonb not null default '{}'::jsonb,   -- the bid as it stood
  after            jsonb,                                -- the bid as resubmitted
  changes          jsonb,                                -- [{ field, from, to }]
  resubmitted_at   timestamptz
);
create index if not exists idx_bid_revisions_bid on bid_revisions(bid_id, unlocked_at);
alter table bid_revisions enable row level security;

-- ------------------------------------------------- supplier shipments ---
-- A supplier's deliveries against a purchase order.
create table if not exists po_shipments (
  id               bigint generated always as identity primary key,
  po_id            bigint not null references purchase_orders(id) on delete cascade,
  supplier_id      bigint references suppliers(id) on delete set null,
  number           integer not null default 1,
  product          text not null default '',
  quantity         numeric(14,3) not null,
  unit             text not null default 'MT',
  truck_number     text not null default '',
  driver_name      text not null default '',
  driver_phone     text not null default '',
  loading_location text not null default '',
  destination      text not null default '',
  loading_date     date,
  eta              date,
  waybill          text not null default '',
  notes            text not null default '',
  status           text not null default 'planned',   -- planned | in_transit | delivered | confirmed | cancelled
  current_location text not null default '',
  updates          jsonb not null default '[]'::jsonb, -- [{ at, location, note, status, by }]
  delivered_at     timestamptz,
  confirmed_at     timestamptz,
  confirmed_by     uuid,
  received_quantity numeric(14,3),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_po_shipments_po on po_shipments(po_id, number);
create index if not exists idx_po_shipments_supplier on po_shipments(supplier_id);
drop trigger if exists po_shipments_touch on po_shipments;
create trigger po_shipments_touch before update on po_shipments for each row execute function touch_updated_at();
alter table po_shipments enable row level security;

-- ------------------------------------------- client accounts, payments ---
alter table clients add column if not exists email              text not null default '';   -- sign-in address of a client account
alter table clients add column if not exists source             text not null default 'admin';  -- admin | signup
alter table clients add column if not exists verified_at        timestamptz;
alter table clients add column if not exists auth_token_hash    text;
alter table clients add column if not exists auth_token_kind    text;
alter table clients add column if not exists auth_token_expires timestamptz;
create unique index if not exists idx_clients_account_email on clients (lower(email)) where email <> '';

-- What a registering client fills in shows on the client record like any other field.
insert into client_fields (key, label, type, required, show_in_list, sort_order) values
  ('address',             'Company address',        'textarea', false, false, 52),
  ('registration_number', 'Business registration',  'text',     false, false, 54),
  ('tax_id',              'Tax ID (TIN)',           'text',     false, false, 56)
on conflict (key) do nothing;

create table if not exists payments (
  id            bigint generated always as identity primary key,
  client_id     bigint references clients(id) on delete set null,
  quote_id      bigint references quotes(id)  on delete set null,
  amount        numeric(16,2) not null,
  currency      text not null default 'USD',
  paid_on       date,
  method        text not null default '',
  reference     text not null default '',
  note          text not null default '',
  receipt_document_id bigint,
  status        text not null default 'submitted',   -- submitted | confirmed | rejected
  status_note   text not null default '',
  source        text not null default 'staff',       -- client | staff
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_payments_client on payments(client_id, created_at desc);
create index if not exists idx_payments_quote on payments(quote_id);
drop trigger if exists payments_touch on payments;
create trigger payments_touch before update on payments for each row execute function touch_updated_at();
alter table payments enable row level security;

-- --------------------------------------------------------- investments ---
create table if not exists investors (
  id              bigint generated always as identity primary key,
  user_id         uuid unique references auth.users(id) on delete set null,
  name            text not null,
  email           text not null default '',
  phone           text not null default '',
  address         text not null default '',
  id_type         text not null default '',
  id_number       text not null default '',
  bank_name       text not null default '',
  bank_account_name   text not null default '',
  bank_account_number text not null default '',
  notes           text not null default '',          -- internal
  status          text not null default 'active',    -- active | blocked
  kyc_status      text not null default 'pending',   -- pending | verified | rejected
  verified_at     timestamptz,
  auth_token_hash    text,
  auth_token_kind    text,
  auth_token_expires timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create unique index if not exists idx_investors_email on investors (lower(email)) where email <> '';
drop trigger if exists investors_touch on investors;
create trigger investors_touch before update on investors for each row execute function touch_updated_at();

create table if not exists investment_opportunities (
  id            bigint generated always as identity primary key,
  number        text not null unique,               -- IO-2026-0001
  title         text not null,
  summary       text not null default '',
  description   text not null default '',
  currency      text not null default 'NGN',
  min_amount    numeric(16,2) not null default 0,
  capacity      numeric(16,2),                      -- total we can take; null = open
  tenor_months  integer not null default 12,
  expected_return_pct numeric(7,3),                 -- over the tenor; null = not stated
  return_note   text not null default '',
  opens_at      timestamptz not null default now(),
  closes_at     timestamptz,
  status        text not null default 'draft',      -- draft | published | closed | cancelled
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
drop trigger if exists investment_opportunities_touch on investment_opportunities;
create trigger investment_opportunities_touch before update on investment_opportunities for each row execute function touch_updated_at();

create table if not exists investments (
  id              bigint generated always as identity primary key,
  number          text not null unique,             -- IV-2026-0001
  opportunity_id  bigint not null references investment_opportunities(id) on delete restrict,
  investor_id     bigint not null references investors(id) on delete restrict,
  amount          numeric(16,2) not null,
  currency        text not null default 'NGN',
  status          text not null default 'pending',  -- pending | active | matured | paid_out | rejected | cancelled
  note            text not null default '',         -- from the investor
  status_note     text not null default '',         -- to the investor
  internal_notes  text not null default '',
  proof_document_id bigint,
  start_date      date,
  maturity_date   date,
  expected_return numeric(16,2),
  reviewed_by     uuid,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_investments_investor on investments(investor_id, created_at desc);
create index if not exists idx_investments_opportunity on investments(opportunity_id, status);
drop trigger if exists investments_touch on investments;
create trigger investments_touch before update on investments for each row execute function touch_updated_at();

create table if not exists investment_payouts (
  id            bigint generated always as identity primary key,
  investment_id bigint not null references investments(id) on delete cascade,
  kind          text not null default 'return',     -- return | principal
  amount        numeric(16,2) not null,
  paid_on       date not null default current_date,
  reference     text not null default '',
  note          text not null default '',
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists idx_payouts_investment on investment_payouts(investment_id, paid_on);
alter table investors enable row level security;
alter table investment_opportunities enable row level security;
alter table investments enable row level security;
alter table investment_payouts enable row level security;

-- ------------------------------------------------ documents, messages ---
alter table documents add column if not exists po_shipment_id bigint references po_shipments(id) on delete cascade;
alter table documents add column if not exists payment_id     bigint references payments(id) on delete set null;
alter table documents add column if not exists investor_id    bigint references investors(id) on delete cascade;
alter table documents add column if not exists opportunity_id bigint references investment_opportunities(id) on delete cascade;
alter table documents add column if not exists investment_id  bigint references investments(id) on delete set null;
create index if not exists idx_documents_investor on documents(investor_id);
create index if not exists idx_documents_opportunity on documents(opportunity_id);

-- ------------------------------------------------------ notifications ---
-- What a client, supplier or investor sees under Notifications in their portal.
create table if not exists notifications (
  id          bigint generated always as identity primary key,
  audience    text not null,              -- client | supplier | investor
  audience_id bigint not null,
  title       text not null,
  body        text not null default '',
  link        text not null default '',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists idx_notifications_audience on notifications(audience, audience_id, created_at desc);
alter table notifications enable row level security;
