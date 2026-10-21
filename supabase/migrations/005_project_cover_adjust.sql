-- Project cover framing (fit / focus point / zoom).
--
-- Adds the per-project framing that the Works card and the admin preview
-- share. The uploaded file is never modified: the values only describe how the
-- image is fitted and positioned inside the card box.
--
-- Run this manually in the Supabase SQL editor. The app never runs migrations.

alter table public.projects
  add column if not exists cover_fit text not null default 'contain',
  add column if not exists cover_pos_x numeric not null default 50,
  add column if not exists cover_pos_y numeric not null default 50,
  add column if not exists cover_zoom numeric not null default 1;

-- Range guards, so an out-of-range value can never be stored.
alter table public.projects
  drop constraint if exists projects_cover_fit_check;
alter table public.projects
  add constraint projects_cover_fit_check
  check (cover_fit in ('contain', 'cover'));

alter table public.projects
  drop constraint if exists projects_cover_pos_x_check;
alter table public.projects
  add constraint projects_cover_pos_x_check
  check (cover_pos_x >= 0 and cover_pos_x <= 100);

alter table public.projects
  drop constraint if exists projects_cover_pos_y_check;
alter table public.projects
  add constraint projects_cover_pos_y_check
  check (cover_pos_y >= 0 and cover_pos_y <= 100);

alter table public.projects
  drop constraint if exists projects_cover_zoom_check;
alter table public.projects
  add constraint projects_cover_zoom_check
  check (cover_zoom >= 1 and cover_zoom <= 3);

-- The app reads and writes projects with the service role.
grant all on table public.projects to service_role;
