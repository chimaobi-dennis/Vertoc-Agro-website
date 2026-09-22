-- 010: shipments. An invoice (API: quote) can leave on several trucks; each
-- shipment carries a share of the invoice (percent — the shares of the
-- non-cancelled shipments never exceed 100) and a trail of location
-- checkpoints staff drop state by state. Clients see them on the invoice
-- link. Safe to run more than once.
create table if not exists shipments (
  id           bigint generated always as identity primary key,
  quote_id     bigint not null references quotes(id) on delete cascade,
  number       integer not null default 1,                 -- 1, 2, 3… within the invoice
  percent      numeric(5,2) not null check (percent > 0 and percent <= 100),
  status       text not null default 'planned',            -- planned | in_transit | delivered | cancelled
  origin       jsonb not null default '{}'::jsonb,         -- {name, state, lat, lng}
  destination  jsonb not null default '{}'::jsonb,
  vehicle      text not null default '',                   -- truck, plate, driver — shown to the client
  notes        text not null default '',                   -- shown to the client
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  delivered_at timestamptz
);
create index if not exists idx_shipments_quote on shipments(quote_id, number);

create table if not exists shipment_checkpoints (
  id           bigint generated always as identity primary key,
  shipment_id  bigint not null references shipments(id) on delete cascade,
  name         text not null,                              -- "Abeokuta, Ogun"
  state        text not null default '',
  lat          double precision not null,
  lng          double precision not null,
  note         text not null default '',
  created_by   uuid,
  created_at   timestamptz not null default now()
);
create index if not exists idx_checkpoints_shipment on shipment_checkpoints(shipment_id, created_at);

alter table shipments enable row level security;             -- backend only (service role)
alter table shipment_checkpoints enable row level security;
