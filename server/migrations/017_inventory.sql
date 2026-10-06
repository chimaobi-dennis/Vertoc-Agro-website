-- 017: inventory — goods received against approved purchase orders.
--
-- An approved order appears to Inventory as "expected". Each delivery that
-- arrives is a goods receipt: per order line, what was delivered and what
-- was accepted after counting, weighing and checking (the rest is rejected).
-- Stock only ever grows by the accepted quantity. Safe to run more than once.

alter table purchase_orders add column if not exists inventory_status text not null default 'expected';
alter table purchase_orders drop constraint if exists purchase_orders_inventory_status_check;
alter table purchase_orders add constraint purchase_orders_inventory_status_check
  check (inventory_status in ('expected', 'partially_received', 'fully_received', 'disputed', 'closed'));
alter table purchase_orders add column if not exists inventory_note text not null default '';
alter table purchase_orders add column if not exists inventory_closed_at timestamptz;
alter table purchase_orders add column if not exists inventory_closed_by uuid references auth.users(id) on delete set null;

create table if not exists goods_receipts (
  id            bigint generated always as identity primary key,
  number        text not null unique,                         -- GR-2026-0001
  po_id         bigint not null references purchase_orders(id) on delete cascade,
  received_at   timestamptz not null default now(),
  delivery_note text not null default '',                     -- waybill, truck or vessel reference
  notes         text not null default '',
  received_by   uuid references auth.users(id) on delete set null,
  received_name text not null default '',
  created_at    timestamptz not null default now()
);
create index if not exists idx_receipts_po on goods_receipts (po_id, received_at desc);

create table if not exists goods_receipt_lines (
  id          bigint generated always as identity primary key,
  receipt_id  bigint not null references goods_receipts(id) on delete cascade,
  po_id       bigint not null references purchase_orders(id) on delete cascade,
  item_index  int not null,                                   -- position of the line on the order
  description text not null default '',
  unit        text not null default '',
  delivered   numeric(14,3) not null default 0 check (delivered >= 0),
  accepted    numeric(14,3) not null default 0 check (accepted >= 0),
  note        text not null default '',
  check (accepted <= delivered)
);
create index if not exists idx_receipt_lines_po on goods_receipt_lines (po_id, item_index);
alter table goods_receipts enable row level security;
alter table goods_receipt_lines enable row level security;
