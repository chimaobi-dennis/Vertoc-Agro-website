-- Vertoc Agro content schema for Supabase (Postgres).
-- Run this once in the Supabase dashboard: SQL Editor -> New query -> Run.

create table if not exists products (
  id             bigint generated always as identity primary key,
  slug           text not null unique,
  name           text not null,
  category       text not null default 'Agro',
  summary        text not null default '',
  description    text not null default '',
  image          text not null default '',
  origin         text not null default '',
  processing     text not null default '',
  packaging      text not null default '',
  moq            text not null default '',
  grade          text not null default '',
  hs_code        text not null default '',
  applications   jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  specs          jsonb not null default '[]'::jsonb,
  featured       boolean not null default false,
  status         text not null default 'published',
  sort_order     integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists posts (
  id           bigint generated always as identity primary key,
  slug         text not null unique,
  title        text not null,
  excerpt      text not null default '',
  body         text not null default '',
  category     text not null default 'Insights',
  image        text not null default '',
  author       text not null default 'Vertoc Agro',
  read_time    text not null default '5 min read',
  status       text not null default 'published',
  published_at date not null default current_date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists enquiries (
  id          bigint generated always as identity primary key,
  kind        text not null default 'contact',
  name        text not null,
  email       text not null,
  phone       text not null default '',
  subject     text not null default '',
  message     text not null default '',
  commodity   text not null default '',
  quantity    text not null default '',
  destination text not null default '',
  status      text not null default 'new',
  created_at  timestamptz not null default now()
);

create index if not exists idx_products_status on products(status);
create index if not exists idx_products_sort   on products(sort_order, id);
create index if not exists idx_posts_status    on posts(status);
create index if not exists idx_posts_published on posts(published_at desc);
create index if not exists idx_enquiries_status on enquiries(status);

-- keep updated_at honest
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists products_touch on products;
create trigger products_touch before update on products
  for each row execute function touch_updated_at();

drop trigger if exists posts_touch on posts;
create trigger posts_touch before update on posts
  for each row execute function touch_updated_at();

-- Row Level Security ------------------------------------------------------
-- The backend talks to Postgres with the service_role key, which bypasses
-- RLS entirely. These policies exist so that IF anything is ever read with
-- the public anon key, it can only ever see published content -- and can
-- never read enquiries, which contain customer contact details.

alter table products  enable row level security;
alter table posts     enable row level security;
alter table enquiries enable row level security;

drop policy if exists "public reads published products" on products;
create policy "public reads published products"
  on products for select
  using (status = 'published');

drop policy if exists "public reads published posts" on posts;
create policy "public reads published posts"
  on posts for select
  using (status = 'published');

-- enquiries: no public policy at all, so anon gets nothing.
