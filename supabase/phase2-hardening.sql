-- Phase 2 hardening / operations SQL
-- Applied to Supabase project emfjpppexfiiwrrgmnvo on 2026-10-01.
-- No production data deletion.

create table if not exists private.api_rate_limit_events (
  id bigint generated always as identity primary key,
  action text not null,
  client_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists api_rate_limit_events_lookup_idx
on private.api_rate_limit_events(action, client_hash, created_at desc);

alter table private.api_rate_limit_events enable row level security;

drop policy if exists api_rate_limits_deny_clients on private.api_rate_limit_events;
create policy api_rate_limits_deny_clients
on private.api_rate_limit_events
for all
to anon, authenticated
using (false)
with check (false);

create or replace function private.consume_api_rate_limit(
  p_action text,
  p_max_requests integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path=private,public
as $$
declare
  v_headers jsonb;
  v_forwarded text;
  v_ip text;
  v_hash text;
  v_count integer;
begin
  begin
    v_headers := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  v_forwarded := coalesce(
    nullif(v_headers->>'x-forwarded-for',''),
    nullif(v_headers->>'cf-connecting-ip',''),
    nullif(v_headers->>'x-real-ip','')
  );

  if v_forwarded is null then
    return true;
  end if;

  v_ip := trim(split_part(v_forwarded, ',', 1));
  v_hash := md5(v_ip || ':' || current_database());

  delete from private.api_rate_limit_events
  where action=p_action and client_hash=v_hash
    and created_at < now() - make_interval(secs => greatest(p_window_seconds,1));

  select count(*) into v_count
  from private.api_rate_limit_events
  where action=p_action and client_hash=v_hash
    and created_at >= now() - make_interval(secs => greatest(p_window_seconds,1));

  if v_count >= greatest(p_max_requests,1) then
    return false;
  end if;

  insert into private.api_rate_limit_events(action,client_hash) values(p_action,v_hash);
  return true;
end;
$$;

revoke all on function private.consume_api_rate_limit(text,integer,integer)
from public, anon, authenticated;

-- submit_incident and track_incident are intentionally public anonymous RPCs.
-- Their current deployed definitions call private.consume_api_rate_limit:
-- submit: 5 requests / 10 minutes per forwarded client IP
-- track: 30 requests / 10 minutes per forwarded client IP
-- Keep full current definitions synchronized with the live database before applying this file elsewhere.

create or replace function public.update_incident_status(
  p_incident_id uuid,
  p_status text,
  p_public_note text default null,
  p_assigned_department text default null
)
returns public.municipal_incidents
language plpgsql
security invoker
set search_path=public,private
as $$
declare
  v_role public.app_role;
  v_row public.municipal_incidents;
begin
  v_role := private.current_role();
  if v_role not in ('staff','department','admin') then
    raise exception 'FORBIDDEN';
  end if;

  if p_status not in ('RECEIVED','VERIFYING','IN_PROGRESS','DONE','CLOSED') then
    raise exception 'invalid status';
  end if;

  update public.municipal_incidents
  set
    status=p_status,
    public_note=nullif(left(trim(coalesce(p_public_note,'')),1000),''),
    assigned_department=coalesce(
      nullif(left(trim(coalesce(p_assigned_department,'')),160),''),
      assigned_department
    )
  where id=p_incident_id
  returning * into v_row;

  if v_row.id is null then
    raise exception 'incident not found';
  end if;

  insert into public.incident_status_history(
    incident_id,status,public_note,changed_by
  ) values(
    v_row.id,v_row.status,v_row.public_note,(select auth.uid())
  );

  return v_row;
end;
$$;

revoke all on function public.update_incident_status(uuid,text,text,text)
from public, anon;
grant execute on function public.update_incident_status(uuid,text,text,text)
to authenticated;

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin
on public.profiles
for update
to authenticated
using (private.current_role()='admin')
with check (private.current_role()='admin');

grant update(display_name,role,department) on public.profiles to authenticated;
