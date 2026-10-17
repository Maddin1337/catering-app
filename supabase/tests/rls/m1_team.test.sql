-- M1: Einladungen, Rollen, Qualifikationen, Entfernen, Konto löschen (docs/03 §4.7)
begin;
select plan(44);

-- ---------- Fixtures (als Eigentümer) ----------
insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'anna@firma-a.test'),     -- admin A
  ('a0000000-0000-4000-8000-000000000002', 'koch@firma-a.test'),     -- kitchen A
  ('a0000000-0000-4000-8000-000000000003', 'aushilfe@firma-a.test'), -- staff A
  ('b0000000-0000-4000-8000-000000000001', 'bernd@firma-b.test'),    -- admin B
  ('c0000000-0000-4000-8000-000000000001', 'neu@person.test'),       -- ohne Firma
  ('c0000000-0000-4000-8000-000000000002', 'andere@person.test'),    -- ohne Firma
  ('c0000000-0000-4000-8000-000000000003', 'dritte@person.test');    -- ohne Firma

insert into public.companies (id, name, contact_email) values
  ('a1000000-0000-4000-8000-000000000001', 'Firma A', 'a@firma-a.test'),
  ('b1000000-0000-4000-8000-000000000001', 'Firma B', 'b@firma-b.test');
insert into public.subscriptions (company_id, writable_until) values
  ('a1000000-0000-4000-8000-000000000001', now() + interval '10 days'),
  ('b1000000-0000-4000-8000-000000000001', now() + interval '10 days');
insert into public.company_members (id, company_id, user_id, role, display_name, login_email) values
  ('a2000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'admin',   'Anna',     'anna@firma-a.test'),
  ('a2000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000002', 'kitchen', 'Koch',     'koch@firma-a.test'),
  ('a2000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000003', 'staff',   'Aushilfe', 'aushilfe@firma-a.test'),
  ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001',
   'b0000000-0000-4000-8000-000000000001', 'admin',   'Bernd',    'bernd@firma-b.test');
select private.seed_company_defaults('a1000000-0000-4000-8000-000000000001');
select private.seed_company_defaults('b1000000-0000-4000-8000-000000000001');

-- Token aus den Aufrufen merken (Tabelle ohne RLS, nur für den Test)
create temp table tok (name text primary key, token text, id uuid);
grant all on tok to authenticated, anon;

-- ---------- Admin A lädt ein ----------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';

insert into tok select 'link', r ->> 'token', (r ->> 'id')::uuid
  from (select public.create_invitation('Neue Person', 'staff') as r) x;
select ok((select length(token) from tok where name = 'link') >= 60, 'Link-Einladung ohne E-Mail liefert einen langen Token');

insert into tok select 'mail', r ->> 'token', (r ->> 'id')::uuid
  from (select public.create_invitation('Andere', 'kitchen', 'Andere@Person.test',
        array(select id from public.qualifications where name in ('Bar', 'Fahrer'))) as r) x;
insert into tok select 'extra', r ->> 'token', (r ->> 'id')::uuid
  from (select public.create_invitation('Zweitlink', 'staff') as r) x;
select is((select email from public.invitations where id = (select id from tok where name = 'mail')),
          'andere@person.test', 'Die E-Mail wird kleingeschrieben gespeichert');
select is((select count(*)::int from public.invitations), 3, 'admin A sieht seine Einladungen');
select throws_ok($$select token_hash from public.invitations$$, '42501', null,
                 'Der Token-Hash ist für authenticated nicht lesbar');
select throws_ok(
  $$insert into public.invitations (company_id, display_name, role, token_hash, expires_at)
    values ('a1000000-0000-4000-8000-000000000001', 'X', 'admin', '\x00', now())$$,
  '42501', null, 'Einladungen entstehen nur über die RPC');
