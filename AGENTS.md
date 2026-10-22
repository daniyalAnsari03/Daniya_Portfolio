<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project: Animated Portfolio Homepage

A single-page animated portfolio homepage. **Homepage only** — no other pages, no
backend.

## Rules (do not deviate)

- **Stack:** Next.js (App Router), TypeScript, React, Tailwind CSS, Framer Motion,
  Lenis (`lenis` npm package).
- Do **not** push to GitHub, do **not** deploy, do **not** run any database commands.
- Keep this file in sync with the spec as the project is built.
- Build only what a given step asks for. Do **not** add extra pages, features or sections.
- All editable text (name, headline lines, subtitle, social links, nav labels) lives in
  **`src/lib/content.ts`** — one file, single source of truth.
- Do **not** copy text or branding from other websites.

## Design tokens

Defined as CSS variables in `src/app/globals.css` and mapped into the Tailwind theme
(`@theme inline`). Use black (`charcoal`) wherever the reference design would use dark
green.

| Token             | Value     | Utility examples                                 |
| ----------------- | --------- | ------------------------------------------------ |
| background        | `#E8E8E8` | `bg-background`                                  |
| foreground        | `#111111` | `text-foreground`                                |
| charcoal          | `#333333` | `bg-charcoal` (dark section background)          |
| accent            | `#333333` | `bg-accent`, `text-accent` (on LIGHT backgrounds) |
| accent-on-dark    | `#A0A0A0` | `text-accent-on-dark` (on DARK backgrounds)      |

- **Font:** `next/font` → Inter Tight, exposed as `--font-inter-tight`. Tight
  letter-spacing on large headings.

## Motion

- Shared animation tokens live in `src/lib/motion.ts`.
- One easing curve everywhere: `cubic-bezier(0.76, 0, 0.24, 1)` (`EASE`).
- Standard durations: `fast` 0.4s, `base` 0.7s, `slow` 1.1s.
- **Only animate `transform` and `opacity`** so it stays smooth on touch devices.

## Current state

- **Step 1 — Setup:** Next.js 16 + React 19 + Tailwind v4, content/motion libs,
  Lenis provider (`src/components/SmoothScroll.tsx`, disabled under
  `prefers-reduced-motion`).
- **Step 2 — Hero (`src/components/Hero.tsx`, `id="home"`):** full-screen hero with
  masked headline reveal, layered transparent-PNG photo, fixed pill nav
  (`src/components/Nav.tsx`), corner controls. Placeholder `works` / `contact`
  sections (`min-h-screen`) exist so the nav works.
- **Step 3 — Responsive:** fluid `clamp()` type/photo sizing; verify mobile, tablet,
  desktop.
- **Step 4 — Hero layout match:** headline is `Full-Stack` / `Developer`, weight 400,
  `clamp(56px,10vw,200px)`, `leading-[0.9]`, `tracking-[-0.045em]`. Absolutely
  positioned block at `21vh`; line 1 at `26vw` behind the photo, line 2 at `57vw` in
  front, subtitle aligned to line 2. Photo sized from measured alpha (head ≈ 10vw,
  head top ≈ 30vh, bottom cropped; head top fraction `58/1536≈3.78%` applied as a
  `translate`). Bigger name/contact pill, `76px` scroll button, `336×62px` nav pill.
  `devIndicators:false`; `images.qualities:[75,95]`.
- **Step 5 — Cover (`src/components/Cover.tsx`, `id="cover"`):** hero is
  `sticky top-0 z-0 h-screen` and scales to `0.96`/dims with scroll; `Cover`
  has natural height and scrolls up over it with rounded top corners. Content is
  centered in normal flow: top pad `25vh`, label, 2-line heading
  (`clamp(32px,3.4vw,72px)`), `11vh` gap, a fixed stadium pill
  (`53vw × 20vw` desktop / `72vw × 26vw` tablet / `92vw × 36vw` mobile) with a
  seamless transform-loop gradient/video fill and "MY WORK" (click → Lenis
  scroll to `works`), then `12vh` gap + closing line and `30vh` bottom pad.
  Pill-based `useScroll` drives the section background `#0A0A0A → #E8E8E8` and
  text `white → #111111` as the pill leaves the viewport. Reduced motion keeps
  the static black state.
- **Step 6 — Recent works (`src/components/Works.tsx`, `id="works"`):** replaces
  the works placeholder. Tall wrapper (`travel / SPEED + HOLD_VH + 100vh`) with a
  `sticky top-0 h-screen overflow-hidden` inner; the centered heading
  (`clamp(40px,4.4vw,96px)` / `12vw` mobile, weight 400, `-0.05em`) sits behind
  the row (`z-0` vs `z-10`) and fades to `0.5` as the cards come in. The row
  (10 cards, portrait/landscape alternating: `16.25×21.6vw` / `21.6×16.2vw`,
  `1.8vw` gap, `0.85vw` radius, top-aligned at `27vh`; mobile `62×82vw` /
  `80×60vw`, `4vw` gap, `24vh`, `16px` radius) translates `x` from the right
  edge until the last card parked `2vw` from the left edge — both ends measured
  (`offsetLeft`/`offsetWidth` + viewport), never hard-coded. Motion is
  `useScroll` → `useTransform` on `translate3d` with three explicit stops
  (`[0, pEnd, 1] → [startX, endX, endX]`, `clamp: true`, where
  `pEnd = (travel / SPEED) / pinnedScroll`), so the row parks exactly at `endX`
  for the whole hold and never travels further; no spring layer is stacked on
  Lenis. `will-change: transform` only while in view; measurement happens on
  mount, after fonts/images load, and on resize (row `ResizeObserver`) only.
  Desktop hover scales the image `1.04` inside the card. Images are
  downloaded Unsplash photos in `public/works/` (`work-01…10.jpg`, ≤1200px,
  q80, `decoding="async"`; see `public/works/CREDITS.md`), first two `priority`,
  rest lazy.   `prefers-reduced-motion` drops the pin for an `overflow-x-auto`
  snap row. Section ends with rounded bottom corners (`28px` / `48px`).
- **Step 7 — Contact (`src/components/Contact.tsx`, `id="contact"`):** replaces
  the contact placeholder. The contact screen is a `fixed inset-0 z-0` black
  (`#0A0A0A`) layer behind an opaque content wrapper (`relative z-10`); a
  trailing `100vh` transparent spacer carries `id="contact"` and is the scroll
  anchor, so scrolling past the Works section's rounded bottom corners uncovers
  the contact screen from the bottom and ends exactly on the very end of the
  page (no extra scroll). Heading block top at `18vh`. Content: centered 2-line
  heading (`15vw` mobile / `8.2vw` desktop, weight 500, `-0.045em`,
  `leading-[0.92]`, line 2 accent); each line is its own animated `motion.span`
  so the heading makes no stacking context — z-order back-to-front is line 1
  (`z-0`), a `7vw` (`24vw` mobile) grayscale avatar on a `#E8E8E8` circle
  (`z-10`) that straddles the two heading lines, then line 2 (`z-20`), whose
  letters draw over the circle; email block at `65vh` (`4.6vw` / `1.7vw`) with
  an accent copy button (`30px` / `32px`, 16px icon, ~10px radius; clipboard +
  fallback, check + "Copied" feedback for 1.5s), bottom-left `©2026` and
  bottom-right socials.
  Reveal drives avatar `scale 0.85→1` and heading fade/rise via a
  `useScroll` on the spacer; reduced motion shows the static final state.
  `Nav` computes its active item from scroll (works while it spans the middle;
  Home otherwise — see Phase 4B, the pill is Home / Works / About now) and the
  Contact email pill scrolls (Lenis) to the very end.
