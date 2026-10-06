-- 018: staff profiles — picture, phone, department, reporting line, and an
-- automatic, permanent Staff ID.
--
-- The Staff ID (VA-STF-0001, 0002 …) is given by the database the moment a
-- profile becomes active (an invited staff member being added), never typed
-- by anyone, and cannot change afterwards, even if the account is later
-- deactivated. Portal accounts never get one (their inactive profile row is
-- removed). Safe to run more than once.

alter table profiles add column if not exists staff_id   text;
alter table profiles add column if not exists phone      text not null default '';
alter table profiles add column if not exists department text not null default '';
alter table profiles add column if not exists reports_to uuid references profiles(id) on delete set null;
alter table profiles add column if not exists avatar_url text not null default '';
create unique index if not exists idx_profiles_staff_id on profiles (staff_id) where staff_id is not null;

create sequence if not exists staff_id_seq;

create or replace function assign_staff_id() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.staff_id is not null then
    new.staff_id := old.staff_id;                      -- permanent: nobody can change or clear it
  elsif tg_op = 'INSERT' and exists (select 1 from profiles where id = new.id) then
    new.staff_id := null;                              -- an upsert onto an existing row: the update that follows assigns it, so no number is wasted
  elsif new.active then
    new.staff_id := 'VA-STF-' || lpad(nextval('staff_id_seq')::text, 4, '0');
  else
    new.staff_id := null;
  end if;
  return new;
end $$;

drop trigger if exists profiles_staff_id on profiles;
create trigger profiles_staff_id before insert or update on profiles for each row execute function assign_staff_id();

-- Everyone already active gets one, oldest first.
do $$
declare r record;
begin
  for r in select id from profiles where active and staff_id is null order by created_at loop
    update profiles set active = active where id = r.id;
  end loop;
end $$;