select throws_ok($$select public.create_invitation('Doppelt', 'staff', 'andere@person.test')$$,
                 'P0001', 'Es gibt schon eine offene Einladung für diese Adresse',
                 'Keine zweite offene Einladung an dieselbe Adresse');
select throws_ok($$select public.create_invitation('Anna 2', 'staff', 'ANNA@firma-a.test')$$,
                 'P0001', 'Bereits Mitglied', 'Bestehende Mitglieder werden nicht erneut eingeladen');
select throws_ok($$select public.create_invitation('', 'staff')$$,
                 'P0001', 'Name fehlt', 'Ohne Namen keine Einladung');
select throws_ok($$select public.create_invitation('Mit Fremdquali', 'staff', null,
                   array(select id from public.qualifications limit 0) || gen_random_uuid())$$,
                 'P0001', 'Unbekannte Qualifikation', 'Fremde oder unbekannte Qualifikationen werden abgelehnt');

-- ---------- Vorschau ohne Anmeldung ----------
reset role;
set local role anon;
set local request.jwt.claims = '';
select is((select public.invitation_preview((select token from tok where name = 'mail')) ->> 'company_name'),
          'Firma A', 'anon sieht in der Vorschau den Firmennamen');
select is((select public.invitation_preview((select token from tok where name = 'mail')) -> 'qualifications'),
          '["Bar", "Fahrer"]'::jsonb, 'Die Vorschau nennt die vorgesehenen Qualifikationen');
select is((select public.invitation_preview('falsch') ->> 'status'), 'invalid', 'Ein falscher Token liefert „invalid“');
select throws_ok($$select public.accept_invitation('x')$$, '42501', null, 'anon kann keine Einladung annehmen');

-- ---------- Annehmen ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.accept_invitation('unbekannt')$$, 'P0001', 'Einladung ungültig', 'Unbekannter Token');

set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.accept_invitation((select token from tok where name = 'mail'))$$,
                 'P0001', 'Die Einladung gilt für eine andere E-Mail-Adresse',
                 'Eine Einladung mit E-Mail gilt nur für diese Adresse');

set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select public.accept_invitation((select token from tok where name = 'mail'))$$,
                'Die passende Adresse nimmt die Einladung an');
select is((select role from public.company_members), 'kitchen'::public.member_role, 'Die Rolle aus der Einladung gilt');
select is((select count(*)::int from public.member_qualifications), 2, 'Die Qualifikationen werden übernommen');
select throws_ok($$select public.accept_invitation((select token from tok where name = 'extra'))$$,
                 'P0001', 'Du bist bereits Mitglied einer Firma', 'Ein Mitglied kann nicht ein zweites Mal beitreten');
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000003","role":"authenticated"}';
select throws_ok($$select public.accept_invitation((select token from tok where name = 'mail'))$$,
                 'P0001', 'Einladung schon verwendet', 'Eine angenommene Einladung ist verbraucht');

-- Link-Einladung gilt für jede Adresse
select lives_ok($$select public.accept_invitation((select token from tok where name = 'link'))$$,
                'Eine Link-Einladung ohne E-Mail kann jeder angemeldete Nutzer annehmen');
select is((select display_name from public.company_members), 'Neue Person', 'Der Name aus der Einladung wird übernommen');

-- ---------- Rollen und Team (admin A) ----------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.set_member_role('a2000000-0000-4000-8000-000000000003', 'kitchen')$$,
                'admin ändert die Rolle');
select is((select role from public.company_members where id = 'a2000000-0000-4000-8000-000000000003'),
          'kitchen'::public.member_role, 'Die neue Rolle ist gespeichert');
select throws_ok($$select public.set_member_role('a2000000-0000-4000-8000-000000000001', 'staff')$$,
                 'P0001', 'Der letzte Admin kann nicht herabgestuft oder entfernt werden',
                 'Der letzte Admin kann sich nicht herabstufen');
select throws_ok($$select public.set_member_role('b2000000-0000-4000-8000-000000000001', 'staff')$$,
                 'P0001', 'Mitglied nicht gefunden', 'Fremde Mitglieder sind nicht erreichbar');
