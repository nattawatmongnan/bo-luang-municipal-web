create extension if not exists pgcrypto;

create type public.app_role as enum ('citizen','staff','department','executive','admin');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'citizen',
  department text,
  created_at timestamptz not null default now()
);

create table public.municipal_incidents (
  id uuid primary key default gen_random_uuid(),
  tracking_no text unique,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  category text not null,
  title text not null check (char_length(title) between 3 and 160),
  description text not null check (char_length(description) between 3 and 4000),
  urgency text not null default 'MEDIUM',
  status text not null default 'RECEIVED',
  reporter_name text,
  reporter_phone text,
  anonymous boolean not null default false,
  village text not null,
  house_number text,
  landmark text,
  lat double precision,
  lng double precision,
  assigned_department text,
  public_note text,
  photo_url text
);

create table public.incident_status_history (
  id bigint generated always as identity primary key,
  incident_id uuid not null references public.municipal_incidents(id) on delete cascade,
  status text not null,
  public_note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.current_role()
returns public.app_role language sql stable security definer set search_path=public
as $$ select coalesce((select role from public.profiles where id=auth.uid()),'citizen'::public.app_role); $$;

create or replace function public.set_tracking_no()
returns trigger language plpgsql as $$
begin
 if new.tracking_no is null then
  new.tracking_no := 'BLM-' || (extract(year from now())::int + 543)::text || '-' || upper(substr(replace(new.id::text,'-',''),1,10));
 end if;
 return new;
end; $$;

create trigger municipal_incident_tracking_before_insert
before insert on public.municipal_incidents
for each row execute function public.set_tracking_no();

alter table public.profiles enable row level security;
alter table public.municipal_incidents enable row level security;
alter table public.incident_status_history enable row level security;

create policy incidents_insert_anon on public.municipal_incidents
for insert to anon with check (created_by is null and status='RECEIVED');

create policy incidents_read_owner on public.municipal_incidents
for select to authenticated using (created_by=auth.uid());

create policy incidents_read_staff on public.municipal_incidents
for select to authenticated using (public.current_role() in ('staff','department','executive','admin'));

create policy incidents_update_staff on public.municipal_incidents
for update to authenticated
using (public.current_role() in ('staff','department','admin'))
with check (public.current_role() in ('staff','department','admin'));

create or replace function public.track_incident(p_tracking_no text,p_phone_last4 text default '')
returns table(tracking_no text,category text,title text,status text,urgency text,village text,assigned_department text,public_note text,created_at timestamptz,updated_at timestamptz)
language sql security definer set search_path=public
as $$
 select i.tracking_no,i.category,i.title,i.status,i.urgency,i.village,i.assigned_department,i.public_note,i.created_at,i.updated_at
 from public.municipal_incidents i
 where upper(i.tracking_no)=upper(trim(p_tracking_no))
 and (i.reporter_phone is null or right(regexp_replace(i.reporter_phone,'[^0-9]','','g'),4)=regexp_replace(p_phone_last4,'[^0-9]','','g'))
 limit 1;
$$;
revoke all on function public.track_incident(text,text) from public;
grant execute on function public.track_incident(text,text) to anon,authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('incident-attachments','incident-attachments',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
