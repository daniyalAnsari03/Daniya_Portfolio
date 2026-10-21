-- Settings key/value table (Phase 1).
--
-- IMPORTANT: Replace REPLACE_WITH_ADMIN_EMAIL with the real admin Google account
-- email (the one used to sign in) BEFORE running this migration. The value below
-- is a placeholder; nobody can access /admin until the seed row contains a real,
-- lowercase email address.

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- RLS is enabled with NO policies on purpose: anon/authenticated have no access
-- until the public read policy is added in a later phase. Only the service role
-- can read/write right now.
alter table public.settings enable row level security;

grant all on table public.settings to service_role;

insert into public.settings (key, value)
values ('admin_emails', '["dinsbydaniyal@gmail.com"]'::jsonb)
on conflict (key) do nothing;
