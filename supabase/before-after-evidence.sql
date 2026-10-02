-- Before/after evidence support
-- Applied to Supabase project emfjpppexfiiwrrgmnvo on 2026-10-02.
-- No production data deletion.

alter table public.municipal_incidents
  add column if not exists resolution_photo_url text,
  add column if not exists resolution_photo_added_at timestamptz,
  add column if not exists resolution_photo_added_by uuid references auth.users(id) on delete set null;

drop policy if exists incident_attachments_staff_resolution_insert on storage.objects;
create policy incident_attachments_staff_resolution_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'incident-attachments'
  and (storage.foldername(name))[1] = 'staff-resolution'
  and private.current_role() in ('staff','department','admin')
);

drop policy if exists incident_attachments_staff_resolution_delete on storage.objects;
create policy incident_attachments_staff_resolution_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'incident-attachments'
  and (storage.foldername(name))[1] = 'staff-resolution'
  and private.current_role() in ('staff','department','admin')
);

create or replace function public.set_resolution_photo(
  p_incident_id uuid,
  p_photo_path text
)
returns table(
  incident_id uuid,
  resolution_photo_url text,
  resolution_photo_added_at timestamptz
)
language plpgsql
security invoker
set search_path=public,private,storage
as $$
declare
  v_role public.app_role;
begin
  v_role := private.current_role();
  if v_role not in ('staff','department','admin') then
    raise exception 'FORBIDDEN';
  end if;

  if p_photo_path is null
     or split_part(p_photo_path,'/',1) <> 'staff-resolution'
     or split_part(p_photo_path,'/',2) <> p_incident_id::text
     or p_photo_path !~ '\.(jpg|jpeg|png|webp)$'
  then
    raise exception 'INVALID_PHOTO_PATH';
  end if;

  if not exists (
    select 1
    from storage.objects
    where bucket_id='incident-attachments'
      and name=p_photo_path
  ) then
    raise exception 'PHOTO_NOT_FOUND';
  end if;

  update public.municipal_incidents
  set resolution_photo_url = p_photo_path,
      resolution_photo_added_at = now(),
      resolution_photo_added_by = (select auth.uid())
  where id = p_incident_id;

  if not found then
    raise exception 'INCIDENT_NOT_FOUND';
  end if;

  return query
  select i.id, i.resolution_photo_url, i.resolution_photo_added_at
  from public.municipal_incidents i
  where i.id=p_incident_id;
end;
$$;

revoke all on function public.set_resolution_photo(uuid,text) from public, anon;
grant execute on function public.set_resolution_photo(uuid,text) to authenticated;