select lives_ok($$select public.set_member_qualifications('a2000000-0000-4000-8000-000000000003',
                   array(select id from public.qualifications where name = 'Service'))$$,
                'Qualifikationen setzen');
select is((select count(*)::int from public.member_qualifications
            where member_id = 'a2000000-0000-4000-8000-000000000003'), 1, 'Genau eine Qualifikation gesetzt');
select lives_ok($$select public.set_member_qualifications('a2000000-0000-4000-8000-000000000003', '{}')$$,
                'Qualifikationen leeren');
select throws_ok($$select public.revoke_invitation((select id from tok where name = 'link'))$$,
                 'P0001', 'Einladung nicht mehr offen', 'Angenommene Einladungen lassen sich nicht widerrufen');

-- Erneut senden: neuer Token, alter ungültig
reset role;
insert into public.invitations (id, company_id, display_name, role, token_hash, expires_at, email)
values ('d0000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'Spät', 'staff',
        private.token_hash('alt'), now() - interval '1 day', 'spaet@person.test');
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
insert into tok select 'resent', r ->> 'token', (r ->> 'id')::uuid
  from (select public.resend_invitation('d0000000-0000-4000-8000-000000000001') as r) x;
select ok((select expires_at > now() + interval '6 days' from public.invitations
            where id = 'd0000000-0000-4000-8000-000000000001'), 'Erneut senden verlängert die Frist');
select is((select public.invitation_preview('alt') ->> 'status'), 'invalid', 'Der alte Link ist ungültig');
select lives_ok($$select public.revoke_invitation('d0000000-0000-4000-8000-000000000001')$$, 'Widerrufen');
select is((select public.invitation_preview((select token from tok where name = 'resent')) ->> 'status'),
          'revoked', 'Ein widerrufener Link meldet „revoked“');

-- ---------- Andere Rollen dürfen nichts davon ----------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select throws_ok($$select public.create_invitation('Eindringling', 'admin')$$, '42501', null,
                 'kitchen darf nicht einladen');
select throws_ok($$select public.set_member_role('a2000000-0000-4000-8000-000000000003', 'admin')$$, '42501', null,
                 'kitchen darf keine Rollen ändern');
select is((select count(*)::int from public.invitations), 0, 'kitchen sieht keine Einladungen');

-- ---------- Entfernen, Verlassen, Konto löschen ----------
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select lives_ok($$select public.remove_member('a2000000-0000-4000-8000-000000000003')$$, 'admin entfernt ein Mitglied');
reset role;
select ok((select removed_at is not null and user_id is null from public.company_members
            where id = 'a2000000-0000-4000-8000-000000000003'), 'Entfernte Mitglieder verlieren den Zugang');

-- Verlassen und Konto löschen: der letzte Admin bleibt
set local request.jwt.claims = '{"sub":"a0000000-0000-4000-8000-000000000001","role":"authenticated"}';
select throws_ok($$select public.leave_company()$$, 'P0001',
                 'Der letzte Admin kann nicht herabgestuft oder entfernt werden',
                 'Der letzte Admin kann die Firma nicht verlassen');
select throws_ok($$select public.delete_my_account()$$, 'P0001',
                 'Der letzte Admin kann nicht herabgestuft oder entfernt werden',
                 'Der letzte Admin kann das Konto nicht löschen');
set local request.jwt.claims = '{"sub":"c0000000-0000-4000-8000-000000000002","role":"authenticated"}';
select lives_ok($$select public.leave_company()$$, 'Ein Mitglied verlässt die Firma');
select lives_ok($$select public.delete_my_account()$$, 'Konto ohne Firma löschen');
reset role;
select is((select count(*)::int from auth.users where id = 'c0000000-0000-4000-8000-000000000002'), 0,
          'Das Konto ist gelöscht');
select * from finish();
rollback;
