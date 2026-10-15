-- =============================================================================
-- Migration: shared_casts
--
-- A "cast" is a voice lineup a user shares for a catalog book: which voice each
-- character should have. Characters live in each user's own copy of a book, so
-- other users apply a cast by matching characters BY NAME.
--
--   shared_casts          one row per shared lineup (book, who shared it, title)
--   shared_cast_voices    one row per character in that lineup (name + voice)
--
-- RLS: signed-in users read all casts; users create, edit and delete only their own.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. SHARED_CASTS
-- -----------------------------------------------------------------------------
create table public.shared_casts (
  id               uuid primary key default gen_random_uuid(),
  catalog_book_id  uuid not null references public.catalog_books (id) on delete cascade,
  user_id          uuid not null default auth.uid()
                     references public.users (id) on delete cascade,

  title            text not null check (char_length(title) between 1 and 200),
  description      text check (char_length(description) <= 2000),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Browse the casts for a book, newest first
create index idx_shared_casts_book on public.shared_casts (catalog_book_id, created_at desc);
-- "My shared casts"
create index idx_shared_casts_user on public.shared_casts (user_id, created_at desc);

create trigger trg_shared_casts_updated_at
  before update on public.shared_casts
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. SHARED_CAST_VOICES
-- -----------------------------------------------------------------------------
create table public.shared_cast_voices (
  id                uuid primary key default gen_random_uuid(),
  cast_id           uuid not null references public.shared_casts (id) on delete cascade,

  -- Matched against the reader's own characters.name (case-insensitive)
  character_name    text not null check (char_length(character_name) between 1 and 200),

  voice_description text,
  voice_settings    jsonb not null default '{}'::jsonb,   -- {"pitch":0.9,"speed":1.0,...}
  voice_sample_path text,                                 -- S3 preview clip

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One entry per character name inside a cast (also serves lookups by cast_id)
create unique index uq_shared_cast_voices_name
  on public.shared_cast_voices (cast_id, lower(character_name));

create trigger trg_shared_cast_voices_updated_at
  before update on public.shared_cast_voices
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Guard: a cast can't be moved to another book or owner, and a voice entry
--    can't be moved to another cast
-- -----------------------------------------------------------------------------
create or replace function public.shared_casts_guard()
returns trigger
language plpgsql
as $$
begin
  if new.user_id <> old.user_id or new.catalog_book_id <> old.catalog_book_id then
    raise exception 'owner and book of a shared cast are immutable';
  end if;
  return new;
end;
$$;

create trigger trg_shared_casts_guard
  before update on public.shared_casts
  for each row execute function public.shared_casts_guard();

create or replace function public.shared_cast_voices_guard()
returns trigger
language plpgsql
as $$
begin
  if new.cast_id <> old.cast_id then
    raise exception 'a voice entry cannot be moved to another cast';
  end if;
  return new;
end;
$$;

create trigger trg_shared_cast_voices_guard
  before update on public.shared_cast_voices
  for each row execute function public.shared_cast_voices_guard();

-- -----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.shared_casts       enable row level security;
alter table public.shared_cast_voices enable row level security;

-- Casts: everyone signed in reads; you manage only your own
create policy "signed-in users read casts"
  on public.shared_casts for select to authenticated using (true);

create policy "create own cast"
  on public.shared_casts for insert to authenticated
  with check (user_id = auth.uid());

create policy "edit own cast"
  on public.shared_casts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "delete own cast"
  on public.shared_casts for delete to authenticated
  using (user_id = auth.uid());

-- Voice entries: everyone signed in reads; you manage entries of casts you own
create policy "signed-in users read cast voices"
  on public.shared_cast_voices for select to authenticated using (true);

create policy "add voices to own cast"
  on public.shared_cast_voices for insert to authenticated
  with check (exists (select 1 from public.shared_casts sc
                       where sc.id = shared_cast_voices.cast_id
                         and sc.user_id = auth.uid()));

create policy "edit voices of own cast"
  on public.shared_cast_voices for update to authenticated
  using (exists (select 1 from public.shared_casts sc
                  where sc.id = shared_cast_voices.cast_id
                    and sc.user_id = auth.uid()))
  with check (exists (select 1 from public.shared_casts sc
                       where sc.id = shared_cast_voices.cast_id
                         and sc.user_id = auth.uid()));

create policy "delete voices of own cast"
  on public.shared_cast_voices for delete to authenticated
  using (exists (select 1 from public.shared_casts sc
                  where sc.id = shared_cast_voices.cast_id
                    and sc.user_id = auth.uid()));

-- =============================================================================
-- Notes
--  * Publish a cast: insert into shared_casts (catalog_book_id, title, description),
--    then insert one shared_cast_voices row per character. user_id fills itself in.
--  * Apply a cast: for each shared_cast_voices row, find the reader's own
--    characters row with lower(name) = lower(character_name) (check aliases too),
--    then copy voice_description / voice_settings into their character and queue a
--    voice_jobs row so the server re-generates that character's lines.
--  * voice_sample_path files live in storage, so other users need read access to
--    them through your storage policies or signed URLs.
--  * Casts hang off the catalog book. A book's room is 1:1 with it, so the room is
--    reachable as book_rooms.catalog_book_id = shared_casts.catalog_book_id.
-- =============================================================================