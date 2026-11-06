-- Insurance card on the Profile tab: a photo (or PDF) of the front and back of
-- the user's insurance card. Files go in their own private bucket under the
-- user's folder ("<user id>/..."), so only the owner can see them.
-- Safe to re-run.

alter table public.profiles
  add column if not exists insurance_front_path text,
  add column if not exists insurance_back_path text;

-- Private bucket: images and PDFs, up to 10 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('insurance-cards', 'insurance-cards', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Same per-user folder rules as the other buckets.
drop policy if exists "insurance: read own" on storage.objects;
drop policy if exists "insurance: upload own" on storage.objects;
drop policy if exists "insurance: update own" on storage.objects;
drop policy if exists "insurance: delete own" on storage.objects;

create policy "insurance: read own" on storage.objects for select to authenticated
  using (bucket_id = 'insurance-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "insurance: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'insurance-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "insurance: update own" on storage.objects for update to authenticated
  using (bucket_id = 'insurance-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "insurance: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'insurance-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);
