-- Firmenlogo: Bucket und Rechte
begin;
select plan(7);

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),
  ('a0000000-0000-4000-8000-000000000002', 'koch@firma-a.test'),
  ('b0000000-0000-4000-8000-000000000001', 'bernd@firma-b.test');
insert into public.companies (id, name, contact_email) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test'),
  ('b1000000-0000-4000-8000-000000000001', 'Firma B', 'b@firma-b.test');
insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days'),
  ('b1000000-0000-4000-8000-000000000001', now() - interval '1 day');
insert into public.company_members (id, company_id, user_id, role, display_name) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'admin', 'Anna'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'kitchen', 'Koch'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'admin', 'Bernd');

select is((select public from storage.buckets where id = 'logos'), true, 'Der Bucket logos ist öffentlich (Logos erscheinen in Portal und PDF)');
select is((select file_size_limit from storage.buckets where id = 'logos'), 2097152::bigint, 'Höchstens 2 MB');
select is((select allowed_mime_types from storage.buckets where id = 'logos'), array['image/png', 'image/jpeg'], 'Nur PNG und JPEG (kein SVG)');

set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$insert into storage.objects (bucket_id, name) values ('logos', 'a1000000-0000-4000-8000-000000000001/logo-1.png')$$,
                'Der Admin lädt ein Logo in den eigenen Ordner');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('logos', 'b1000000-0000-4000-8000-000000000001/logo-1.png')$$,
                 '42501', null, 'In den Ordner einer anderen Firma geht es nicht');
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$insert into storage.objects (bucket_id, name) values ('logos', 'a1000000-0000-4000-8000-000000000001/logo-2.png')$$,
                 '42501', null, 'Die Küche lädt kein Logo hoch');
set local request.jwt.claims = '{"sub":"b0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$insert into storage.objects (bucket_id, name) values ('logos', 'b1000000-0000-4000-8000-000000000001/logo-3.png')$$,
                 '42501', null, 'Im Lesemodus (Abo abgelaufen) geht kein Upload');

reset role;
select * from finish();
rollback;
