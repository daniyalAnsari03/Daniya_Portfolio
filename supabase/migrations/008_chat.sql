-- Ask AI chat logs + rate limit (Phase 7).
--
-- Three PRIVATE tables for the chatbot:
--
-- 1. `chat_sessions`    — one row per conversation. Only a hashed IP is stored
--    (`ip_hash`), never a raw address. `message_count` is a running counter.
-- 2. `chat_messages`    — the turns of a session (user / assistant). Deleting a
--    session deletes its messages (on delete cascade).
-- 3. `chat_rate_limits` — fixed-window counters per hashed IP.
--
-- Every row is written and read only with the service role. RLS is enabled with
-- NO policies and all privileges are revoked from anon / authenticated, so the
-- logs are never reachable from the browser.
--
-- Two helper functions are provided for the server side only: the fixed-window
-- rate-limit check and a purge routine. The purge is NOT scheduled here; a
-- later step may call it (no pg_cron in this migration).
--
-- Run this manually in the Supabase SQL editor. The app never runs migrations.

-- 1. Chat sessions — one per conversation, keyed by a hashed IP.
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  ip_hash text not null,
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  message_count integer not null default 0
);

-- 2. Chat messages — the turns of a session.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) <= 8000),
  agent_name text,
  created_at timestamptz not null default now()
);

-- 3. Fixed-window rate-limit counters per hashed IP.
create table if not exists public.chat_rate_limits (
  ip_hash text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (ip_hash, window_start)
);

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_rate_limits enable row level security;

-- The chat is entirely server-side: service role only, no public access.
revoke all on table public.chat_sessions from anon, authenticated;
revoke all on table public.chat_messages from anon, authenticated;
revoke all on table public.chat_rate_limits from anon, authenticated;

grant all on table public.chat_sessions to service_role;
grant all on table public.chat_messages to service_role;
grant all on table public.chat_rate_limits to service_role;

-- Newest sessions first (admin / purge reads) and lookups by hashed IP.
create index if not exists chat_sessions_last_message_at_idx
  on public.chat_sessions (last_message_at desc);

create index if not exists chat_sessions_ip_hash_idx
  on public.chat_sessions (ip_hash);

-- Loading a session's transcript is ordered by time.
create index if not exists chat_messages_session_created_idx
  on public.chat_messages (session_id, created_at);

-- Purging old rate-limit windows.
create index if not exists chat_rate_limits_window_start_idx
  on public.chat_rate_limits (window_start);

-- a) Count one request for a hashed IP inside the current fixed window and
--    report whether it is still allowed. The counter increment is one atomic
--    statement, so concurrent requests cannot lose an update.
create or replace function public.check_chat_rate_limit(
  p_ip_hash text,
  p_limit integer default 20,
  p_window_seconds integer default 600
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_ip_hash is null or char_length(p_ip_hash) = 0 then
    raise exception 'p_ip_hash is required';
  end if;

  if p_limit is null or p_limit < 1 then
    raise exception 'p_limit must be at least 1';
  end if;

  if p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'p_window_seconds must be at least 1';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.chat_rate_limits (ip_hash, window_start, count)
  values (p_ip_hash, v_window_start, 1)
  on conflict (ip_hash, window_start)
  do update set count = chat_rate_limits.count + 1
  returning count into v_count;

  return query
  select
    v_count <= p_limit,
    greatest(p_limit - v_count, 0),
    greatest(
      ceil(
        extract(epoch from (
          v_window_start + make_interval(secs => p_window_seconds) - now()
        ))
      )::integer,
      0
    );
end;
$$;

-- b) Delete old conversations (their messages cascade) and stale rate-limit
--    windows. Returns the number of deleted sessions. Not scheduled here.
create or replace function public.purge_old_chats(
  p_days integer default 90
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_deleted integer;
begin
  if p_days is null or p_days < 1 then
    raise exception 'p_days must be at least 1';
  end if;

  delete from public.chat_sessions
  where last_message_at < now() - make_interval(days => p_days);

  get diagnostics v_deleted = row_count;

  delete from public.chat_rate_limits
  where window_start < now() - interval '1 day';

  return v_deleted;
end;
$$;

-- Both functions are service-role only.
revoke all on function public.check_chat_rate_limit(text, integer, integer)
  from public, anon, authenticated;
revoke all on function public.purge_old_chats(integer)
  from public, anon, authenticated;

grant execute on function public.check_chat_rate_limit(text, integer, integer)
  to service_role;
grant execute on function public.purge_old_chats(integer)
  to service_role;
