-- 021: cancelling an LPO / PO keeps the order and records why, who and when,
-- plus whether and when the supplier was told. The record of each cancellation
-- is permanent: ordinary updates and deletes are refused by the database
-- (only the supplier-notification result can be filled in afterwards).
-- Safe to run more than once.

alter table purchase_orders add column if not exists cancelled_at   timestamptz;
alter table purchase_orders add column if not exists cancelled_by   uuid references auth.users(id) on delete set null;
alter table purchase_orders add column if not exists cancelled_name text not null default '';
alter table purchase_orders add column if not exists cancel_reason  text not null default '';
alter table purchase_orders add column if not exists cancel_notify_status text not null default '';   -- sent | failed | not_needed
alter table purchase_orders add column if not exists cancel_notified_at   timestamptz;

create table if not exists po_cancellations (
  id              bigint generated always as identity primary key,
  po_id           bigint references purchase_orders(id) on delete set null,
  po_number       text not null,
  po_kind         text not null default 'lpo',
  supplier_name   text not null default '',
  previous_status text not null default '',
  reason          text not null,
  cancelled_by    uuid references auth.users(id) on delete set null,
  cancelled_name  text not null default '',
  cancelled_at    timestamptz not null default now(),
  notify_status   text not null default '' check (notify_status in ('', 'sent', 'failed', 'not_needed')),
  notified_at     timestamptz,
  notify_error    text not null default '',
  message_id      bigint
);
create index if not exists idx_po_cancellations_po on po_cancellations (po_id, cancelled_at desc);

create or replace function po_cancellations_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'Cancellation records cannot be deleted'; end if;
  if (new.po_number, new.po_kind, new.supplier_name, new.previous_status, new.reason, new.cancelled_by, new.cancelled_name, new.cancelled_at)
     is distinct from (old.po_number, old.po_kind, old.supplier_name, old.previous_status, old.reason, old.cancelled_by, old.cancelled_name, old.cancelled_at)
  then raise exception 'Cancellation records cannot be changed'; end if;
  return new;
end $$;
drop trigger if exists po_cancellations_immutable on po_cancellations;
create trigger po_cancellations_immutable before update or delete on po_cancellations for each row execute function po_cancellations_guard();
alter table po_cancellations enable row level security;   -- reached only through the service role
