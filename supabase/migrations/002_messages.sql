-- Messages table (Phase 2).
--
-- Stores contact popup submissions. Rows are only ever written and read with the
-- service role (public /admin/* pages and the contact server action), so RLS is
-- enabled with NO policies: anon/authenticated have no access.
--
-- Run this manually in the Supabase SQL editor. The app never runs migrations.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

grant all on table public.messages to service_role;

-- Newest-first listing is the only read pattern.
create index if not exists messages_created_at_idx
  on public.messages (created_at desc);
