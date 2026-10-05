-- Care Tracker Demo persistence
-- Applied to Supabase project emfjpppexfiiwrrgmnvo.
-- This table stores DEMO-ONLY device events. It is intentionally separate
-- from municipal_incidents so simulated alerts never mix with real reports.

create table if not exists public.care_tracker_demo_events (
  id uuid primary key default gen_random_uuid(),
  device_id text not null default 'DEMO-TRACKER-001',
  event_type text not null,
  device_state text not null default 'ONLINE',
  battery integer not null check (battery between 0 and 100),
  lat double precision,
  lng double precision,
  note text,
  alert_status text not null default 'NEW' check (alert_status in ('NEW','ACCEPTED','IN_PROGRESS','CLOSED')),
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  started_at timestamptz,
  started_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint care_tracker_demo_device_chk
    check (device_id ~ '^DEMO-TRACKER-[0-9]{3}$'),
  constraint care_tracker_demo_event_chk
    check (event_type in ('MOVE','SOS','LOW_BATTERY','OFFLINE','ONLINE','RESET','GEOFENCE_ALERT','OFFLINE_ALERT')),
  constraint care_tracker_demo_state_chk
    check (device_state in ('ONLINE','OFFLINE','SOS')),
  constraint care_tracker_demo_lat_chk
    check (lat is null or lat between -90 and 90),
  constraint care_tracker_demo_lng_chk
    check (lng is null or lng between -180 and 180)
);

alter table public.care_tracker_demo_events enable row level security;

revoke all on table public.care_tracker_demo_events from anon, authenticated;
grant select on table public.care_tracker_demo_events to authenticated;

drop policy if exists care_tracker_demo_staff_select on public.care_tracker_demo_events;
create policy care_tracker_demo_staff_select
on public.care_tracker_demo_events
for select
to authenticated
using (private.current_role() in ('staff','department','executive','admin'));

create index if not exists care_tracker_demo_events_created_at_idx
  on public.care_tracker_demo_events(created_at desc);

create or replace function public.consume_care_tracker_demo_rate_limit()
returns boolean
language sql
security definer
set search_path = public, private
as $$
  select private.consume_api_rate_limit('care_tracker_demo', 30, 600);
$$;

revoke all on function public.consume_care_tracker_demo_rate_limit() from public, anon, authenticated;
grant execute on function public.consume_care_tracker_demo_rate_limit() to service_role;


-- Enable staff Realtime inserts for the demo alert panel.
-- Run only if the table is not already in the publication.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'care_tracker_demo_events'
  ) then
    alter publication supabase_realtime add table public.care_tracker_demo_events;
  end if;
end $$;


-- Staff acknowledgement for demo alerts.
revoke update on table public.care_tracker_demo_events from anon, authenticated;

create or replace function private.accept_care_tracker_demo_alert(p_event_id uuid)
returns table (
  id uuid,
  alert_status text,
  accepted_at timestamptz,
  accepted_by uuid
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if private.current_role() not in ('staff','department','admin') then
    raise exception 'FORBIDDEN';
  end if;

  return query
  update public.care_tracker_demo_events e
  set
    alert_status = 'ACCEPTED',
    accepted_at = coalesce(e.accepted_at, now()),
    accepted_by = coalesce(e.accepted_by, auth.uid())
  where e.id = p_event_id
    and e.event_type in ('SOS','GEOFENCE_ALERT','OFFLINE_ALERT')
  returning e.id, e.alert_status, e.accepted_at, e.accepted_by;
end;
$$;

revoke all on function private.accept_care_tracker_demo_alert(uuid) from public, anon;
grant execute on function private.accept_care_tracker_demo_alert(uuid) to authenticated;

create or replace function public.accept_care_tracker_demo_alert(p_event_id uuid)
returns table (
  id uuid,
  alert_status text,
  accepted_at timestamptz,
  accepted_by uuid
)
language sql
security invoker
set search_path = public, private
as $$
  select * from private.accept_care_tracker_demo_alert(p_event_id);
$$;

revoke all on function public.accept_care_tracker_demo_alert(uuid) from public, anon;
grant execute on function public.accept_care_tracker_demo_alert(uuid) to authenticated;


-- Demo response workflow: accepted -> in progress -> closed.
create or replace function private.set_care_tracker_demo_alert_status(
  p_event_id uuid,
  p_status text
)
returns table (
  id uuid,
  alert_status text,
  accepted_at timestamptz,
  accepted_by uuid,
  started_at timestamptz,
  started_by uuid,
  closed_at timestamptz,
  closed_by uuid
)
language plpgsql
security definer
set search_path = public, private, auth
as $$
declare
  v_current_status text;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  if private.current_role() not in ('staff','department','admin') then
    raise exception 'FORBIDDEN';
  end if;

  if p_status not in ('IN_PROGRESS','CLOSED') then
    raise exception 'INVALID_STATUS';
  end if;

  select e.alert_status
  into v_current_status
  from public.care_tracker_demo_events e
  where e.id = p_event_id
    and e.event_type in ('SOS','GEOFENCE_ALERT','OFFLINE_ALERT')
  for update;

  if v_current_status is null then
    return;
  end if;

  if p_status = 'IN_PROGRESS' and v_current_status <> 'ACCEPTED' then
    raise exception 'INVALID_TRANSITION';
  end if;

  if p_status = 'CLOSED' and v_current_status not in ('ACCEPTED','IN_PROGRESS') then
    raise exception 'INVALID_TRANSITION';
  end if;

  return query
  update public.care_tracker_demo_events e
  set
    alert_status = p_status,
    started_at = case
      when p_status = 'IN_PROGRESS' then coalesce(e.started_at, now())
      else e.started_at
    end,
    started_by = case
      when p_status = 'IN_PROGRESS' then coalesce(e.started_by, auth.uid())
      else e.started_by
    end,
    closed_at = case
      when p_status = 'CLOSED' then coalesce(e.closed_at, now())
      else e.closed_at
    end,
    closed_by = case
      when p_status = 'CLOSED' then coalesce(e.closed_by, auth.uid())
      else e.closed_by
    end
  where e.id = p_event_id
  returning
    e.id,
    e.alert_status,
    e.accepted_at,
    e.accepted_by,
    e.started_at,
    e.started_by,
    e.closed_at,
    e.closed_by;
end;
$$;

revoke all on function private.set_care_tracker_demo_alert_status(uuid,text) from public, anon;
grant execute on function private.set_care_tracker_demo_alert_status(uuid,text) to authenticated;

create or replace function public.set_care_tracker_demo_alert_status(
  p_event_id uuid,
  p_status text
)
returns table (
  id uuid,
  alert_status text,
  accepted_at timestamptz,
  accepted_by uuid,
  started_at timestamptz,
  started_by uuid,
  closed_at timestamptz,
  closed_by uuid
)
language sql
security invoker
set search_path = public, private
as $$
  select * from private.set_care_tracker_demo_alert_status(p_event_id, p_status);
$$;

revoke all on function public.set_care_tracker_demo_alert_status(uuid,text) from public, anon;
grant execute on function public.set_care_tracker_demo_alert_status(uuid,text) to authenticated;
