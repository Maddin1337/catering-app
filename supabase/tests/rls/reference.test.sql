-- Referenzdaten: lesen alle angemeldeten Nutzer, schreiben nur Migrationen (docs/03 §3.7).
begin;
select plan(8);

insert into auth.users (id, email) values
  ('d0000000-0000-4000-8000-000000000001', 'dora@test.test');

select is((select count(*)::int from public.allergens), 14, 'Genau 14 Pflichtallergene');
select is(
  (select string_agg(letter::text, '' order by sort_order) from public.allergens),
  'ABCDEFGHLMNOPR',
  'Kurzcodes nach dem österreichischen Schema (A–H, L–P, R)'
);
select is(
  (select array_agg(plan::text order by plan) from public.plan_limits),
  array['start', 'team', 'profi', 'pilot'],  -- Reihenfolge des Enums subscription_plan
  'plan_limits hat eine Zeile je Stufe'
);

set local role authenticated;
set local request.jwt.claims = '{"sub":"d0000000-0000-4000-8000-000000000001","role":"authenticated"}';

select is((select count(*)::int from public.allergens), 14, 'authenticated liest alle Allergene');
select is((select count(*)::int from public.plan_limits), 4, 'authenticated liest alle Planlimits');
select throws_ok(
  $$insert into public.allergens (code, letter, label_de, sort_order) values ('gluten', 'Z', 'x', 99)$$,
  '42501', null, 'authenticated darf Allergene nicht schreiben');
select throws_ok(
  $$update public.plan_limits set max_members = 1000 where plan = 'start'$$,
  '42501', null, 'authenticated darf Planlimits nicht ändern');

reset role;
set local role anon;
set local request.jwt.claims = '';
select throws_ok('select count(*) from public.allergens', '42501', null, 'anon liest keine Allergene');

reset role;
select * from finish();
rollback;
