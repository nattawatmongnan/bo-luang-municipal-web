-- Audit hardening review SQL
-- Applied to project emfjpppexfiiwrrgmnvo on 2026-10-01.
-- This file is for code review / reproducibility. It does not delete production data.

update private.municipality_boundaries
set source = 'Reference ADM3 boundary TH501604 used by the current system; not yet verified against an official municipal boundary dataset'
where code='TH501604';

create or replace function public.submit_incident(
  p_category text,
  p_title text,
  p_description text,
  p_village text,
  p_house_number text default null,
  p_reporter_name text default null,
  p_reporter_phone text default null,
  p_urgency text default 'MEDIUM',
  p_photo_path text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_accuracy_m double precision default null,
  p_location_confirmed boolean default false
)
returns table(incident_id uuid, tracking_no text)
language plpgsql
security definer
set search_path=public,private,extensions
as $$
declare
  v_id uuid;
  v_point extensions.geometry(Point,4326);
  v_villages constant text[] := array[
    'หมู่ที่ 1 บ้านบ่อหลวง',
    'หมู่ที่ 2 บ้านวังกอง',
    'หมู่ที่ 3 บ้านขุน',
    'หมู่ที่ 4 บ้านนาฟ่อน',
    'หมู่ที่ 5 บ้านแม่ลายเหนือ (รวมบ้านแม่ลายใต้)',
    'หมู่ที่ 6 บ้านแม่ลายใต้ / บ้านพุย (บางส่วน)',
    'หมู่ที่ 7 บ้านพุย / บ้านกิ่วลม',
    'หมู่ที่ 8 บ้านกิ่วลม / บ้านเตียนอาง',
    'หมู่ที่ 10 บ้านเตียนอาง',
    'หมู่ที่ 11 บ้านบ่อสะแง๋',
    'หมู่ที่ 12 บ้านบ่อพะแวน (ที่ตั้งสำนักงานเทศบาลตำบลบ่อหลวง)',
    'หมู่ที่ 13 บ้านแม่หืด'
  ];
begin
  if char_length(trim(coalesce(p_title,''))) < 3 or char_length(trim(p_title)) > 160 then
    raise exception 'invalid title';
  end if;
  if char_length(trim(coalesce(p_description,''))) < 3 or char_length(trim(p_description)) > 4000 then
    raise exception 'invalid description';
  end if;
  if not (trim(coalesce(p_village,'')) = any(v_villages)) then
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
  if p_photo_path is not null then
    if p_photo_path !~ '^public-submissions/[A-Za-z0-9_-]+\.(jpg|jpeg|png|webp)$' then
      raise exception 'invalid photo path';
    end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id='incident-attachments' and name=p_photo_path
    ) then
      raise exception 'photo object not found';
    end if;
  end if;
  if p_lat is null or p_lng is null then
    raise exception 'location required';
  end if;
  if p_lat < -90 or p_lat > 90 then
    raise exception 'invalid latitude';
  end if;
  if p_lng < -180 or p_lng > 180 then
    raise exception 'invalid longitude';
  end if;
  if not coalesce(p_location_confirmed,false) then
    raise exception 'location not confirmed';
  end if;
  if p_accuracy_m is not null and (p_accuracy_m < 0 or p_accuracy_m > 100000) then
    raise exception 'invalid accuracy';
  end if;

  v_point := extensions.st_setsrid(extensions.st_makepoint(p_lng,p_lat),4326);
  if not exists (
    select 1
    from private.municipality_boundaries b
    where b.code='TH501604'
      and extensions.st_covers(b.geom,v_point)
  ) then
    raise exception 'OUTSIDE_BOLUANG';
  end if;

  insert into public.municipal_incidents(
    category,title,description,village,house_number,
    reporter_name,reporter_phone,urgency,status,created_by,photo_url,
    lat,lng,location_accuracy_m,location_confirmed
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
    null,
    p_photo_path,
    p_lat,
    p_lng,
    p_accuracy_m,
    true
  )
  returning id into v_id;

  return query
  select i.id, i.tracking_no
  from public.municipal_incidents i
  where i.id=v_id;
end;
$$;

revoke all on function public.submit_incident(
  text,text,text,text,text,text,text,text,text,double precision,double precision,double precision,boolean
) from public;
grant execute on function public.submit_incident(
  text,text,text,text,text,text,text,text,text,double precision,double precision,double precision,boolean
) to anon,authenticated;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;

revoke all on table public.municipal_incidents from anon, authenticated;
grant select, update on table public.municipal_incidents to authenticated;

revoke all on table public.incident_status_history from anon, authenticated;
grant select, insert on table public.incident_status_history to authenticated;

revoke all on table public.emergency_areas from anon, authenticated;
grant select, insert, update on table public.emergency_areas to authenticated;

revoke all on table public.gis_incidents from anon, authenticated;
grant select on table public.gis_incidents to authenticated;
