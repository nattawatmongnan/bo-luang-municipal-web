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
  created_at timestamptz not null default now(),
  constraint care_tracker_demo_device_chk
    check (device_id ~ '^DEMO-TRACKER-[0-9]{3}$'),
  constraint care_tracker_demo_event_chk
    check (event_type in ('MOVE','SOS','LOW_BATTERY','OFFLINE','ONLINE','RESET')),
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
