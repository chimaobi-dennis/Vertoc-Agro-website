-- 020: notifications sent to suppliers about an opportunity (bid invitation).
-- One row per supplier per send: who, when, whether it was delivered, who sent it,
-- and whether it was the first notice or an authorised resend. Safe to run more than once.

create table if not exists tender_notices (
  id             bigint generated always as identity primary key,
  tender_id      bigint not null references tenders(id) on delete cascade,
  supplier_id    bigint references suppliers(id) on delete set null,
  supplier_name  text not null default '',
  email          text not null default '',
  kind           text not null default 'initial' check (kind in ('initial', 'resend')),
  status         text not null default 'sent' check (status in ('sent', 'failed', 'queued')),
  error          text not null default '',
  message_id     bigint,                                   -- the email in the supplier conversation
  initiated_by   uuid references auth.users(id) on delete set null,
  initiated_name text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists idx_tender_notices_tender on tender_notices (tender_id, created_at desc);
create index if not exists idx_tender_notices_supplier on tender_notices (tender_id, supplier_id);
alter table tender_notices enable row level security;   -- reached only through the service role
