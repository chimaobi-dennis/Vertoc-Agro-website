-- 011: shipment details. A shipment's share is per invoice line (items), it
-- travels by road, sea or air with a vehicle number, and has an expected
-- arrival date. Needs 010 first. Safe to run more than once.
alter table shipments add column if not exists items jsonb not null default '[]'::jsonb;  -- [{index, description, quantity, unit, percent}]
alter table shipments add column if not exists mode  text  not null default 'road';       -- road | sea | air
alter table shipments add column if not exists eta   date;                                -- expected arrival
