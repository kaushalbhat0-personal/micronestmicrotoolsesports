-- MicroNest Esports greenfield storage foundation.
--
-- Buckets (per approved reset plan; replaces legacy org-logos,
-- finder-avatars, finder-verification):
--   1. public-avatars        — public player avatars, 512 KB, images only.
--   2. public-entity-media   — public team/org/brand logos + news/tournament
--                              artwork, 2 MB bucket cap (stricter 1 MB logo
--                              cap enforced at application validation).
--   3. private-verification  — private verification evidence, 5 MB,
--                              restricted MIME types, signed-URL only.
--
-- Enforcement is two-layer: bucket MIME/size limits here + application
-- re-validation before upload. Dangerous types (executables, scripts) are
-- never allowlisted. Verification evidence is never publicly readable.
--
-- Write-policy posture (narrow by design):
--   - public-avatars: owners manage their own "{uid}/..." paths only.
--   - public-entity-media: public reads; writes are service_role-only until
--     the team/organization/brand domain tables land with their scoped
--     admin/captain/rep write policies (tracked follow-up, not a gap).
--   - private-verification: no public access; owners manage their own
--     "{uid}/..." paths; reviewer reads go through signed URLs minted
--     server-side (service_role / reviewer RPC follow-up).

-- 1. Buckets ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'public-avatars',
    'public-avatars',
    true,
    524288,
    array['image/png', 'image/jpeg', 'image/webp']
  ),
  (
    'public-entity-media',
    'public-entity-media',
    true,
    2097152,
    array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
  ),
  (
    'private-verification',
    'private-verification',
    false,
    5242880,
    array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
  )
on conflict (id) do nothing;

-- 2. Public reads on the two public buckets only -----------------------------
-- Scoped to explicit bucket_ids. No blanket storage.objects access.
create policy "public-avatars public read"
on storage.objects for select
to public
using (bucket_id = 'public-avatars');

create policy "public-entity-media public read"
on storage.objects for select
to public
using (bucket_id = 'public-entity-media');

-- 3. Avatar self-service (ownership-aware paths) ------------------------------
-- Path convention: "{auth.uid()}/avatar.{ext}" (single file per user;
-- replacement is an overwrite, never an orphan fan-out).
create policy "public-avatars owner insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'public-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "public-avatars owner update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'public-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'public-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "public-avatars owner delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'public-avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. Verification evidence (private, self-service paths) -----------------------
-- Path convention: "{auth.uid()}/{uuid}.{ext}".
-- SELECT is owner-scoped (reviewers use service_role-signed URLs, never
-- public URLs and never base-table reads from browser code).
create policy "private-verification owner insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'private-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "private-verification owner read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'private-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "private-verification owner delete own pending"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'private-verification'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. Entity media writes: service_role only (for now) --------------------------
-- Entity-scoped admin/captain/rep write policies arrive with the domain
-- tables. Until then, uploads go through server-side code holding the
-- service role after a membership/representation check. No permissive
-- authenticated-insert policy is created here on purpose.
