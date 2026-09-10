-- Vertoc Agro admin: users, roles, audit log, media storage.
-- Run once in Supabase: SQL Editor -> New query -> Run.

-- ------------------------------------------------------------- roles ---
do $$ begin
  create type user_role as enum ('admin', 'editor', 'sales');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------- profiles ---
-- One row per auth user. Role and active flag are checked server-side on
-- every admin request; the frontend only uses them to hide menus.
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  name       text not null default '',
  role       user_role not null default 'editor',
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_touch on profiles;
create trigger profiles_touch before update on profiles
  for each row execute function touch_updated_at();

-- Safety net: any auth user that appears without a profile (created outside
-- the admin panel) gets an INACTIVE one, so it cannot act until an admin
-- explicitly enables it. The panel's own invite flow upserts an active row.
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, active)
  values (new.id, coalesce(new.email, ''), false)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

alter table profiles enable row level security;

-- A signed-in user may read their own profile (the panel shows it after
-- login). Everything else goes through the backend with service_role.
drop policy if exists "read own profile" on profiles;
create policy "read own profile" on profiles
  for select using (auth.uid() = id);

-- --------------------------------------------------------- audit log ---
-- Who changed what, when, with before/after. Written only by the backend;
-- no client policy at all, so nothing but service_role can read or write it.
create table if not exists audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid,                      -- null for MCP / system actions
  actor_label text not null,             -- email, or 'mcp'
  action      text not null,             -- create | update | delete | invite | ...
  entity      text not null,             -- product | post | user | enquiry
  entity_id   text,
  before      jsonb,
  after       jsonb,
  at          timestamptz not null default now()
);

create index if not exists idx_audit_entity on audit_log(entity, entity_id);
create index if not exists idx_audit_at     on audit_log(at desc);

alter table audit_log enable row level security;

-- ------------------------------------------------------ media bucket ---
-- Product and post images uploaded from the panel. Public read so the site
-- can serve them; writes happen through the backend only.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "public read media" on storage.objects;
create policy "public read media" on storage.objects
  for select using (bucket_id = 'media');
