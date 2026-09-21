-- 009: client reviews. Shown on the homepage once approved; clients submit
-- them from the site (status 'pending'), staff add and approve them in the
-- panel. Safe to run more than once.
create table if not exists reviews (
  id          bigint generated always as identity primary key,
  quote       text not null,
  name        text not null,
  role        text not null default '',
  email       text not null default '',           -- optional, website submissions only; never shown
  rating      smallint not null default 5 check (rating between 1 and 5),
  status      text not null default 'pending',    -- pending | approved | hidden
  source      text not null default 'admin',      -- admin | website
  position    integer not null default 0,         -- lower first on the homepage
  created_at  timestamptz not null default now(),
  approved_at timestamptz
);
create index if not exists idx_reviews_status on reviews(status, position, created_at);
alter table reviews enable row level security;   -- backend only (service role); no client policies

-- The three reviews the homepage used to hard-code, approved.
insert into reviews (quote, name, role, rating, status, source, position, approved_at)
select * from (values
  ('Vertoc Agro has been our most reliable maize supplier for over two years. Their quality consistency is unmatched.', 'Sanjay', 'Procurement Manager of an Indian Based Food Processing company', 5, 'approved', 'admin', 1, now()),
  ('Working with Vertoc has been seamless. Their export documentation is always in order and shipments arrive on time.', 'Mitchell', 'Director of an International Grain company in the UK', 5, 'approved', 'admin', 2, now()),
  ('We switched to Vertoc for our palm oil supply and have never looked back. Competitive pricing and premium quality.', 'Johnson', 'CEO of a Food Processing Company in Nigeria', 5, 'approved', 'admin', 3, now())
) as v(quote, name, role, rating, status, source, position, approved_at)
where not exists (select 1 from reviews);
