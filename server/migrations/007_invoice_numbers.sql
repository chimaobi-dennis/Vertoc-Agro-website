-- 007: invoice numbers are VA-YYYY-NNNN and staff may choose the digits.
-- The app now allocates numbers itself (next free number for the year,
-- honouring manually chosen ones, retrying on the unique index). Existing
-- VQ- numbers are renamed; the old SQL counter is kept for anyone inserting
-- rows by hand, with the new prefix and aware of manual numbers.
-- Safe to run more than once.

update quotes set number = 'VA-' || substr(number, 4) where number like 'VQ-%';

create or replace function next_quote_number() returns text
language plpgsql as $$
declare y integer := extract(year from now())::integer; used integer; v integer;
begin
  select coalesce(max(substring(number from '\d+$')::integer), 0) into used
    from quotes where number like format('VA-%s-%%', y);
  insert into quote_counters (year, n) values (y, used + 1)
  on conflict (year) do update set n = greatest(quote_counters.n, used) + 1
  returning n into v;
  return format('VA-%s-%s', y, lpad(v::text, 4, '0'));
end $$;
