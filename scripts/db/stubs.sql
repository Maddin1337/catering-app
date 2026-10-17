-- Minimaler Nachbau der Supabase-Umgebung für ein nacktes Postgres 16 ohne Docker.
-- Nur für scripts/db/test-local.sh; `supabase start` bringt all das selbst mit.
create role anon          nologin noinherit;
create role authenticated nologin noinherit;
create role service_role  nologin noinherit bypassrls;

create schema extensions;
create schema auth;

create table auth.users (
  id                 uuid primary key,
  email              text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data  jsonb default '{}'::jsonb
);

-- wie in Supabase: Nutzer-ID aus den JWT-Claims der Anfrage
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

grant usage on schema public, extensions, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase-Standardrechte für neue Objekte in public (diese Voreinstellung räumen unsere Migrationen auf)
alter default privileges for role postgres in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;

alter database postgres set search_path = "$user", public, extensions;
