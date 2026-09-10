-- Vertoc Agro Phase 2: clients with user-defined fields, and the enquiry pipeline.
-- Run once in Supabase: SQL Editor -> New query -> Run.

-- ---------------------------------------------------- client fields ---
-- The user defines what a client record tracks. Every row here becomes a
-- form input, a table column (if show_in_list) and an export column.
create table if not exists client_fields (
  id           bigint generated always as identity primary key,
  key          text not null unique,               -- machine key, e.g. payment_terms
  label        text not null,
  type         text not null default 'text',       -- text|textarea|email|phone|number|date|select|checkbox|url
  options      jsonb not null default '[]'::jsonb, -- for select
  required     boolean not null default false,
  show_in_list boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
drop trigger if exists client_fields_touch on client_fields;
create trigger client_fields_touch before update on client_fields
  for each row execute function touch_updated_at();

-- ----------------------------------------------------------- clients ---
-- name is always present; everything else lives in data, keyed by
-- client_fields.key. user_id is reserved for a future client portal.
create table if not exists clients (
  id         bigint generated always as identity primary key,
  name       text not null,
  data       jsonb not null default '{}'::jsonb,
  status     text not null default 'active',       -- active | archived
  user_id    uuid references auth.users(id) on delete set null,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clients_status on clients(status);
create index if not exists idx_clients_name   on clients(lower(name));
drop trigger if exists clients_touch on clients;
create trigger clients_touch before update on clients
  for each row execute function touch_updated_at();

-- -------------------------------------------------- enquiry pipeline ---
-- status now carries the pipeline stage:
--   quote:   new -> contacted -> quoted -> won | lost   (or archived)
--   contact: new -> replied                              (or archived)
alter table enquiries add column if not exists client_id bigint references clients(id) on delete set null;
alter table enquiries add column if not exists notes text not null default '';
alter table enquiries add column if not exists status_changed_at timestamptz not null default now();
create index if not exists idx_enquiries_client      on enquiries(client_id);
create index if not exists idx_enquiries_kind_status on enquiries(kind, status);

-- RLS on, no policies: service_role (the backend) only. Client data is
-- customer PII and must never be readable with the public anon key.
alter table client_fields enable row level security;
alter table clients       enable row level security;

-- Sensible starting fields. All editable or deletable from the panel.
insert into client_fields (key, label, type, required, show_in_list, sort_order) values
  ('company',        'Company',                 'text',     false, true,  10),
  ('contact_person', 'Contact person',          'text',     false, true,  20),
  ('email',          'Email',                   'email',    false, true,  30),
  ('phone',          'Phone',                   'phone',    false, true,  40),
  ('country',        'Country',                 'text',     false, true,  50),
  ('commodities',    'Commodities of interest', 'textarea', false, false, 60),
  ('notes',          'Notes',                   'textarea', false, false, 70)
on conflict (key) do nothing;
