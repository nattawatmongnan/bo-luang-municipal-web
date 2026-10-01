-- Bo Luang Municipal Web R2 - Supabase schema
-- Production-connected schema. Do not add service/secret keys here.

create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_type
    where typname = 'app_role' and typnamespace = 'public'::regnamespace
  ) then
    create type public.app_role as enum ('citizen','staff','department','executive','admin');
  end if;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'citizen',
  department text,
  created_at timestamptz not null default now()
);

create table if not exists public.municipal_incidents (
  id uuid primary key default gen_random_uuid(),
  tracking_no text unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  category text not null,
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 3 and 4000),
  urgency text not null default 'MEDIUM' check (urgency in ('LOW','MEDIUM','HIGH')),
  status text not null default 'RECEIVED'
    check (status in ('RECEIVED','VERIFYING','IN_PROGRESS','DONE','CLOSED')),
  reporter_name text,
  reporter_phone text,
  anonymous boolean not null default false,
  village text not null,
  house_number text,
  landmark text,
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  assigned_department text,
  public_note text,
  photo_url text
);

create table if not exists public.incident_status_history (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.municipal_incidents(id) on delete cascade,
  status text not null,
  public_note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.set_tracking_no()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  if new.tracking_no is null then
    new.tracking_no := 'BLM-' ||
      (extract(year from now())::int + 543)::text || '-' ||
      upper(substr(replace(new.id::text,'-',''),1,10));
  end if;
  return new;
end;
$$;

drop trigger if exists municipal_incident_tracking_before_insert on public.municipal_incidents;
create trigger municipal_incident_tracking_before_insert
before insert on public.municipal_incidents
for each row execute function public.set_tracking_no();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path=public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists municipal_incident_touch_updated_at on public.municipal_incidents;
create trigger municipal_incident_touch_updated_at
before update on public.municipal_incidents
for each row execute function public.touch_updated_at();

create or replace function private.current_role()
returns public.app_role
language sql
stable
security definer
set search_path=public,private
as $$
  select coalesce(
    (select role from public.profiles where id=(select auth.uid())),
    'citizen'::public.app_role
  );
$$;
revoke all on function private.current_role() from public;
grant execute on function private.current_role() to authenticated;

alter table public.profiles enable row level security;
alter table public.municipal_incidents enable row level security;
alter table public.incident_status_history enable row level security;

create policy profiles_read_self on public.profiles
for select to authenticated
using (id=(select auth.uid()));

create policy profiles_read_admin on public.profiles
for select to authenticated
using (private.current_role()='admin');

create policy incidents_read_owner on public.municipal_incidents
for select to authenticated
using (created_by=(select auth.uid()));

create policy incidents_read_staff on public.municipal_incidents
for select to authenticated
using (private.current_role() in ('staff','department','executive','admin'));

create policy incidents_update_staff on public.municipal_incidents
for update to authenticated
using (private.current_role() in ('staff','department','admin'))
with check (private.current_role() in ('staff','department','admin'));

create policy history_read_staff on public.incident_status_history
for select to authenticated
using (private.current_role() in ('staff','department','executive','admin'));

create policy history_insert_staff on public.incident_status_history
for insert to authenticated
with check (
  private.current_role() in ('staff','department','admin')
  and changed_by=(select auth.uid())
);

create or replace function public.submit_incident(
  p_category text,
  p_title text,
  p_description text,
  p_village text,
  p_house_number text default null,
  p_reporter_name text default null,
  p_reporter_phone text default null,
  p_urgency text default 'MEDIUM'
)
returns table(tracking_no text)
language plpgsql
security definer
set search_path=public
as $$
declare v_id uuid;
begin
  if char_length(trim(coalesce(p_title,''))) < 3 or char_length(trim(p_title)) > 160 then
    raise exception 'invalid title';
  end if;
  if char_length(trim(coalesce(p_description,''))) < 3 or char_length(trim(p_description)) > 4000 then
    raise exception 'invalid description';
  end if;
  if char_length(trim(coalesce(p_village,''))) < 1 or char_length(trim(p_village)) > 120 then
    raise exception 'invalid village';
  end if;
  if p_urgency not in ('LOW','MEDIUM','HIGH') then
    raise exception 'invalid urgency';
  end if;
  if p_reporter_phone is not null
     and p_reporter_phone <> ''
     and length(regexp_replace(p_reporter_phone,'[^0-9]','','g')) not between 9 and 10 then
    raise exception 'invalid phone';
  end if;

  insert into public.municipal_incidents(
    category,title,description,village,house_number,
    reporter_name,reporter_phone,urgency,status,created_by
  )
  values(
    left(trim(coalesce(p_category,'อื่นๆ')),100),
    trim(p_title),
    trim(p_description),
    trim(p_village),
    nullif(left(trim(coalesce(p_house_number,'')),100),''),
    nullif(left(trim(coalesce(p_reporter_name,'')),160),''),
    nullif(left(trim(coalesce(p_reporter_phone,'')),30),''),
    p_urgency,
    'RECEIVED',
    null
  )
  returning id into v_id;

  return query select i.tracking_no
  from public.municipal_incidents i
  where i.id=v_id;
end;
$$;

revoke all on function public.submit_incident(text,text,text,text,text,text,text,text) from public;
grant execute on function public.submit_incident(text,text,text,text,text,text,text,text) to anon,authenticated;

create or replace function public.track_incident(
  p_tracking_no text,
  p_phone_last4 text default ''
)
returns table(
  tracking_no text,
  category text,
  title text,
  status text,
  urgency text,
  village text,
  assigned_department text,
  public_note text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path=public
as $$
  select
    i.tracking_no,i.category,i.title,i.status,i.urgency,i.village,
    i.assigned_department,i.public_note,i.created_at,i.updated_at
  from public.municipal_incidents i
  where upper(i.tracking_no)=upper(trim(p_tracking_no))
    and (
      i.reporter_phone is null
      or (
        length(regexp_replace(coalesce(p_phone_last4,''),'[^0-9]','','g'))=4
        and right(regexp_replace(i.reporter_phone,'[^0-9]','','g'),4)
          = regexp_replace(p_phone_last4,'[^0-9]','','g')
      )
    )
  limit 1;
$$;

revoke all on function public.track_incident(text,text) from public;
grant execute on function public.track_incident(text,text) to anon,authenticated;

grant usage on schema public to anon,authenticated;
grant select,update on public.municipal_incidents to authenticated;
grant select on public.profiles to authenticated;
grant select,insert on public.incident_status_history to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'incident-attachments','incident-attachments',false,5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict(id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
