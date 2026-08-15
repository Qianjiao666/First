-- v1.1 reviewed avatar storage contract.
-- Browser roles may read approved avatars, but all writes remain service-role only.

alter table public.user_public_profiles
  add column if not exists avatar text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_public_read on storage.objects;
create policy avatars_public_read
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] ~* '^[0-9a-f-]{36}$'
);

-- Intentionally no avatars INSERT, UPDATE or DELETE policy for browser roles.
-- The authenticated avatar-upload Edge Function performs reviewed writes with service role.
