-- About content tables (Phase 4).
--
-- Stores the public About page content: hero cards (image/video), the single
-- intro/hero-copy row, services, skill categories + skills, and education.
-- Rows are written only with the service role; anon/authenticated get a public
-- SELECT policy on every table (the About page is public content).
--
-- Run this manually in the Supabase SQL editor. The app never runs migrations.

-- 1. Hero cards (image or video, ordered).
create table if not exists public.about_hero_cards (
  id uuid primary key default gen_random_uuid(),
  media_type text not null check (media_type in ('image', 'video')),
  file_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 2. Intro / hero copy — exactly one row (is_singleton is unique + checked).
create table if not exists public.about_intro (
  id uuid primary key default gen_random_uuid(),
  is_singleton boolean not null default true unique check (is_singleton = true),
  hero_heading text,
  hero_subtitle text,
  statement_heading text,
  paragraph text,
  photo_url text,
  location text,
  email text,
  phone text,
  updated_at timestamptz not null default now()
);

-- 3. Services (ordered).
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 4. Skill categories (ordered).
create table if not exists public.skill_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 5. Skills (ordered, belong to a category; optional icon).
create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.skill_categories (id) on delete cascade,
  name text not null,
  icon_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 6. Education (ordered, year stored as text e.g. "2020 - 2024").
create table if not exists public.education (
  id uuid primary key default gen_random_uuid(),
  degree text not null,
  school text not null,
  year text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.about_hero_cards enable row level security;
alter table public.about_intro enable row level security;
alter table public.services enable row level security;
alter table public.skill_categories enable row level security;
alter table public.skills enable row level security;
alter table public.education enable row level security;

grant all on table public.about_hero_cards to service_role;
grant all on table public.about_intro to service_role;
grant all on table public.services to service_role;
grant all on table public.skill_categories to service_role;
grant all on table public.skills to service_role;
grant all on table public.education to service_role;

grant select on table public.about_hero_cards to anon, authenticated;
grant select on table public.about_intro to anon, authenticated;
grant select on table public.services to anon, authenticated;
grant select on table public.skill_categories to anon, authenticated;
grant select on table public.skills to anon, authenticated;
grant select on table public.education to anon, authenticated;

-- Public visitors can read all About content.
drop policy if exists "Public can read about hero cards" on public.about_hero_cards;
create policy "Public can read about hero cards"
  on public.about_hero_cards
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read about intro" on public.about_intro;
create policy "Public can read about intro"
  on public.about_intro
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read services" on public.services;
create policy "Public can read services"
  on public.services
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read skill categories" on public.skill_categories;
create policy "Public can read skill categories"
  on public.skill_categories
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read skills" on public.skills;
create policy "Public can read skills"
  on public.skills
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read education" on public.education;
create policy "Public can read education"
  on public.education
  for select
  to anon, authenticated
  using (true);

create index if not exists about_hero_cards_sort_order_idx
  on public.about_hero_cards (sort_order);

create index if not exists services_sort_order_idx
  on public.services (sort_order);

create index if not exists skill_categories_sort_order_idx
  on public.skill_categories (sort_order);

create index if not exists skills_category_id_idx
  on public.skills (category_id);

create index if not exists skills_sort_order_idx
  on public.skills (sort_order);

create index if not exists education_sort_order_idx
  on public.education (sort_order);

-- Storage: the existing public bucket (`project-images`) already holds About
-- media uploads. Widen it so hero-card videos (mp4/webm) fit: allow the five
-- media types and raise the limit to 50 MB. Idempotent; does not change the
-- bucket's public flag or id, and is a no-op if the settings already match.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
where id = 'project-images';
