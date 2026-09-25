-- 012: checkpoint times. Staff say when a shipment was at a place (`at`),
-- separately from when the pin was entered (`created_at`), and can edit it
-- later; the journey is ordered by `at`. Also carries 011's columns so a
-- database still at 010 catches up in one run. Safe to run more than once.
alter table shipments add column if not exists items jsonb not null default '[]'::jsonb;
alter table shipments add column if not exists mode  text  not null default 'road';
alter table shipments add column if not exists eta   date;

alter table shipment_checkpoints add column if not exists at timestamptz;
update shipment_checkpoints set at = created_at where at is null;
alter table shipment_checkpoints alter column at set default now();
alter table shipment_checkpoints alter column at set not null;
create index if not exists idx_checkpoints_shipment_at on shipment_checkpoints(shipment_id, at);
