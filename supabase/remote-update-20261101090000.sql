-- ============================================================================
-- Update: Migrationen ab 20261101090000, zum Einfügen in den Supabase SQL Editor.
-- Setzt voraus, dass alle früheren Migrationen schon eingespielt sind.
-- Erzeugt mit: bash scripts/db/bundle.sh 20261101090000  (nicht von Hand ändern)
-- Nur EINMAL ausführen: Ein zweiter Lauf schlägt mit „already exists“ fehl.
-- ============================================================================

-- >>>>>>>>>> 20261101090000_m1_logos.sql
-- =====================================================================
-- M1 · Firmenlogo: Storage-Bucket `logos` (docs/03 §8)
-- Öffentlicher Bucket (die Bilder erscheinen in Portal und PDF), 2 MB, nur PNG und JPEG.
-- Pfad: {company_id}/logo-{uuid}.{png|jpg}. Schreiben und Löschen nur der Admin der Firma im Schreibmodus;
-- jeder Upload bekommt einen neuen Dateinamen, danach wird die alte Datei gelöscht.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg'])
on conflict (id) do nothing;

create policy logos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'logos'
              and (storage.foldername(name))[1] = (select public.auth_company_id())::text
              and (select public.auth_role()) = 'admin'
              and (select public.company_is_writable()));
create policy logos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'logos'
         and (storage.foldername(name))[1] = (select public.auth_company_id())::text
         and (select public.auth_role()) = 'admin');
