-- 008: staff positions. Shown on the Users pages and used in emails so the
-- reader knows who wrote ("Precious Ubadire, Managing Director").
-- Safe to run more than once.
alter table profiles add column if not exists position text not null default '';
