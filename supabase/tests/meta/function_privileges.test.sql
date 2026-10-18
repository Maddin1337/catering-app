-- Funktionsrechte (docs/03 §4.1 Nr. 1, §9.5): keine Funktion für anon, authenticated nur eine Whitelist.
begin;
select plan(8);

-- Funktionen, die Erweiterungen mitbringen (z. B. pgTAP in public), zählen nicht.
create temp table fns on commit drop as
select p.oid,
       n.nspname || '.' || p.proname as sig
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
 where n.nspname in ('public', 'private')
   and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');

select is(
  (select coalesce(array_agg(sig order by sig), '{}')
     from fns where has_function_privilege('anon', oid, 'execute')),
  array['public.invitation_preview'],
  'Für anon ist nur die Einladungs-Vorschau ausführbar (der Token ist das Geheimnis)'
);

select is(
  (select count(*)::int from fns where has_function_privilege('public', oid, 'execute')),
  0,
  'Keine Funktion in public oder private ist für PUBLIC ausführbar'
);

select is(
  (select coalesce(array_agg(sig order by sig), '{}')
     from fns where has_function_privilege('authenticated', oid, 'execute')),
  array[
    'public.accept_invitation',
    'public.assert_writable',
    'public.auth_company_id',
    'public.auth_member_id',
    'public.auth_role',
    'public.can_read_event',
    'public.company_is_writable',
    'public.copy_event',
    'public.create_company',
    'public.create_event_from_intake',
    'public.create_invitation',
    'public.delete_my_account',
    'public.discard_quote_changes',
    'public.ensure_quote',
    'public.invitation_preview',
    'public.issue_portal_token',
    'public.leave_company',
    'public.remove_member',
    'public.resend_invitation',
    'public.reset_intake_questions',
    'public.revoke_invitation',
    'public.revoke_portal_tokens',
    'public.save_dish',
    'public.save_ingredient',
    'public.save_menu_package',
    'public.save_quote',
    'public.send_quote',
    'public.set_event_status',
    'public.set_invoice_details',
    'public.set_member_qualifications',
    'public.set_member_role'
  ],
  'authenticated darf genau die Whitelist ausführen (Hilfsfunktionen aus §4.2 und RPCs)'
);

select ok(
  not has_function_privilege('authenticated', 'public.set_updated_at()', 'execute'),
  'Trigger-Funktionen sind für authenticated nicht ausführbar'
);

select ok(
  not has_schema_privilege('anon', 'private', 'usage')
  and not has_schema_privilege('authenticated', 'private', 'usage'),
  'Das Schema private ist für anon und authenticated gesperrt'
);

-- Default Privileges (§4.1 Nr. 1): Eine NEUE Funktion ist ohne ausdrückliches GRANT für niemanden
-- außer dem Eigentümer ausführbar. Die Aufräum-Migration allein reicht nicht; sie erfasst nur
-- bereits vorhandene Funktionen.
create function public.zz_probe_default_privileges() returns integer
language sql as $$ select 1 $$;

select ok(
  not has_function_privilege('anon', 'public.zz_probe_default_privileges()', 'execute'),
  'Neue Funktion in public: nicht für anon ausführbar'
);
select ok(
  not has_function_privilege('authenticated', 'public.zz_probe_default_privileges()', 'execute'),
  'Neue Funktion in public: nicht für authenticated ausführbar'
);
select ok(
  not has_function_privilege('public', 'public.zz_probe_default_privileges()', 'execute'),
  'Neue Funktion in public: nicht für PUBLIC ausführbar'
);

select * from finish();
rollback;
