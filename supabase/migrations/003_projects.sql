-- Projects + gallery images (Phase 3a).
--
-- Stores admin-managed projects (with an ordered gallery) and the public
-- storage bucket that holds their original image uploads. Rows are written only
-- with the service role; anon/authenticated may read visible projects and the
-- gallery images that belong to them.
--
-- Run this manually in the Supabase SQL editor. The app never runs migrations.

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  tech_stack text[] not null default '{}',
  demo_link text,
  cover_image_url text,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.project_images (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  image_url text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.projects enable row level security;
alter table public.project_images enable row level security;

grant all on table public.projects to service_role;
grant all on table public.project_images to service_role;
grant select on table public.projects to anon, authenticated;
grant select on table public.project_images to anon, authenticated;

-- Public visitors only ever see visible projects and their images.
drop policy if exists "Public can read visible projects" on public.projects;
create policy "Public can read visible projects"
  on public.projects
  for select
  to anon, authenticated
  using (is_visible = true);

drop policy if exists "Public can read visible project images" on public.project_images;
create policy "Public can read visible project images"
  on public.project_images
  for select
  to anon, authenticated
  using (
    exists (
      select 1
      from public.projects p
      where p.id = public.project_images.project_id
        and p.is_visible = true
    )
  );

create index if not exists projects_sort_order_idx
  on public.projects (sort_order);

create index if not exists project_images_project_sort_idx
  on public.project_images (project_id, sort_order);

-- Public bucket for original project images (jpeg/png/webp, max 10 MB).
-- Reuses an existing bucket with the same id if one already exists.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-images',
  'project-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
