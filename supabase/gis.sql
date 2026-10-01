-- GIS/PostGIS layer for Bo Luang Municipal Web

create extension if not exists postgis with schema extensions;

alter table public.municipal_incidents
  add column if not exists location extensions.geography(Point,4326);

create or replace function public.sync_incident_location()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.lat is not null and new.lng is not null then
    new.location := extensions.st_setsrid(
      extensions.st_makepoint(new.lng, new.lat),
      4326
    )::extensions.geography;
  else
    new.location := null;
  end if;
  return new;
end;
$$;

drop trigger if exists municipal_incident_sync_location on public.municipal_incidents;
create trigger municipal_incident_sync_location
before insert or update of lat,lng
on public.municipal_incidents
for each row execute function public.sync_incident_location();

create index if not exists municipal_incidents_location_gix
  on public.municipal_incidents using gist (location);

drop view if exists public.gis_incidents;
create view public.gis_incidents
with (security_invoker = true)
as
select
  id, tracking_no, created_at, updated_at, category, title, urgency, status,
  village, assigned_department, public_note, lat, lng,
  location::extensions.geometry as geom
from public.municipal_incidents
where location is not null;

grant select on public.gis_incidents to authenticated;
