-- 022: the /invest section as managed content.
--
-- Each page of the Invest section (landing page, sign-in and registration texts,
-- terms and conditions, portal texts, and any extra pages staff add) is one row:
-- what is live, what is being edited as a draft, whether it is visible, and who
-- last changed or published it. Every save and publish is kept in the history,
-- so a past version can be loaded back. Opportunities get an optional
-- "payment terms" text. Additive only; safe to run more than once.

create table if not exists invest_content (
  key            text primary key,                         -- landing | register | terms | portal | page-<slug>
  live           jsonb,                                    -- what visitors see (null: the built-in default text)
  draft          jsonb,                                    -- the version being edited (null: no unpublished changes)
  visible        boolean,                                  -- null: the page's default
  title          text not null default '',                 -- for pages staff add
  updated_by     uuid references auth.users(id) on delete set null,
  updated_name   text not null default '',
  updated_at     timestamptz not null default now(),
  published_by   uuid references auth.users(id) on delete set null,
  published_name text not null default '',
  published_at   timestamptz,
  created_at     timestamptz not null default now()
);

create table if not exists invest_content_history (
  id         bigint generated always as identity primary key,
  key        text not null,
  action     text not null,                                -- save_draft | publish | discard_draft | show | hide | restore | create
  snapshot   jsonb,
  note       text not null default '',
  by_id      uuid references auth.users(id) on delete set null,
  by_name    text not null default '',
  at         timestamptz not null default now()
);
create index if not exists idx_invest_history_key on invest_content_history (key, at desc);
alter table invest_content enable row level security;            -- reached only through the service role
alter table invest_content_history enable row level security;

alter table investment_opportunities add column if not exists payment_terms text not null default '';
