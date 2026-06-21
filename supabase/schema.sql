-- Barista Log — optional Supabase schema (for power users who enable cloud sync).
-- The app works 100% offline without this. Run these statements in the
-- Supabase SQL editor of your own project, then paste the project URL + anon
-- key into Settings → Cloud sync.
--
-- Tables mirror the local Dexie tables. Every row carries updated_at/synced_at
-- so the client can do last-write-wins sync (see src/sync/syncEngine.ts).

-- Enable RLS so each user only sees their own rows.
-- Each table has a user_id defaulting to the authenticated user.

create extension if not exists "uuid-ossp";

create table if not exists beans (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  name text not null,
  roaster text, origin text, process text,
  roast_level text, roast_date date, notes text,
  updated_at bigint, created_at bigint
);

create table if not exists waters (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  name text not null, supplier text,
  tds numeric, gh numeric, kh numeric, notes text,
  updated_at bigint, created_at bigint
);

create table if not exists grinders (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  name text not null, type text, burr text,
  microns_per_click numeric, max_clicks int, source text,
  updated_at bigint, created_at bigint
);

create table if not exists recipes (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  title text, method text,
  bean_id uuid, water_id uuid, grinder_id uuid,
  data jsonb,                       -- full recipe payload
  updated_at bigint, created_at bigint
);

create table if not exists sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid(),
  recipe_id uuid, bean_id uuid, water_id uuid, grinder_id uuid,
  method text, date bigint,
  data jsonb,                       -- params, flavors, tags, rating
  updated_at bigint, created_at bigint
);

-- Row Level Security: owner-only access.
do $$
declare t text;
begin
  foreach t in array array['beans','waters','grinders','recipes','sessions'] loop
    execute format('alter table %I enable row level security;', t);
    execute format($p$
      create policy "owner_all_%1$s" on %1$I
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
    $p$, t);
  end loop;
end $$;

-- NOTE: photos (Blob) are not synced by the current stub. Store them in a
-- Supabase Storage bucket keyed by session id when you implement full sync.
