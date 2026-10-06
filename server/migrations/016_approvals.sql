-- 016: approval workflow and amendments.
--
-- Anything staff create without approval rights waits as `pending` until an
-- admin approves it; only approved records are official (can be sent, issued,
-- invited to a portal). Existing rows stay approved. Amendments of approved
-- invoices and orders by staff without approval rights are kept here, with
-- the original and the proposed change, until an admin decides.
-- Safe to run more than once.

do $$
declare t text;
begin
  foreach t in array array['quotes', 'purchase_orders', 'clients', 'suppliers'] loop
    execute format('alter table %I add column if not exists approval text not null default ''approved''', t);
    execute format('alter table %I add column if not exists submitted_by uuid references auth.users(id) on delete set null', t);
    execute format('alter table %I add column if not exists approved_by uuid references auth.users(id) on delete set null', t);
    execute format('alter table %I add column if not exists approved_at timestamptz', t);
    execute format('alter table %I add column if not exists approval_note text not null default ''''', t);
    execute format('alter table %I drop constraint if exists %I', t, t || '_approval_check');
    execute format('alter table %I add constraint %I check (approval in (''pending'', ''approved'', ''rejected''))', t, t || '_approval_check');
  end loop;
end $$;

create table if not exists amendments (
  id            bigint generated always as identity primary key,
  entity        text not null check (entity in ('quote', 'purchase_order')),
  entity_id     bigint not null,
  entity_number text not null default '',
  status        text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  original      jsonb not null default '{}'::jsonb,   -- the fields as they were when the change was proposed
  proposed      jsonb not null default '{}'::jsonb,   -- the fields the initiator wants to change, with their new values
  reason        text not null default '',
  initiated_by  uuid references auth.users(id) on delete set null,
  initiated_name text not null default '',
  created_at    timestamptz not null default now(),
  reviewed_by   uuid references auth.users(id) on delete set null,
  reviewed_name text not null default '',
  reviewed_at   timestamptz,
  review_note   text not null default ''
);
create index if not exists idx_amendments_entity on amendments (entity, entity_id, created_at desc);
create index if not exists idx_amendments_status on amendments (status, created_at desc);
alter table amendments enable row level security;   -- reached only through the service role
