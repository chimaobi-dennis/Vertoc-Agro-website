-- 019: investor profile fields and change requests.
--
-- Individual investors get the full personal profile (title, first / middle /
-- last name, nickname, date of birth, nationality, state of origin, LGA, a
-- second phone number, a profile picture). Once a value is on record an
-- investor cannot overwrite it: they submit a change request with a reason and
-- supporting documents, an Investment reviewer recommends it and an Admin
-- accepts it, and only then does the official profile change. Every request
-- keeps what it replaced, who reviewed it and when. Safe to run more than once.

alter table investors add column if not exists investor_type    text not null default 'individual';
alter table investors add column if not exists title            text not null default '';
alter table investors add column if not exists first_name       text not null default '';
alter table investors add column if not exists middle_name      text not null default '';
alter table investors add column if not exists last_name        text not null default '';
alter table investors add column if not exists nickname         text not null default '';
alter table investors add column if not exists alt_phone        text not null default '';
alter table investors add column if not exists state_of_origin  text not null default '';
alter table investors add column if not exists lga              text not null default '';
alter table investors add column if not exists date_of_birth    date;
alter table investors add column if not exists nationality      text not null default '';
alter table investors add column if not exists avatar_document_id bigint references documents(id) on delete set null;

create table if not exists investor_change_requests (
  id            bigint generated always as identity primary key,
  investor_id   bigint not null references investors(id) on delete cascade,
  status        text not null default 'submitted'
                check (status in ('draft', 'submitted', 'under_review', 'resubmission_required', 'approved', 'rejected', 'cancelled')),
  changes       jsonb not null default '{}'::jsonb,      -- { field: { from, to } }
  reason        text not null default '',
  document_ids  jsonb not null default '[]'::jsonb,      -- supporting documents the investor attached
  previous_id   bigint references investor_change_requests(id) on delete set null,   -- the submission this one corrects
  superseded_by bigint references investor_change_requests(id) on delete set null,
  submitted_at  timestamptz not null default now(),
  recommended_by uuid references auth.users(id) on delete set null,   -- an Investment reviewer's recommendation; an Admin still has to accept
  recommended_name text not null default '',
  recommended_at timestamptz,
  reviewer_id   uuid references auth.users(id) on delete set null,    -- who decided
  reviewer_name text not null default '',
  reviewed_at   timestamptz,
  review_note   text not null default '',
  history       jsonb not null default '[]'::jsonb,      -- [{ at, by, action, note }]
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_icr_investor on investor_change_requests (investor_id, created_at desc);
create index if not exists idx_icr_status on investor_change_requests (status, created_at desc);
drop trigger if exists icr_touch on investor_change_requests;
create trigger icr_touch before update on investor_change_requests for each row execute function touch_updated_at();
alter table investor_change_requests enable row level security;   -- reached only through the service role
