-- Barista Log — optional Supabase schema for cloud BACKUP / sync.
--
-- The app is local-first: every change is written to the browser (IndexedDB)
-- first, and the cloud is a backup you can restore on another device. Nothing
-- here is required to use the app.
--
-- Run this whole file once in your Supabase project's SQL editor. Then in the
-- app: Settings → Cloud sync → paste your Project URL + anon key, and sign in.
--
-- Design: a single generic table stores every record as JSON, tagged by its
-- collection (recipes, sessions, beans, waters, grinders). This keeps the sync
-- client simple and means schema changes never need a migration here.

create table if not exists sync_records (
  id          uuid not null,
  user_id     uuid not null default auth.uid(),
  collection  text not null,
  updated_at  bigint not null,
  deleted     int  not null default 0,
  data        jsonb,
  primary key (user_id, id)
);

create index if not exists sync_records_pull_idx
  on sync_records (user_id, updated_at);

-- Row Level Security: each user only ever sees and writes their own rows.
alter table sync_records enable row level security;

drop policy if exists "owner_select" on sync_records;
drop policy if exists "owner_modify" on sync_records;

create policy "owner_select" on sync_records
  for select using (auth.uid() = user_id);

create policy "owner_modify" on sync_records
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- NOTE: session photos (Blobs) are not synced yet. Store them in a Supabase
-- Storage bucket keyed by session id when you implement photo sync.
