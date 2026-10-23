-- Resume / CV (Phase 6).
--
-- Three tables that hold the CV the public "Resume" tab shows:
--
-- 1. `cv_profile`  — exactly one row (id = 1): the name, the headline, the
--    summary and the contact details. `is_published` decides whether the CV
--    is visible on the site at all.
-- 2. `cv_sections` — the sections of the CV (Experience, Education, …) in
--    their own order.
-- 3. `cv_entries`  — the rows of a section (a role, a degree, a project…),
--    in their own order.
--
-- The CV is COMPLETELY STANDALONE: it never reads from or links to the
-- projects, the about content, the skills, the education, the services or
-- the settings. Everything is typed in the admin by hand, so nothing is
-- seeded here either — an empty database simply means "no CV".
--
-- Rows are written only with the service role. Anonymous visitors may read
-- the profile only while it is published, and the sections / entries only
-- while the profile is published.
--
-- Run this manually in the Supabase SQL editor. The app never runs migrations.

-- 1. The CV profile — exactly one row (id = 1).
create table if not exists public.cv_profile (
  id integer primary key default 1 check (id = 1),
  full_name text,
  headline text,
  summary text,
  email text,
  phone text,
  location text,
  website text,
  github text,
  linkedin text,
  is_published boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 2. The CV sections, in order.
create table if not exists public.cv_sections (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 3. The entries of a section, in order. Deleting a section deletes its
--    entries (on delete cascade).
create table if not exists public.cv_entries (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.cv_sections (id) on delete cascade,
  title text not null,
  subtitle text,
  period text,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.cv_profile enable row level security;
alter table public.cv_sections enable row level security;
alter table public.cv_entries enable row level security;

-- The app reads and writes the CV with the service role.
grant all on table public.cv_profile to service_role;
grant all on table public.cv_sections to service_role;
grant all on table public.cv_entries to service_role;

grant select on table public.cv_profile to anon, authenticated;
grant select on table public.cv_sections to anon, authenticated;
grant select on table public.cv_entries to anon, authenticated;

-- The profile is only readable while it is published.
drop policy if exists "Public can read the published cv profile" on public.cv_profile;
create policy "Public can read the published cv profile"
  on public.cv_profile
  for select
  to anon, authenticated
  using (is_published = true);

-- The sections are only readable while the CV is published.
drop policy if exists "Public can read cv sections" on public.cv_sections;
create policy "Public can read cv sections"
  on public.cv_sections
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.cv_profile p
      where p.is_published = true
    )
  );

-- The entries are only readable while the CV is published.
drop policy if exists "Public can read cv entries" on public.cv_entries;
create policy "Public can read cv entries"
  on public.cv_entries
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.cv_profile p
      where p.is_published = true
    )
  );

create index if not exists cv_sections_sort_order_idx
  on public.cv_sections (sort_order);

create index if not exists cv_entries_section_sort_idx
  on public.cv_entries (section_id, sort_order);