- **Step 8 — Hero responsive (mobile + tablet, `<1024px` only; desktop `lg:` untouched):**
  every `sm:` in Hero/Nav became `lg:` so tablet reuses the mobile layout. Heading
  `14vw`, weight 500, `-0.05em`, `leading-[1.1]`, block top `18vh`; line 1 at
  `13vw`, line 2 right-aligned (`pr-[4vw]`). Subtitle `15px`/`1.25`, `38vw` from
  `54vw` (left edge of line 2's `text-right` block). Photo `/ai.png` is `100vw`
  (head `32vw`, head top `42vh`, head center `35vw`) placed at
  `top-[calc(42vh_-_3.22vw)] left-[45.82vw]` (from measured alpha: top opaque
  `2.417%` of height, head width `32.04%` / center `39.18%` of width), bleeding off
  the left/bottom edges. Contact pill `150×52px` (nav pill height);
  scroll button `hidden lg:flex`;
  nav pill `268×52px` (desktop size at every breakpoint) at `bottom-[6vh]`, socials
  below it at `bottom-[3vh] right-6`. `sizes="(max-width:1023px) 100vw, 37vw"`. Photo file is
  the same `/ai.png` at every breakpoint.
- **Step 9 — Hero photo fix (`docs/fix.txt`):** the photo is positioned from the
  **head** (the head is off-center in `/ai.png`), never with `-translate-x-1/2` on the
  image. Alpha measurements (`sharp`, read-only) of the top-18% band of the person's
  opaque bbox: `headTopFrac 0.026934`, `headCenterFrac 0.356814`, `headWidthFrac 0.403315`.
  Constants at the top of `Hero.tsx`: `PHOTO_HEAD_W_VW_DESKTOP = 14.8`,
  `PHOTO_HEAD_W_VW_MOBILE = 34` (capped `285px` on tablets). Rendered image width =
  head width / `headWidthFrac` (`36.696vw` desktop), height = width · (1448/1086) so the
  aspect is never distorted. Desktop (≥1024px, approved): `left 27.906vw`,
  `top calc(30vh - 1.318vw)` → head center `41vw`, head top `30vh`. Mobile/tablet
  (<1024px, screen-relative): head `min(34vw, 285px)`, head center `28vw`
  (`left = 28vw − 0.356814 · renderedWidth`), and **bottom-anchored**
  (`bottom: -8vh`) so the person always reaches past the hero bottom; head top lands at
  ~`55–58vh` on phones. `PHOTO_MOBILE_DOWN_VH` controls how far below the bottom it sits.
  The image bleeds off the left edge (`left ≈ −2vw`); head right edge sits at `45vw`,
  leaving `~9vw` clear of the subtitle (`54vw`). Values applied via `--photo-*` custom
  properties + Tailwind `var()` utilities; uniform `w-full h-auto`; the hero crops the
  bottom via `overflow`. `next/image` `preload` kept (desktop unchanged).

## Admin (Phase 1 — Supabase auth)

Homepage is untouched; the admin area lives beside it under `/admin`.

- **Clients:** `src/lib/supabase/browser.ts` (anon, browser), `server.ts` (anon,
  cookie-aware, `await cookies()`), `admin.ts` (service role, `import "server-only"`,
  never imported by client code). Env: `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; see `.env.example`
  (`.env.local` stays gitignored).
- **Migration:** `supabase/migrations/001_settings.sql` — `settings(key, value jsonb,
  updated_at)`, RLS on with no policies, `grant all … to service_role`, seeds
  `admin_emails` with a placeholder. Not run by the app; run manually in Supabase.
- **Auth:** `src/app/admin/(dashboard)/layout.tsx` calls `await connection()` before
  `requireAdmin()` so the guarded tree always renders at request time (Cache Components).
  `src/lib/auth/requireAdmin.ts` (getUser → read `admin_emails` via service
  role → case-insensitive compare; redirects to `/admin/login` or, when signed in but
  not allowlisted, to `/auth/signout?reason=not-authorized`). `src/lib/auth/actions.ts`
  exports the `signOut` server action used by the sidebar. `src/app/auth/callback/route.ts`
  exchanges the OAuth code and redirects to `/admin`; `src/app/auth/signout/route.ts`
  clears the session (Server Components can't write cookies).
- **Routes:** `src/app/admin/layout.tsx` (metadata `robots: noindex,nofollow`, `%s · Admin`)
  is unguarded; `src/app/admin/login/page.tsx` (`instant=false`) renders the dark
  `LoginForm` (Google OAuth + email/password, validation/loading/error, "Not authorized").
  `src/app/admin/(dashboard)/layout.tsx` (`instant=false`) calls `requireAdmin()` and
  wraps `AdminShell` (black sidebar, orange accent, active item, admin email, sign-out;
  mobile = top bar + slide-in drawer). Dashboard and About are placeholders with a
  title only; Projects, Messages and Settings are built out.
- **SEO:** `src/app/robots.ts` disallows `/admin`; admin layout is `noindex`.
- All `/admin/*` routes are dynamic (Cache Components enabled); homepage stays static.

## Admin (Phase 2 — Settings, Messages + public Contact popup)

- **Settings data:** `src/lib/settings.ts` (server-only). `settings` table keys
  `site_name`, `contact_email`, `socials` (`[{name,url}]`), `admin_emails`.
  `getPublicSettings()` is `use cache` + `cacheLife("max")` + `cacheTag(SETTINGS_TAG)`
  so the homepage stays static and revalidates on demand; `getAdminSettings()` is
  uncached (request-time). Public reads never touch `admin_emails`.
- **Messages data:** `src/lib/messages.ts` — `getMessages()` uncached (fresh admin
  reads via the service role; columns `email`, `message`, `is_read`, `created_at`),
  newest first. `revalidateTag("messages", { expire: 0 })` still runs after
  mutations. Migration `supabase/migrations/002_messages.sql` (run manually; RLS on,
  no policies, service-role only). Not run by the app.
- **Admin actions:** `src/lib/admin/settings-actions.ts` (`saveSettings`) and
  `src/lib/admin/message-actions.ts` (`setMessageRead`, `deleteMessage`). Each calls
  `requireAdmin()` first, validates (email/url format, message length), writes with
  the service role, then `revalidateTag(tag, { expire: 0 })` (read-your-own-writes).
- **Admin pages:** page shells are synchronous/static; data reads live in async
  server components (`SettingsContent` / `MessagesContent`) wrapped in
  `<Suspense>` with skeletons. `/admin/settings` (`getAdminSettings` →
  `SettingsForm` — site name, public contact email, socials rows add/remove, admin
  emails list) and `/admin/messages` (`getMessages` → `MessagesList` — unread badge,
  toggle read/unread, delete). Sidebar order unchanged.
- **Public contact popup:** `src/components/contact/ContactPopupProvider.tsx`
  (client context + `useContactPopup().openContact`), `ContactPopup.tsx`
  (dynamic-imported `next/dynamic` `ssr:false`; dark `#0A0A0A` sheet with accent,
  dimmed backdrop, X close, rises from the bottom ~1.3s `EASE`, content staggers
  0.15s; Escape/backdrop close; Lenis paused via `lockScroll`
  (`SmoothScroll.tsx`); mobile = full-width bottom sheet, desktop = centered panel
  with two columns) and `ContactForm.tsx` (`useActionState` → `submitContactMessage`).
  Opened by the hero's **top-right Contact pill** (`Hero.tsx`); `page.tsx` fetches
  `getPublicSettings()` and passes them to the provider (email/socials come from
  public settings only). All copy lives in `content.contact.popup`.
- **Contact submit:** `src/lib/contact/actions.ts` (`submitContactMessage`) —
  server-side validation (email format, message 1–2000 chars), honeypot field
  (`company`), in-memory per-IP rate limit (5 / 10 min), insert via service role,
  generic client errors; `revalidateTag(MESSAGES_TAG, { expire: 0 })` on success.
  Success + inline error states; no raw errors leak.

## Admin (Phase 3a — Projects)

- **Migration:** `supabase/migrations/003_projects.sql` — `projects` (`name`,
  `description`, `tech_stack text[]`, `demo_link`, `cover_image_url`, `sort_order`,
  `is_visible`, timestamps) and `project_images` (FK `on delete cascade`,
  `image_url`, `sort_order`). RLS on with public SELECT only (`projects` where
  `is_visible = true`; images only for visible parents); service role gets all.
  Indexes on `projects(sort_order)` and `project_images(project_id, sort_order)`.
  Also creates the public `project-images` storage bucket (jpeg/png/webp, 10 MB)
  when it does not already exist. Run manually in Supabase.
- **Data:** `src/lib/projects.ts` (server-only) — `PROJECTS_TAG = "projects"`,
  `PROJECT_IMAGES_BUCKET = "project-images"`, `Project` / `ProjectImage` types,
  `getProjects()` (`use cache` + `cacheLife("max")` + `cacheTag`, visible only,
  ordered, galleries fetched in parallel) for the later Works page (unused so far),
  `getAdminProjects()` uncached for admin, and `storagePathFromPublicUrl()`.
- **Actions:** `src/lib/admin/project-actions.ts` — create / update / delete /
  reorder / visibility plus add / remove / reorder gallery images. Every action
  calls `requireAdmin()` first, validates, writes with the service role, then
  `revalidateTag("projects", { expire: 0 })`. Deleting a project (or replacing a
  cover / removing a gallery image) also removes the original files from Storage.
  `createProjectImageUpload` signs a path-scoped upload URL (originals untouched).
- **Admin UI:** `/admin/projects` (`getAdminProjects` in `<Suspense>` →
  `ProjectsManager`) lists cover thumb, name, visible/hidden badge, up/down
  reorder (touch-friendly buttons), visibility toggle, edit and inline delete
  confirm. `ProjectForm` has only name, description, tech-stack chips (Enter to
  add, Backspace/× to remove), demo link, cover upload, multi-image gallery
  (progress, reorder, remove) and visibility. Uploads use the signed URL with XHR
  progress; JPEG/PNG/WebP up to 10 MB; client + server validation and
  loading/success/error states. Fully responsive.

## Public Works page (Phase 3b)

- **Route:** `src/app/works/page.tsx` (`/works`, static/ISR — `getProjects()` is
  `use cache` + 30d revalidate; no Suspense needed) renders `WorksList` inside an
  opaque `relative z-10 rounded-b-[28px] bg-background sm:rounded-b-[48px]`
  wrapper, then reuses the homepage's `Contact` (fixed screen + `100vh` spacer)
  so the works content slides up over it — same footer-reveal technique. The
  project popup (Phase 3c) is wired from the cards; the navbar is untouched (Phase 5).
- **Data:** real visible projects from `getProjects()` only (never fake), ordered
  as stored. `src/app/works/loading.tsx` mirrors the layout with an animated
  skeleton. Metadata title `Selected works` + a description from `content`.
- **Copy:** `content.worksPage` (`heading`, `empty`, and `popup` labels).
- **Component:** `src/components/works/WorksList.tsx` (client) renders the h1
  "Selected works" + count `[NN]` (real number, zero-padded) and the list.
  Mobile (<768px) = single-column stack with a rise only; tablet/desktop
  (`md:`) = alternating two-sided layout (`w-full` → `58%` → `46%`, portrait
  `aspect-[4/3]` box, `object-cover`, never stretched). Each card is a
  `motion.button` (keyboard-focusable) calling `onSelect(project, trigger)` with
  a subtle `group-hover` image scale; under the image only the project name.
  Empty state shows `content.worksPage.empty`.
- **Motion:** shared `EASE` + `duration.slow` only, opacity/transform only.
  Heading lines reveal down from a clipped mask (staggered `0.1s`/`0.3s`); the
  first card rises from below after load; the rest `whileInView` (`once`,
  `amount: 0.3`) drift in from the left/right (`28px`). The list is keyed on the
  `md` breakpoint so side cards capture the correct drift; reduced motion renders
  the static final state, no drift on touch.
- **Images:** `next/image` `fill` + `sizes`; `next.config.ts` adds
  `images.remotePatterns` for the Supabase Storage `project-images` public bucket,
  derived from `NEXT_PUBLIC_SUPABASE_URL` (empty when unset).

## Public project popup (Phase 3c)

- **Wiring:** `src/components/works/WorksExplorer.tsx` (client) owns the selection
  state and renders `WorksList` + the popup; `ProjectPopup` is `next/dynamic`
  (`ssr:false`) and is not mounted/requested until the first card is opened.
  Closing keeps the project mounted through the exit animation; `onExited` then
  clears it. Focus returns to the clicked card after the exit finishes.
- **`ProjectPopup.tsx`:** bottom sheet (`fixed inset-0 z-[100]`, `92dvh`) rising
  `y: 100% → 0` with `PANEL_DURATION = 1.3s` + `EASE`; rounded top corners, dimmed
  backdrop (`bg-black/70`), accent circular close button (44/48px tap target).
  Content fades in one-by-one after the rise (`delayChildren: 1.2`,
  `staggerChildren: 0.15`, item `duration.slow`); on close the items fade
  (reversed stagger) then the panel slides down (`duration.slow` + `0.18s`
  delay) and the dim fades out. Only opacity/transform animate; `will-change` is
  applied only while the panel animation runs.
- **Content:** desktop = two sides (`lg:flex-row`): details (name, description,
  tech chips, demo link with `target="_blank"` + `rel="noopener noreferrer"`,
  hidden when empty) beside an independently scrolling gallery. Tablet/mobile =
  single column (details then gallery) with the whole sheet scrolling. Gallery
  uses the project images; when empty it falls back to the cover (nothing if both
  are missing). `next/image` `width={0} height={0}` + `height:auto` keeps natural
  aspect ratios (no cropping).
- **Behaviour:** Escape, backdrop click and close button close; `lockScroll()` /
  `unlockScroll()` pause/restart Lenis (native fallback) while the inner
  `data-lenis-prevent` scrollers keep working; focus is trapped (Tab/Shift+Tab)
  in the dialog (`role="dialog"`, `aria-modal`, `aria-labelledby` the project
  name). `prefers-reduced-motion` = fade only, no rise.

## Admin (Phase 4 — About)

- **Migration:** `supabase/migrations/004_about.sql` — `about_hero_cards`
  (`media_type` image|video, `file_url`, `sort_order`), singleton `about_intro`
  (`is_singleton` unique+checked; `hero_heading`, `hero_subtitle`,
  `statement_heading`, `paragraph`, `photo_url`, `location`, `email`, `phone`),
  `services` (`title`, `description`), `skill_categories` (`name`), `skills`
  (`category_id` FK cascade, `name`, `icon_url`), `education` (`degree`,
  `school`, `year`). RLS on with public SELECT; service role gets all. Widens the
  existing `project-images` bucket to jpeg/png/webp + mp4/webm, 50 MB. Run
  manually in Supabase; the app never runs it.
- **Data:** `src/lib/about.ts` (server-only) — tags `about-hero`, `about-intro`,
  `services`, `skills`, `education`; `AboutHeroCard` / `AboutIntro` / `Service` /
  `Skill` / `SkillCategory` / `EducationItem` types; cached public getters
  (`getAboutHeroCards`, `getAboutIntro`, `getServices`, `getSkillCategories` with
  nested skills, `getEducation`) each `use cache` + `cacheLife("max")` +
  `cacheTag`, and uncached `getAdmin*` variants for admin. Reuses
  `PROJECT_IMAGES_BUCKET` + `storagePathFromPublicUrl` from `projects.ts`.
- **Actions:** `src/lib/admin/about-actions.ts` — `requireAdmin()` first;
  signed uploads (`createAboutMediaUpload`, `kind` image|video; images
  jpeg/png/webp ≤10 MB, videos mp4/webm ≤50 MB, path `about/<scope>/…`); hero
  add/delete/reorder; `saveAboutIntro` (upsert on `is_singleton`, removes a
  replaced photo); service / skill-category / skill / education CRUD + reorder.
  Deleting a category cascades its skills and removes their icons; replacing or
  removing a photo/icon deletes the old file. Every write `revalidateTag`s its
  relevant tag (`{ expire: 0 }`) and `/about`.
- **UI:** `/admin/about` (`getAdmin*` in `<Suspense>` → `AboutManager`) is one
  tabbed page (Hero, Intro, Services, Skills, Education) in
  `src/components/admin/about/` (`AboutManager`, `HeroSection`, `IntroSection`,
  `ServicesSection`, `SkillsSection` with nested `CategoryCard`/`SkillItem`,
  `EducationSection`, `shared.ts` styles + XHR upload). Hero cards: type toggle
  image|video, upload, preview (img or `<video controls>`), reorder, inline
  delete. Intro: all `about_intro` fields incl. hero heading/subtitle, photo
  preview replace/remove, single save. Skills: category add/rename/delete (warns
  it removes skills)/reorder and per-skill name + optional icon
  upload/replace/remove, reorder, delete. Same admin styling, dark/charcoal +
  accent; loading and empty states, buttons disabled while saving; panels stay
  mounted (hidden) to preserve unsaved input. Fully responsive.

## Public About page (Phase 4B)

- **Route:** `src/app/about/page.tsx` (`/about`, static — all reads are
  `use cache` + 30d; `Promise.all` over `getPublicSettings`, `getAboutHeroCards`,
  `getAboutIntro`, `getServices`, `getSkillCategories`, `getEducation`). The opaque
  `relative z-10 rounded-b-[28px] bg-background sm:rounded-b-[48px]` wrapper reuses
  the homepage `Contact` fixed screen + `100vh` spacer (same footer-reveal). Metadata
  from `content.aboutPage.meta`; `src/app/about/loading.tsx` mirrors the skeleton.
- **Copy:** `content.aboutPage` (intro labels, services/skills/education headings).
  Sections with no data return `null` (no fake content).
- **Components** (`src/components/about/`): `AboutHero` (server; 2-line heading
  split on `\n`, accent subtitle, then `MediaMarquee`), `MediaMarquee` (client;
  two identical `<ul>` copies in one `w-max` track, the plain-CSS `.marquee-track`
  class translates `-50%` for a seamless loop; cards are repeated so one copy is
  always wider than the viewport (`MIN_CARDS_PER_COPY = 6`); `prefers-reduced-motion`
  only slows it (140s) instead of stopping it; per-card right margin — no container
  gap — so the seam is exact; image `next/image` `fill` `quality={95}` + `sizes`,
  video muted/loop/playsInline/autoPlay `preload="metadata"`, all `aspect-[3/4]`
  `object-cover`), `AboutIntro` (server; statement top-left, photo bottom-left,
  paragraph top-right, details bottom-right via explicit 12-col grid placement so
  mobile DOM order stays statement → photo → paragraph → details; label / thin line
  / rows, only rows with values, email/phone as links), `Services` (server; dark
  `#0A0A0A`, `id="about-services"`, "What I can help with", numbered 01…, 1/2/3
  columns), `Skills` (server; light section on a flat straight edge right after
  the dark section) + `SkillsTabs` (client; centered category pills with one
  sliding black `layoutId` pill, first active, skills as line + name columns
  with optional 20px `object-contain` icon), `Education` (server; centered
  label + heading, columns = line / degree / `school · year`).
- **Fixed chrome:** `src/components/ContactButton.tsx` is extracted from the Hero
  (`variant="accent"` default — homepage unchanged; `variant="dark"` = white pill +
  accent badge) and used by `AboutHeader` (client; fixed top-left logo + top-right
  contact). `AboutHeader` probes `about-services` and the `contact` reveal spacer at
  `y=44px` and inverts the logo/button for legibility.
- **Nav:** `content.nav` is now `Home / Works / About` (`{ label, target, href }`);
  `Nav.tsx` scrolls to `target` when that section exists on the current page,
  otherwise `router.push(href)`, and derives the active item from the pathname on
  non-home routes (scroll-based on the homepage). Contact is reached via the
  top-right button + footer reveal, not the pill. The `/works` navbar stays Phase 5.
- **Hydration + media fixes (`docs/fix.txt`):** `Nav`'s active item is derived
  from `usePathname()` during render (`/` → Home, `/works` → Works, `/about` →
  About); the homepage scroll highlight lives in `scrollActive` state that stays
  `null` until `useEffect` runs, so the first client render always matches the
  server. `useReducedMotion` only changes transition durations (never the rendered
  DOM), so it cannot cause a mismatch. About hero cards and the intro photo use
  `quality={95}` with sizes matching their real rendered width; no other pages
  changed.

## Public About page — layout & typography (`docs/fix.txt`)

CSS/layout/sizing only — all stored text/media is rendered unchanged; colors,
section order and animation logic untouched.
- **Hero (`AboutHero.tsx`):** section `min-h-[100svh] pb-[6vh]`; heading block is
  a `min-h-[62vh]` container with `pt-[20vh]`, centered (`max-w-[1000px]
  text-center`), heading `clamp(36px,4.4vw,88px)` / 400 / `-0.02em` /
  `leading-[1.1]` /
  `text-balance hyphens-none break-normal` always on 2 lines: a `\n` in
  `hero_heading` is honored as-is, otherwise the h1 is measured
  `mx-auto max-w-[92vw] lg:max-w-[38vw]`; subtitle `clamp(18px,2vw,38px)` /
  400 / accent / `max-w-[34ch]` — so the cards row starts at 62vh.
- **Cards (`MediaMarquee.tsx`):** top-aligned (`items-start`) repeating
  square/tall/short size pattern in `CARD_SIZES`
  (desktop `21/19.5/21vw × 21/26/12.8vw`, tablet ×1.62, mobile ~62vw wide),
  `rounded-[20px]`, tight gap `mr-[0.6vw]`, track `-ml-[6vw]` so the first
  card bleeds off the left edge; only TWO vertical levels via `CARD_LEVELS`
  (`mt-[4svh]` for the tall card → top ≈66svh, `mt-[14svh]` for the rest →
  top ≈76svh, row top = 62vh), so every card runs past the fold; one copy is
  padded to ≥6 cards and a **multiple of 3** (`buildItems`) so the pattern
  continues seamlessly across the loop copy. Images keep `quality={95}` +
  `sizes` 21/34/62vw.
- **Intro:** section padding `px-[2.6vw] pt-[clamp(110px,9vw,160px)]` (clears
  the fixed header), no inner max-width; heading `clamp(28px,3vw,58px)` / 400 /
  `-0.02em` in
  row 1, left aligned, `max-w-full lg:max-w-[62vw]`; photo + right column
  both row 2 (row gap `lg:gap-y-[90px]`) — photo `w-full
  sm:w-[clamp(260px,23vw,440px)] rounded-[16px]` (no background card) with
  `width/height` + `h-auto w-full` (original aspect, never cropped, no grey
  card behind it), right column holds the paragraph
  (`clamp(15px,1.1vw,19px)`, `leading-[1.5]`, `max-w-[46ch] lg:max-w-[24vw]`,
  muted) and the detail rows below it with `[overflow-wrap:anywhere]` +
  `min-w-0` values (full email always visible); mobile = single column, same
  DOM order (statement → photo → paragraph → details).
- **Services:** dark `#0A0A0A`, `id="about-services"`, label + heading centered
  (`text-center`, heading `clamp(30px,3vw,58px)` white 400 / `-0.02em`),
  container `max-w-[1500px]`, section is a `flex flex-col justify-center` with
  `lg:min-h-[100svh]` (desktop = one screen, content centered; mobile/tablet
  natural height) and top padding `clamp(80px,8vw,130px)`; grid 3/2/1 columns,
  `gap-x-[75px]`, `gap-y-[clamp(40px,4vw,80px)]`; each item is number (18px
  light gray) → `LineDraw` → title `clamp(22px,1.9vw,36px)` `text-balance` →
  description `clamp(14px,1vw,18px)` at 70% white, `mt-[clamp(20px,2vw,40px)]`,
  `max-w-[46ch] lg:max-w-[22vw]`. It only grows when there are >6 services.
- **Skills/Education:** light sections right after Services on a **straight
  flat edge** (no rounded top corners, no negative overlap); label + heading
  centered, heading `clamp(30px,3vw,58px)` / 400 / `-0.02em`. Skills tabs are
  centered pills (`SkillsTabs`) with a single black `layoutId` pill sliding
  between them; skills render as Services-style columns — `LineDraw` on top,
  name `clamp(20px,1.7vw,32px)` + optional icon below — in a `max-w-[1500px]`
  3/2/1 grid (`gap-x-[75px]`, `gap-y-[clamp(32px,3vw,56px)]`), no chips.
  Education (`content.aboutPage.education.heading` = "Where I studied") uses the
  same grid: line → degree `clamp(20px,1.7vw,32px)` → `school · year` muted.
  Fixed header and bottom pill unchanged.
- **Heading weight (About only):** all headings and big titles (hero h1, intro
  statement, Services heading + titles, Skills heading + skill names, Education
  heading + degree titles) are weight 400 with `tracking-[-0.02em]`. Home and
  Works are untouched.
- **Corner rounding:** the only section-level rounding on `/about` is the
  bottom corners of the content wrapper in `page.tsx` (`rounded-b-[28px]` /
  `sm:rounded-b-[48px]`); the footer reveal is unchanged. (Element shapes —
  media cards, the intro photo, pill tabs/buttons — keep their own radii.)

## Public About page — load & scroll animations (`docs/fix.txt`)

- **Tokens:** `src/lib/motion.ts` gains an `about` object (`pageDuration` 1.3,
  `popupDuration` 1.3, `itemDuration` 1.0, `stagger` 0.15, `easeInOut`
  `[0.65,0,0.35,1]`, `easeOut` = `EASE_OUT`). Every `/about` animation reads its
  timing/easing from here — no hardcoded durations; only `opacity`/`transform`
  animate (plus `clip-path` in `LineDraw`, see below).
- **Helpers:** `src/components/about/Reveal.tsx` (client) — `Reveal` (whileInView
  once, `margin:"-10%"`, directional fade+slide, renders a `motion.div` so grid
  placement stays), `WordReveal` (word-by-word rise via one parent
  `whileInView` + `staggerChildren`), `LineDraw` (always a full-size 1px element
  with its final colour; the reveal animates a `clip-path` inset left→right —
  never `scaleX(0)`, which collapses the bounding box to zero width and, under
  the shared `margin:"-10%"` rootMargin, never fires `whileInView` for lines in
  the outer 10% edge bands, i.e. the first/last grid column),
  `LoadMaskLine` / `LoadRise` (hero initial-load, absolute delay), `SectionRise`
  (whole section slides up), and `useSimple()` (`prefers-reduced-motion` **or**
  `(hover: none)` → short fades, no word split/slide/delay). Touch is probed via
  `useSyncExternalStore` (server/first-client render identical → hydration safe).
- **Sequence:** Hero (`AboutHero`) load order line 1 → line 2 (masked rise) →
  subtitle → cards row (`LoadRise`, distance 56); `MediaMarquee` takes
  `startDelay` (`animationDelay`) so the auto-slide starts after the row appears
  (ignored under reduced motion). Intro: statement `WordReveal`, paragraph
  `Reveal` from right, photo `Reveal` from left, then detail rows staggered.
  Services (`SectionRise` + per-column `Reveal` whose `LineDraw` draws first).
  Skills heading `Reveal`; `SkillsTabs` pills `whileInView` stagger, the active
  black pill slides via `layoutId` (tween `duration.base` + `EASE`), and
  `AnimatePresence mode="wait"` re-staggers the skill columns on each tab
  change (they also enter `whileInView`, so the first category animates on
  first view). Education: label + heading `Reveal`, then columns staggered.
  Footer/Contact reveal, Nav pill and header color adaptation untouched.

## Public Works page — fixed chrome, pinned heading, card layout (`docs/fix.txt`)

Supersedes the Phase 3b list layout/motion bullets. Content (names, images,
data) still comes from the admin dashboard and is rendered unchanged.

- **Fixed chrome (bug fix):** `/works` renders the *same*
  `ContactPopupProvider` (settings from `getPublicSettings()`) + `AboutHeader` +
  `Nav` as `/about`, **outside** the opaque `relative z-10` wrapper — they were
  never rendered on the route at all, so the logo, contact pill and nav pill
  were missing (and `ContactButton` would throw without the provider). Nothing
  is duplicated; z-index/behaviour is identical to About.
- **Pinned heading (`StickyHeading` in `WorksList.tsx`):** a zero-height
  `sticky top-[36vh] z-0` block (no flow space), with the h1 absolutely
  centred on it (`inset-x-0 top-0 -translate-y-1/2`), so the text centre sits
  at 36vh. Heading `clamp(40px,13vw,90px)` / `lg:clamp(52px,9vw,190px)`,
  weight 400, `-0.05em`, `leading-none`, near-black; count
  `clamp(14px,1.1vw,22px)` 400 gray on the baseline right after it. Cards are
  `relative z-10`, so they rise **over** the heading. Colour is driven by
  `useScroll().scrollY` through `mixHex(#111111 → #A8A8A8)` over
  `[0.38vh, 0.55vh]` of scroll (smooth, fully reversible).
- **Release:** the section is `<section id="works">` = a `relative` sticky
  **scope** (heading + list) plus an `18vh` sibling buffer; sticky releases
  when the scope ends (just after the last card) and the buffer keeps the
  released heading inside the content wrapper, never over the fixed contact
  screen. The contact/email reveal itself is untouched.
- **List:** `pt-[85vh]` puts the first card top at 85vh on scroll 0 (the
  heading alone owns the first screen); `gap-[13vh]` = name-bottom → next card
  top; `px-[2.6vw]` side padding; `pb-[26vh]`.
- **Cards:** alternate left/right at every size — left `w-[88vw] lg:w-[35vw]`
  `aspect-[1.32]`, right `w-[66vw] lg:w-[24vw]` `aspect-[4/5]` right-aligned;
  `rounded-[14px]`, `object-cover` (`sizes` per side), name `mt-[14px]`
  `text-[16px]` / `lg:text-[clamp(15px,1.15vw,22px)]` weight 400 `-0.02em`
  left-aligned under the card. `DESKTOP_QUERY` is `(min-width: 1024px)` (sizes
  + entrance drift). Click → popup behaviour unchanged.
- `src/app/works/loading.tsx` mirrors the same skeleton (pinned heading +
  alternating cards). `AboutHeader` (and the per-page `Nav`) are gone — the
  shared chrome now lives in the `(public)` layout (see below).

## Public Works page — uniform cards + admin cover framing (`docs/fix.txt`)

Supersedes the card bullets above. Animations, colours, the alternating
placement, the spacing and the entrance drifts are unchanged.

- **One card size:** every card uses the *left* card's current width on every
  breakpoint — `w-[88vw] lg:w-[35vw]` — and the image box is `aspect-[16/10]`
  (`rounded-[14px]`, `overflow-hidden`, `bg-charcoal/5`, `ring-1 ring-black/5`).
  No card is wider than the left card was. Left cards stay left-aligned, right
  cards right-aligned; `gap-[13vh]`, `pt-[85vh]`, `pb-[26vh]` and the
  `±28px` side drifts are untouched. `sizes` = `(min-width: 1024px) 35vw, 88vw`.
- **Shared rendering rule:** `src/lib/cover-adjust.ts` holds the `CoverAdjust`
  type (`fit`, `posX`, `posY`, `zoom`), the defaults (`contain`, 50, 50, 1) and
  `coverAdjustStyle()` — the single place that turns the settings into CSS:
  `contain` → `object-fit: contain` + `object-position: center`, `cover` →
  `object-fit: cover` + `object-position: pos% pos%`; the zoom is always a
  uniform `transform: scale()` around `transform-origin: pos% pos%`. Never a
  stretch, never an edit of the uploaded file.
- **One component:** `src/components/ProjectCover.tsx` renders the cover with
  `next/image` (`fill`, `quality={95}`, correct `sizes`, no fixed pixel size)
  and that style. The Works card and the admin preview both use it, so the
  preview equals the published card.
- **Migration:** `supabase/migrations/005_project_cover_adjust.sql` adds
  `cover_fit text not null default 'contain'` (check `in ('contain','cover')`),
  `cover_pos_x numeric not null default 50`, `cover_pos_y numeric not null
  default 50` (both checked `0…100`), `cover_zoom numeric not null default 1`
  (checked `1…3`) to `projects`, and re-grants `service_role`. Run it manually;
  the app never runs it. Until it is applied the reads fall back to the old
  column list (default framing) and the writes report the missing migration.
- **Data:** `Project.coverAdjust` is read with the projects (clamped by
  `clampCoverAdjust`), written by `createProject`/`updateProject` (clamped and
  validated server-side, still `requireAdmin()` + `revalidateTag("projects")`).
- **Admin UI:** `ProjectForm` has an "Image fit" group under the cover image —
  Fit/Fill toggle, zoom slider (1…3, step 0.05), drag-to-position (pointer
  events, mouse + touch) on the live 16:10 preview, a focus marker and a
  "Reset" button. The preview uses the same box and the same rendering rule
  as the Works card. Uploading or removing the cover resets the framing.
  Tokens only (no new hex values); usable on phone, tablet and desktop.

## Shared chrome + page transitions (`docs/fix.txt`)

Home / Works / About moved into a **route group** `src/app/(public)/` (URLs
unchanged: `/`, `/works`, `/about`; `/admin` is outside and untouched). The new
`src/app/(public)/layout.tsx` owns everything that must survive a navigation:

- **Providers:** `ContactPopupProvider` (settings from `getPublicSettings()`)
  + `WorksPopupProvider` (lifted here so the nav pill can hide while a project
  sheet is open). Pages no longer render either.
- **Fixed chrome, rendered outside the transitioning content:** `SiteHeader`
  (`src/components/SiteHeader.tsx` — top-left logo "Daniyal" + top-right
  Contact button; hide-on-scroll via `useHideOnScroll`; inverts to white over
  any `[data-chrome-dark]` zone — the About services section and the
  footer-reveal contact screen — probed at y=44px; on `/` it also force-hides
  once `#cover` reaches the header line, and replays the original Hero corner
  entrance [logo + contact button] every time `/` is entered) and the bottom
  `Nav` pill (Home / Works / About; `layoutId` highlight; ignores clicks while
  a transition runs or when the item is the already-active route).
- **`PageTransition.tsx`:** the outgoing page stays mounted, frozen at its scroll
  offset, and shrinks in place from `scale 1 → 0.5` (`origin-center`, no dim, no
  overlay on top of it) **while it also LIFTS by `pageMotion.oldPageEndLift`
  (`-10vh`, so it moves UP)** — the lift is a `useTransform` of the *same*
  progress value as the scale and the incoming rise, so all three advance
  together (no second clock). The lift is applied on top of the frozen scroll
  offset (translate is additive), the scale stays centred. The incoming page
  rises from below the screen (`translateY 100% → 0`, **no rounded corners**).
  A fixed dark backdrop (`pageMotion.transitionBackground` = `var(--charcoal)`)
  sits behind both layers and is revealed around the shrinking page. One shared
  progress `MotionValue` (0 → 1) drives both layers through a single `animate()`
  call (`1.3s`, `pageMotion.easeInOut`), so the shrink and the rise always advance
  together; only `opacity`/`transform` animate and `will-change` is set on the
  two layers only while the animation runs. The animation starts only once the
  destination route commits (`state.started`), so the rising panel is never
  empty and the new page never flashes at the top; rapid clicks retarget the
  transition instead of reversing or blanking it, and a 2s failsafe
  (`pageMotion.failsafe`) force-resets the state if the route never commits.
  Scroll resets to top (Lenis-aware `resetScroll`, `lockScroll` during the
  transition). The transition root is `pointer-events-none`; the fixed chrome
  (`SiteHeader`, `Nav`) is a sibling of `PageTransition` in the layout, outside
  every transformed wrapper, so the nav pill is never blocked. Non-transition
  routes (admin, 404) render children in normal flow. Reduced motion = `0.2s`
  cross-fade (no movement, no `will-change` on the static old card).
- **Load-animation gating (heading plays ONCE per visit):** the incoming page is
  mounted ONCE (same element before/after the transition — never re-keyed, never
  re-mounted) and its load-animated elements (headings, subtitles, first card,
  hero cards row, photo) stay in their **initial hidden state with no animation
  running** while the page is still rising. The transition publishes a shared
  **"page ready"** signal — `usePageReady()` / `useLoadGate()` (`PageSignalContext`
  in `PageTransition.tsx`) — that is `false` for the whole transition and flips to
  `true` when the rise has finished; each page's load sequence then plays ONCE
  (`Hero.tsx`, `works/WorksList.tsx`, `about/Reveal.tsx` + `about/MediaMarquee.tsx`
  read the gate; `useFrozenPage()` tells the frozen copy of the outgoing page to
  render its FINAL state so it never replays its entrance). On a direct URL
  open/refresh (no transition) the signal is ready immediately, so there is no
  extra delay. The signal resets to `false` at the start of every new transition
  and is always set back to `true` (the 2s failsafe included), so it can never
  stay stuck.
- **Tokens:** `src/lib/motion.ts` gains `pageMotion` (`pageTransition` 1.3,
  `popup` 1.3, `item` 1.0, `stagger` 0.15, `fade` 0.2, `easeInOut` = `EASE`,
  `easeOut` = `EASE_OUT`, `oldPageEndScale` 0.5, `oldPageEndLift` -10 (vh),
  `transitionBackground` = `var(--charcoal)`, `failsafe` 2). `about.*` durations
  now derive from it (About keeps its own softer curves). The contact + project
  popups read their panel/stagger timings from `pageMotion` — no visual change.
- **`useHideOnScroll(options?)`** accepts an optional `forceHidden()` hard
  condition (used by `SiteHeader` on the homepage). `Contact.tsx`'s reveal
  spacer and `SectionRise` (`dataChromeDark` prop, used by Services) carry the
  `data-chrome-dark` markers the header probes.

## Admin (Phase 5 — Homepage content + shared "Image fit" control)

`docs/fix.txt`. The homepage is now fully admin-controlled; the design itself
did not change (the DB fallbacks are the current hardcoded values).

- **Migration:** `supabase/migrations/006_homepage_admin.sql` — adds
  `cover_fit` / `cover_pos_x` / `cover_pos_y` / `cover_zoom` to
  `about_hero_cards` (same defaults + range checks as the project covers; the
  existing rows are backfilled to `cover` so they keep their current cropped
  look), creates `homepage_content` (singleton, id = 1, every column nullable)
  and `homepage_cards` (`image_url`, `sort_order`, `visible`, the four framing
  columns), RLS on with a public SELECT, `grant all … to service_role`,
  indexes on `sort_order`. Run manually in Supabase; the app never runs it.
- **Shared "Image fit" control:** `src/components/admin/AdjustControl.tsx` —
  one reusable component (Fit/Fill, zoom slider 1…3 step 0.05, drag-to-position
  with mouse + touch, Reset) used by the Projects form, the About hero cards
  and the homepage cards. The live preview uses the same box as the published
  card. `src/components/MediaFrame.tsx` is the shared renderer (image via
  `next/image` fill/quality 95, or a muted looping `<video>`) and applies
  `coverAdjustStyle()` — the one rendering rule. `src/components/ProjectCover.tsx`
  is a thin wrapper over it. The uploaded file is never modified: only a
  uniform `scale()` around the focus point.
- **Defaults:** `src/lib/cover-adjust.ts` has `DEFAULT_COVER_ADJUST`
  (contain/50/50/1) for the project covers and `DEFAULT_CARD_ADJUST`
  (cover/50/50/1) for the media cards that are cropped to their box (About
  hero cards, homepage cards). `clampCoverAdjust(adjust, fallback)` clamps and
  falls back per surface.
- **About hero cards:** the framing columns are read/written like the project
  covers; `src/lib/about.ts` falls back to the legacy column list when the
  columns do not exist yet (`isMissingColumnError`), and
  `updateAboutHeroCardAdjust` reports the missing migration. The card sizes,
  the pattern of 3 and the radius live in
  `src/components/about/card-sizes.ts` and are shared by the public marquee
  and the admin preview.
- **Homepage data:** `src/lib/homepage-defaults.ts` (the current copy, the
  stock card list and the card shapes — the single source of truth for the
  fallbacks), `src/lib/homepage.ts` (cached public reads + uncached admin
  read, `HOMEPAGE_TAG`, `use cache` + `cacheLife("max")` so the homepage stays
  static, legacy/fallback reads when the tables are missing).
- **Homepage admin:** `/admin/homepage` (sidebar entry between Dashboard and
  Projects) → `src/components/admin/homepage/` — tabs Hero, Cover, Works
  cards, Contact. Fields: hero line 1/line 2/subtitle, cover label/heading
  1/heading 2, reel label + reel video, works heading + the cards (upload,
  "Image fit", visible, reorder, add/remove), contact line 1/line 2/accent
  word. The email and the socials stay in Settings. Every action
  (`src/lib/admin/homepage-actions.ts`) requires an admin, validates, writes
  with the service role and revalidates; the uploads reuse the
  `project-images` bucket (`homepage/` for cards, `homepage/reel/` for the
  video).
- **Public:** `src/app/(public)/page.tsx` is an async server component that
  reads the homepage content + cards and passes them to `Hero`, `Cover`,
  `Works` and `Contact` (each prop falls back to the current hardcoded value).
  The card row is rendered through `MediaFrame` with the shared shapes; the
  contact heading keeps its line-by-line animation and colours the accent
  word inside the second line.

## Image delivery (`docs/fix.txt`)

Uploaded images must reach the browser **untouched** — no resize, no
re-encode. The Next.js optimizer re-encodes every file it serves (WebP/AVIF),
which lowers the quality of an upload even with `quality={95}`.

- `src/lib/image-source.ts` — `isRemoteImageSrc(src)`: `true` for an absolute
  URL (an uploaded file in the public Supabase Storage bucket), `false` for a
  local path in `/public`.
- Every uploaded image is rendered with `unoptimized`, so the original public
  URL is used as-is: no `/_next/image` proxy, no width/quality query params,
  no `srcSet`. Surfaces: `MediaFrame` (project covers, About hero cards,
  homepage cards and their admin previews), `ProjectPopup` gallery,
  `AboutIntro` photo, `SkillsTabs` icons, and the plain `<img>` admin
  thumbnails/previews (they already served the original).
- The rendering rule is unchanged: `coverAdjustStyle()` (object-fit,
  object-position, uniform `scale()` around the focus point), the same boxes,
  aspect ratios, radii and sizes. `loading="lazy"` / `priority` stay as they
  were, and every image has `decoding="async"`.
- Local static assets keep the optimizer at `quality={95}`: `/ai.png` (hero +
  contact avatar, `preload`, untouched) and the stock `/works/work-01..10.jpg`.
- `next.config.ts` keeps `images.qualities: [75, 95]` and the Supabase
  `remotePatterns` for local/optimized assets; unoptimized images never reach
  the optimizer, so the config cannot affect them.
- **Upload pipeline stores the original bytes.** The browser PUTs the raw
  `File` to a Supabase signed upload URL (`uploadWithProgress` in
  `src/components/admin/shared.ts`); the server only signs a path
  (`createProjectImageUpload`, `createHomepageCardUpload`,
  `createAboutMediaUpload`) and returns the public URL. There is no canvas,
  no `sharp`, no resize, no quality reduction and no format conversion
  anywhere in the app — only the file extension is derived from the content
  type.

## Real-mobile viewport, overflow + scroll lock (`docs/fix.txt`)

Three Chrome-Android-only bugs: horizontal overflow on `/about`, the hero
photo/socials cut off by the toolbar, and a light strip below the Contact
reveal. Everything below is invisible on desktop and in the desktop emulator.

- **Viewport scale (`globals.css`):** `--vh-sm` / `--vh-lg` are `100vh` in
  `:root` and become `100svh` / `100lvh` inside `@supports (height: 100svh)` —
  the plain `vh` fallback comes first. Utilities in the markup use
  `calc(var(--vh-sm)*0.18)` style values (or `.h-viewport-sm` / `.h-viewport-lg`
  / `.min-h-viewport-*`), never raw `vh`/`svh` in a single declaration. `svh`
  (stable small viewport) for anything the user must see with the toolbar
  shown; `lvh` (large viewport) only for full-screen backgrounds/reveal layers.
- **Overflow:** `html` and `body` both `overflow-x: clip` (never `hidden`), plus
  `overflow-x-clip` on the three public page roots and the marquee wrapper.
  Fixed chrome/contact layers use `overflow-x-clip overflow-y-hidden`. The page
  transition wrappers clip too. No element uses `100vw`; `scrollWidth` equals
  `clientWidth` on `/`, `/works`, `/about`.
- **Fixed chrome:** `--z-chrome: 60` is the single z-index token for
  `SiteHeader` + `Nav` (popups stay at `z-[100]`). The nav pill and the hero
  socials add `env(safe-area-inset-bottom)`, the header
  `env(safe-area-inset-top)`; `viewport` export in `src/app/layout.tsx` is
  `device-width` / `initialScale: 1` / `viewportFit: "cover"` (zoom never
  disabled).
- **Page wrapper idle state:** `PageTransition` applies NO transform when idle
  (`{ transform: "none", willChange: undefined }` + `display: contents`) so it
  never becomes a containing block for fixed children; `will-change` is only
  set while the transition runs.
- **Hero:** background sticky layer `h-viewport-lg` (lvh, no gap when the
  toolbar hides) + one inner content box `h-viewport-sm` (svh) that every
  hero offset/photo/social anchors to. Photo bottom stays
  `calc(var(--vh-sm) * -0.08)` (same `bottom` anchoring, same head-derived
  left/top), so nothing about the desktop framing changed.
- **Contact reveal:** fixed layer `fixed inset-0 min-h-viewport-lg` and the
  spacer `h-viewport-lg` share the same unit, so they always agree. While the
  spacer intersects the viewport (IntersectionObserver, not the frozen copy)
  the component sets `data-footer="true"` on `<html>`; `html[data-footer]`
  (and its body) switch to `--charcoal` instantly, so no light strip can show
  when the toolbar reappears.
- **Scroll lock:** `lockScroll()` stops Lenis and sets `body` overflow; on
  touch-only devices (`hover: none`) it also sets
  `html[data-scroll-locked="true"]` (`overflow: hidden`) because with
  `overflow-x: clip` on the root the body lock no longer propagates. Desktop
  skips the root lock so the scrollbar (and the layout) never shifts.
- **Resize handlers:** `Works`, `Nav`, `MediaMarquee` only re-measure on a
  width change (or a >20% height change in Works), so the toolbar showing or
  hiding never re-renders or shifts the page.
- **Performance:** the About marquee keeps one CSS `translate3d` loop, paused
  via `animationPlayState` when offscreen (`IntersectionObserver`) or the tab
  is hidden, with `will-change` only while `[data-running="true"]`
  (`prefers-reduced-motion` only slows it to 140s). Marquee/media videos play
  only while in view (no `autoPlay` attr; `MediaFrame` observer) and the first
  marquee card is `priority`, the rest lazy. Popups use
  `calc(var(--vh-sm)*0.92)` / `max-h-[calc(var(--vh-sm)-60px)]`.

## Tuning

- `SPEED` (`Works.tsx`, top of file): horizontal px travelled per 1px of vertical
  scroll — raise to shorten the pinned section. `HOLD_VH` is the extra pinned
  scroll after the row parks; `END_MARGIN_VW` is the left gap of the last card.
- Lenis (`SmoothScroll.tsx`) uses `lerp: 0.14` + `wheelMultiplier: 1` for wheel;
  touch stays native.

## Commands

- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — ESLint
