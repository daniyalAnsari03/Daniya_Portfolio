-- Homepage admin content (Phase 5).
--
-- 1. The About hero cards get the same framing columns as the project covers
--    (fit / focus point / zoom) so the admin can frame them.
-- 2. `homepage_content` holds the homepage copy — exactly one row (id = 1).
-- 3. `homepage_cards` holds the cards of the homepage "Recent works" row.
--
-- Every column is nullable (null = use the default in the code), so nothing
-- is seeded here: the defaults live in `src/lib/homepage-defaults.ts`.
--
-- Rows are written only with the service role; anon/authenticated get a public
-- SELECT policy on both tables (the homepage is public content).
--
-- Run this manually in the Supabase SQL editor. The app never runs migrations.

-- 1. About hero cards — the framing columns.
-- The columns are added first, then the existing cards keep the framing they
-- have today (they have always been cropped to their box, object-fit: cover).
do $$
declare
  had_framing boolean;
begin
  select count(*) = 4 into had_framing
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'about_hero_cards'
    and column_name in ('cover_fit', 'cover_pos_x', 'cover_pos_y', 'cover_zoom');

  alter table public.about_hero_cards
    add column if not exists cover_fit text not null default 'contain',
    add column if not exists cover_pos_x numeric not null default 50,
    add column if not exists cover_pos_y numeric not null default 50,
    add column if not exists cover_zoom numeric not null default 1;

  -- Only on the first run: keep the look of the existing cards.
  if not had_framing then
    update public.about_hero_cards set cover_fit = 'cover';
  end if;
end $$;

-- Range guards, so an out-of-range value can never be stored.
alter table public.about_hero_cards
  drop constraint if exists about_hero_cards_cover_fit_check;
alter table public.about_hero_cards
  add constraint about_hero_cards_cover_fit_check
  check (cover_fit in ('contain', 'cover'));

alter table public.about_hero_cards
  drop constraint if exists about_hero_cards_cover_pos_x_check;
alter table public.about_hero_cards
  add constraint about_hero_cards_cover_pos_x_check
  check (cover_pos_x >= 0 and cover_pos_x <= 100);

alter table public.about_hero_cards
  drop constraint if exists about_hero_cards_cover_pos_y_check;
alter table public.about_hero_cards
  add constraint about_hero_cards_cover_pos_y_check
  check (cover_pos_y >= 0 and cover_pos_y <= 100);

alter table public.about_hero_cards
  drop constraint if exists about_hero_cards_cover_zoom_check;
alter table public.about_hero_cards
  add constraint about_hero_cards_cover_zoom_check
  check (cover_zoom >= 1 and cover_zoom <= 3);

-- 2. Homepage copy — exactly one row (id = 1).
create table if not exists public.homepage_content (
  id integer primary key default 1 check (id = 1),
  hero_line1 text,
  hero_line2 text,
  hero_subtitle text,
  cover_label text,
  cover_heading1 text,
  cover_heading2 text,
  reel_label text,
  reel_video_url text,
  works_heading text,
  contact_line1 text,
  contact_line2 text,
  contact_accent_word text,
  updated_at timestamptz not null default now()
);

-- 3. Homepage cards (ordered, optionally hidden).
create table if not exists public.homepage_cards (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  sort_order integer not null default 0,
  visible boolean not null default true,
  cover_fit text not null default 'contain',
  cover_pos_x numeric not null default 50,
  cover_pos_y numeric not null default 50,
  cover_zoom numeric not null default 1,
  created_at timestamptz not null default now()
);

alter table public.homepage_cards
  drop constraint if exists homepage_cards_cover_fit_check;
alter table public.homepage_cards
  add constraint homepage_cards_cover_fit_check
  check (cover_fit in ('contain', 'cover'));

alter table public.homepage_cards
  drop constraint if exists homepage_cards_cover_pos_x_check;
alter table public.homepage_cards
  add constraint homepage_cards_cover_pos_x_check
  check (cover_pos_x >= 0 and cover_pos_x <= 100);

alter table public.homepage_cards
  drop constraint if exists homepage_cards_cover_pos_y_check;
alter table public.homepage_cards
  add constraint homepage_cards_cover_pos_y_check
  check (cover_pos_y >= 0 and cover_pos_y <= 100);

alter table public.homepage_cards
  drop constraint if exists homepage_cards_cover_zoom_check;
alter table public.homepage_cards
  add constraint homepage_cards_cover_zoom_check
  check (cover_zoom >= 1 and cover_zoom <= 3);

alter table public.homepage_content enable row level security;
alter table public.homepage_cards enable row level security;

-- The app reads and writes the homepage with the service role.
grant all on table public.homepage_content to service_role;
grant all on table public.homepage_cards to service_role;

grant select on table public.homepage_content to anon, authenticated;
grant select on table public.homepage_cards to anon, authenticated;

-- Public visitors can read the homepage content.
drop policy if exists "Public can read homepage content" on public.homepage_content;
create policy "Public can read homepage content"
  on public.homepage_content
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can read homepage cards" on public.homepage_cards;
create policy "Public can read homepage cards"
  on public.homepage_cards
  for select
  to anon, authenticated
  using (true);

create index if not exists homepage_cards_sort_order_idx
  on public.homepage_cards (sort_order);

-- Storage: the existing public bucket (`project-images`) already holds the
-- homepage uploads — the card images live in `homepage/` and the reel video
-- in `homepage/reel/`. The bucket accepts mp4/webm up to 50 MB (set by
-- migration 004); the statement below keeps that in place. Idempotent; it
-- does not change the bucket's public flag or id.
update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
where id = 'project-images';
