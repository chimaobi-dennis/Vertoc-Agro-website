-- 013: departure time. Staff can say when a shipment left its origin; the
-- departure point is edited from the journey like any pin. Needs 012.
-- Safe to run more than once.
alter table shipments add column if not exists departed_at timestamptz;   -- null until staff set it
