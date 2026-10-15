-- =============================================================================
-- ECHO — Complete Supabase (PostgreSQL 15+) schema, latest version
--
-- One script for a FRESH database. Do NOT run on a database that already has
-- echo_schema.sql / v2 / v3 applied.
--
-- Contents
--    1. Users, public profiles, friendships
--    2. Books, chapters, characters (voices), chapter_characters (M:N)
--    3. Narration scripts (line types, per-line character, alignment)
--    4. User progress (offline sync), summaries (book / chapter / character)
--    5. Community hub: shared books, reviews and comments
--    6. Reading streaks, daily activity, friends leaderboard
--    7. Row Level Security
--
-- Conventions
--    * UUID primary keys, timestamptz everywhere
--    * Identity comes from Supabase Auth (auth.users); public.users is the profile
--    * The LLM/TTS worker uses the service_role key (bypasses RLS)
--    * Mobile clients use the authenticated key and are governed by RLS
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 0. Extensions & enums
-- -----------------------------------------------------------------------------
create extension if not exists pg_trgm;   -- fuzzy / ILIKE search
create extension if not exists citext;    -- case-insensitive usernames

create type source_file_type    as enum ('pdf', 'epub', 'txt', 'md');
create type processing_status   as enum ('uploaded', 'queued', 'processing', 'ready', 'failed');
create type summary_type        as enum ('book', 'chapter', 'character');
create type publish_status      as enum ('draft', 'published', 'unlisted', 'removed');
create type profile_visibility  as enum ('public', 'friends_only', 'private');
create type friendship_status   as enum ('pending', 'accepted', 'declined', 'blocked');
create type script_line_type    as enum ('narration', 'dialogue', 'thought');
create type narration_style     as enum ('first_person', 'third_person', 'multiple_pov', 'mixed');

-- Shared trigger: keep updated_at fresh
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================================
-- 1. USERS  (profile row, 1:1 with auth.users)
-- =============================================================================
create table public.users (
  id                  uuid primary key references auth.users (id) on delete cascade,
  username            citext not null unique
                        check (username ~ '^[A-Za-z0-9_]{3,30}$'),
  display_name        text   check (char_length(display_name) <= 80),
  avatar_url          text,
  bio                 text   check (char_length(bio) <= 500),
  profile_visibility  profile_visibility not null default 'public',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

comment on table public.users is
  'Public profile for each Supabase Auth user. Email/phone live in auth.users.';

create index idx_users_username_trgm     on public.users using gin ((username::text) gin_trgm_ops);
create index idx_users_display_name_trgm on public.users using gin (display_name gin_trgm_ops);

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- Auto-create a profile when someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_name text;
begin
  base_name := regexp_replace(
                 coalesce(new.raw_user_meta_data ->> 'username',
                          split_part(new.email, '@', 1),
                          'user'),
                 '[^A-Za-z0-9_]', '', 'g');
  if char_length(base_name) < 3 then base_name := 'user' || base_name; end if;

  insert into public.users (id, username, display_name, avatar_url)
  values (
    new.id,
    left(base_name, 21) || '_' || substr(replace(new.id::text, '-', ''), 1, 6),
    coalesce(new.raw_user_meta_data ->> 'display_name', base_name),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- 2. BOOKS
-- =============================================================================
create table public.books (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.users (id) on delete cascade,

  title               text not null check (char_length(title) between 1 and 500),
  author              text check (char_length(author) <= 300),
  description         text,
  language            text not null default 'en',          -- BCP-47 tag

  -- Original upload (S3 / Supabase Storage)
  source_file_path    text not null,
  source_file_type    source_file_type not null,
  source_file_size_bytes bigint check (source_file_size_bytes >= 0),
  cover_image_path    text,

  -- Pipeline state (written by the worker)
  status              processing_status not null default 'uploaded',
  processing_error    text,
  processing_started_at  timestamptz,
  processing_finished_at timestamptz,

  -- Aggregates (set by worker when finished)
  total_chapters      integer not null default 0 check (total_chapters >= 0),
  total_duration_ms   bigint  not null default 0 check (total_duration_ms >= 0),
  model_info          jsonb not null default '{}'::jsonb,  -- LLM/TTS versions used

  -- Narration modelling
  narration_style     narration_style,                     -- null until the LLM has analysed the book
  default_narrator_id uuid,                                -- FK added after characters exists

  -- Lets community_books / characters / chapters prove "same book"
  constraint books_id_user_unique unique (id, user_id),

  search_vector       tsvector generated always as (
                        to_tsvector('simple',
                          coalesce(title, '') || ' ' || coalesce(author, ''))
                      ) stored,

  deleted_at          timestamptz,                         -- soft delete
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_books_user_created   on public.books (user_id, created_at desc)
  where deleted_at is null;
create index idx_books_status         on public.books (status)
  where status in ('queued', 'processing');
create index idx_books_search_vector  on public.books using gin (search_vector);
create index idx_books_title_trgm     on public.books using gin (title gin_trgm_ops);

create trigger trg_books_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 3. CHAPTERS
-- =============================================================================
create table public.chapters (
  id                    uuid primary key default gen_random_uuid(),
  book_id               uuid not null references public.books (id) on delete cascade,

  chapter_index         integer not null check (chapter_index >= 0),   -- 0-based order
  title                 text,
  word_count            integer check (word_count >= 0),

  -- Per-chapter narrator override (FK added after characters exists).
  -- Null = use books.default_narrator_id
  narrator_character_id uuid,

  -- Compiled, voice-acted audio
  audio_s3_url          text,
  audio_duration_ms     integer check (audio_duration_ms >= 0),
  audio_size_bytes      bigint  check (audio_size_bytes >= 0),
  audio_format          text default 'mp3',

  status                processing_status not null default 'queued',
  processing_error      text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint chapters_book_index_unique unique (book_id, chapter_index),
  constraint chapters_id_book_unique    unique (id, book_id)
);

create index idx_chapters_status on public.chapters (status)
  where status in ('queued', 'processing');

create trigger trg_chapters_updated_at
  before update on public.chapters
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 4. CHARACTERS  (cast + voices)
-- =============================================================================
create table public.characters (
  id              uuid primary key default gen_random_uuid(),
  book_id         uuid not null references public.books (id) on delete cascade,

  name            text not null check (char_length(name) between 1 and 200),
  aliases         text[] not null default '{}',     -- nicknames, for LLM de-duplication
  gender          text check (gender in ('female', 'male', 'neutral', 'unknown')),

  -- True if this character narrates some or all of the book. Many allowed per book.
  is_narrator     boolean not null default false,

  -- Full character profile (LLM context, shown to the owner).
  -- Spoiler-gated versions live in public.summaries.
  summary         text,

  -- Voice used for dialogue (and for everything, unless narration_voice_* is set)
  voice_id           text,
  voice_name         text,
  voice_description  text,
  voice_sample_path  text,                                     -- S3 preview clip
  voice_settings     jsonb not null default '{}'::jsonb,       -- {"pitch":0.9,"speed":1.0,...}

  -- Optional separate voice for narration/thought lines when this character narrates
  narration_voice_id       text,
  narration_voice_settings jsonb not null default '{}'::jsonb,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint characters_id_book_unique unique (id, book_id)
);

create unique index uq_characters_book_name on public.characters (book_id, lower(name));
create index idx_characters_book      on public.characters (book_id);
create index idx_characters_aliases   on public.characters using gin (aliases);
create index idx_characters_name_trgm on public.characters using gin (name gin_trgm_ops);

create trigger trg_characters_updated_at
  before update on public.characters
  for each row execute function public.set_updated_at();

-- Narrator links. Composite FKs prove the narrator belongs to the SAME book;
-- SET NULL is limited to the narrator column so book_id/id is never nulled.
alter table public.books
  add constraint books_default_narrator_fk
  foreign key (default_narrator_id, id)
  references public.characters (id, book_id)
  on delete set null (default_narrator_id);

alter table public.chapters
  add constraint chapters_narrator_fk
  foreign key (narrator_character_id, book_id)
  references public.characters (id, book_id)
  on delete set null (narrator_character_id);

create index idx_books_default_narrator on public.books (default_narrator_id)
  where default_narrator_id is not null;
create index idx_chapters_narrator on public.chapters (narrator_character_id)
  where narrator_character_id is not null;

-- Resolved narrator per chapter: chapter override, else the book default
create view public.chapters_with_narrator
with (security_invoker = true) as
select c.*,
       coalesce(c.narrator_character_id, b.default_narrator_id) as effective_narrator_id
  from public.chapters c
  join public.books b on b.id = c.book_id;

-- -----------------------------------------------------------------------------
-- CHAPTER_CHARACTERS  (M:N junction)
-- -----------------------------------------------------------------------------
create table public.chapter_characters (
  chapter_id    uuid not null,
  character_id  uuid not null,
  book_id       uuid not null,                       -- guarantees both sides belong to the same book
  line_count    integer not null default 0 check (line_count >= 0),
  created_at    timestamptz not null default now(),

  primary key (chapter_id, character_id),
  foreign key (chapter_id,   book_id) references public.chapters   (id, book_id) on delete cascade,
  foreign key (character_id, book_id) references public.characters (id, book_id) on delete cascade
);

create index idx_chapter_characters_character on public.chapter_characters (character_id, chapter_id);
create index idx_chapter_characters_book      on public.chapter_characters (book_id);

-- =============================================================================
-- 5. NARRATION_SCRIPTS  (one row per spoken line)
-- =============================================================================
create table public.narration_scripts (
  id              uuid primary key default gen_random_uuid(),
  chapter_id      uuid not null references public.chapters (id) on delete cascade,
  character_id    uuid references public.characters (id) on delete set null,

  line_index      integer not null check (line_index >= 0),
  line_type       script_line_type not null default 'narration',
  speaker_name    text not null,                      -- snapshot of the name at generation time
  text_content    text not null,
  emotional_tone  text,

  -- Position inside the chapter's source text (for highlight/seek)
  source_char_start integer check (source_char_start >= 0),
  source_char_end   integer check (source_char_end >= source_char_start),

  -- Position inside the compiled chapter audio
  start_ms        integer check (start_ms >= 0),
  end_ms          integer check (end_ms >= start_ms),

  -- Fine-grained text tracking, e.g.
  -- {"unit":"word","items":[{"t":"Hello","s":0,"e":5,"start_ms":0,"end_ms":420}, ...]}
  alignment       jsonb not null default '{}'::jsonb,

  created_at      timestamptz not null default now(),

  constraint narration_scripts_chapter_line_unique unique (chapter_id, line_index)
);

create index idx_scripts_chapter_speaker on public.narration_scripts (chapter_id, speaker_name);
create index idx_scripts_chapter_time    on public.narration_scripts (chapter_id, start_ms);
create index idx_scripts_chapter_type    on public.narration_scripts (chapter_id, line_type);
create index idx_scripts_character       on public.narration_scripts (character_id)
  where character_id is not null;
create index idx_scripts_text_fts        on public.narration_scripts
  using gin (to_tsvector('simple', text_content));

-- =============================================================================
-- 6. USER_PROGRESS  (cross-device resume position; last-write-wins)
-- =============================================================================
create table public.user_progress (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users (id)    on delete cascade,
  book_id            uuid not null references public.books (id)    on delete cascade,
  chapter_id         uuid          references public.chapters (id) on delete set null,

  position_ms        integer not null default 0 check (position_ms >= 0),
  playback_speed     numeric(3,2) not null default 1.00 check (playback_speed between 0.25 and 4.00),
  is_completed       boolean not null default false,

  device_id          text,
  client_updated_at  timestamptz not null default now(),    -- device timestamp (offline-safe)
  updated_at         timestamptz not null default now(),    -- server timestamp (delta-sync cursor)

  constraint user_progress_user_book_unique unique (user_id, book_id)
);

create index idx_progress_user_updated on public.user_progress (user_id, updated_at desc);
create index idx_progress_chapter      on public.user_progress (chapter_id);

create trigger trg_user_progress_updated_at
  before update on public.user_progress
  for each row execute function public.set_updated_at();

-- Conflict-safe upsert: only overwrites if the incoming write is newer.
--   supabase.rpc('upsert_progress', {...})
create or replace function public.upsert_progress(
  p_book_id           uuid,
  p_chapter_id        uuid,
  p_position_ms       integer,
  p_client_updated_at timestamptz,
  p_device_id         text default null,
  p_playback_speed    numeric default 1.00,
  p_is_completed      boolean default false
)
returns public.user_progress
language plpgsql
security invoker                 -- RLS still applies
as $$
declare
  result public.user_progress;
begin
  insert into public.user_progress as up
    (user_id, book_id, chapter_id, position_ms, playback_speed,
     is_completed, device_id, client_updated_at)
  values
    (auth.uid(), p_book_id, p_chapter_id, p_position_ms, p_playback_speed,
     p_is_completed, p_device_id, p_client_updated_at)
  on conflict (user_id, book_id) do update
    set chapter_id        = excluded.chapter_id,
        position_ms       = excluded.position_ms,
        playback_speed    = excluded.playback_speed,
        is_completed      = excluded.is_completed,
        device_id         = excluded.device_id,
        client_updated_at = excluded.client_updated_at
    where up.client_updated_at < excluded.client_updated_at
  returning * into result;

  -- Lost the race: return the existing (newer) row instead
  if result.id is null then
    select * into result from public.user_progress
     where user_id = auth.uid() and book_id = p_book_id;
  end if;

  return result;
end;
$$;

-- =============================================================================
-- 7. SUMMARIES  (spoiler-free book / chapter / character summaries)
-- =============================================================================
create table public.summaries (
  id                uuid primary key default gen_random_uuid(),
  book_id           uuid not null references public.books (id)    on delete cascade,
  chapter_id        uuid          references public.chapters (id) on delete cascade,
  character_id      uuid,                                   -- only for 'character' summaries

  summary_type      summary_type not null,
  content           text not null,

  -- Spoiler safety: uses info only up to and including this chapter
  spoiler_free_through_chapter_index integer check (spoiler_free_through_chapter_index >= 0),

  model_info        jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  -- A character summary must point at a character of the SAME book
  -- (MATCH SIMPLE: not enforced when character_id is null).
  constraint summaries_character_book_fk
    foreign key (character_id, book_id)
    references public.characters (id, book_id) on delete cascade,

  constraint summaries_shape_check check (
    (summary_type = 'book'      and chapter_id is null     and character_id is null) or
    (summary_type = 'chapter'   and chapter_id is not null and character_id is null) or
    (summary_type = 'character' and character_id is not null)
  )
);

create unique index uq_summary_book      on public.summaries (book_id)
  where summary_type = 'book';
create unique index uq_summary_chapter   on public.summaries (chapter_id)
  where summary_type = 'chapter';
create unique index uq_summary_character on public.summaries
  (character_id, coalesce(spoiler_free_through_chapter_index, -1))
  where summary_type = 'character';

create index idx_summaries_book_type on public.summaries (book_id, summary_type);
create index idx_summaries_chapter   on public.summaries (chapter_id)   where chapter_id is not null;
create index idx_summaries_character on public.summaries (character_id) where character_id is not null;

create trigger trg_summaries_updated_at
  before update on public.summaries
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 8. COMMUNITY_BOOKS  (public sharing hub)
-- =============================================================================
create table public.community_books (
  id              uuid primary key default gen_random_uuid(),
  book_id         uuid not null,
  user_id         uuid not null,                            -- publisher (must own the book)

  title           text not null check (char_length(title) between 1 and 500),
  description     text,
  tags            text[] not null default '{}',
  language        text not null default 'en',

  status          publish_status not null default 'published',
  published_at    timestamptz not null default now(),

  -- Denormalised counters (maintained by triggers / worker)
  play_count      bigint  not null default 0 check (play_count >= 0),
  save_count      bigint  not null default 0 check (save_count >= 0),
  rating_avg      numeric(3,2) not null default 0 check (rating_avg between 0 and 5),
  rating_count    integer not null default 0 check (rating_count >= 0),
  review_count    integer not null default 0 check (review_count >= 0),

  search_vector   tsvector generated always as (
                    to_tsvector('simple',
                      coalesce(title, '') || ' ' || coalesce(description, ''))
                  ) stored,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint community_books_book_unique unique (book_id),
  -- Composite FK guarantees publisher == book owner
  constraint community_books_book_owner_fk
    foreign key (book_id, user_id) references public.books (id, user_id) on delete cascade,
  constraint community_books_user_fk
    foreign key (user_id) references public.users (id) on delete cascade
);

create index idx_community_feed_new     on public.community_books (published_at desc)
  where status = 'published';
create index idx_community_feed_top     on public.community_books (rating_avg desc, rating_count desc)
  where status = 'published';
create index idx_community_feed_popular on public.community_books (play_count desc)
  where status = 'published';
create index idx_community_user         on public.community_books (user_id);
create index idx_community_tags         on public.community_books using gin (tags);
create index idx_community_search       on public.community_books using gin (search_vector);
create index idx_community_title_trgm   on public.community_books using gin (title gin_trgm_ops);

create trigger trg_community_books_updated_at
  before update on public.community_books
  for each row execute function public.set_updated_at();

-- =============================================================================
-- 9. REVIEWS_COMMENTS  (ratings, reviews, threaded comments)
-- =============================================================================
create table public.reviews_comments (
  id                 uuid primary key default gen_random_uuid(),
  community_book_id  uuid not null references public.community_books (id) on delete cascade,
  user_id            uuid not null references public.users (id)           on delete cascade,
  parent_id          uuid references public.reviews_comments (id)         on delete cascade,

  rating             smallint check (rating between 1 and 5),   -- top-level only
  title              text check (char_length(title) <= 150),
  body               text check (char_length(body) between 1 and 5000),

  is_edited          boolean not null default false,
  deleted_at         timestamptz,                               -- soft delete keeps threads intact
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint reviews_reply_no_rating check (parent_id is null or rating is null),
  constraint reviews_has_content     check (rating is not null or body is not null)
);

-- One star rating per user per audiobook
create unique index uq_one_rating_per_user
  on public.reviews_comments (community_book_id, user_id)
  where parent_id is null and rating is not null;

create index idx_reviews_book_created on public.reviews_comments (community_book_id, created_at desc)
  where deleted_at is null;
create index idx_reviews_parent       on public.reviews_comments (parent_id) where parent_id is not null;
create index idx_reviews_user         on public.reviews_comments (user_id);

create trigger trg_reviews_updated_at
  before update on public.reviews_comments
  for each row execute function public.set_updated_at();

-- Keep community_books rating/review counters in sync
create or replace function public.refresh_community_book_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  for target in
    select distinct x from unnest(array[
      case when tg_op in ('UPDATE','DELETE') then old.community_book_id end,
      case when tg_op in ('INSERT','UPDATE') then new.community_book_id end
    ]) as x where x is not null
  loop
    update public.community_books cb
       set rating_avg   = coalesce(s.avg_rating, 0),
           rating_count = s.rating_cnt,
           review_count = s.review_cnt
      from (
        select round(avg(rating)::numeric, 2)                                  as avg_rating,
               count(*) filter (where rating is not null)                      as rating_cnt,
               count(*) filter (where parent_id is null and body is not null)  as review_cnt
          from public.reviews_comments
         where community_book_id = target and deleted_at is null
      ) s
     where cb.id = target;
  end loop;
  return null;
end;
$$;

create trigger trg_reviews_stats
  after insert or update or delete on public.reviews_comments
  for each row execute function public.refresh_community_book_stats();

-- =============================================================================
-- 10. FRIENDSHIPS
--     One row per pair, regardless of who asked. requester -> addressee.
-- =============================================================================
create table public.friendships (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references public.users (id) on delete cascade,
  addressee_id  uuid not null references public.users (id) on delete cascade,
  status        friendship_status not null default 'pending',
  blocked_by    uuid references public.users (id) on delete cascade,
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  updated_at    timestamptz not null default now(),

  constraint friendships_no_self check (requester_id <> addressee_id),
  constraint friendships_blocked_by_check
    check ((status = 'blocked') = (blocked_by is not null))
);

-- Prevent duplicate / reversed duplicate pairs (A->B and B->A)
create unique index uq_friendship_pair on public.friendships
  (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index idx_friendships_addressee on public.friendships (addressee_id, status);
create index idx_friendships_requester on public.friendships (requester_id, status);

create or replace function public.friendships_guard()
returns trigger
language plpgsql
as $$
begin
  if new.requester_id <> old.requester_id or new.addressee_id <> old.addressee_id then
    raise exception 'friendship parties are immutable';
  end if;

  -- Legal status transitions for end users (service_role has auth.uid() = null)
  if new.status is distinct from old.status and auth.uid() is not null then
    if new.status = 'blocked' then
      new.blocked_by := auth.uid();
    elsif old.status = 'pending' and new.status in ('accepted', 'declined') then
      if auth.uid() <> old.addressee_id then
        raise exception 'only the recipient can respond to a friend request';
      end if;
    else
      raise exception 'invalid friendship status transition: % -> %', old.status, new.status;
    end if;
  end if;

  if new.status is distinct from old.status then
    new.responded_at := now();
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_friendships_guard
  before update on public.friendships
  for each row execute function public.friendships_guard();

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.friendships f
     where f.status = 'accepted'
       and ((f.requester_id = a and f.addressee_id = b)
         or (f.requester_id = b and f.addressee_id = a))
  );
$$;

-- Can the signed-in user see this person's streaks / activity?
create or replace function public.can_view_profile_stats(p_user uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_user = auth.uid()
      or (
        exists (
          select 1 from public.users u
           where u.id = p_user
             and (u.profile_visibility = 'public'
                  or (u.profile_visibility = 'friends_only'
                      and public.are_friends(p_user, auth.uid())))
        )
        and not exists (
          select 1 from public.friendships f
           where f.status = 'blocked'
             and ((f.requester_id = p_user and f.addressee_id = auth.uid())
               or (f.requester_id = auth.uid() and f.addressee_id = p_user))
        )
      );
$$;

-- =============================================================================
-- 11. STREAKS & READING ACTIVITY
-- =============================================================================
create table public.user_streaks (
  user_id              uuid primary key references public.users (id) on delete cascade,
  current_streak       integer not null default 0 check (current_streak >= 0),
  longest_streak       integer not null default 0 check (longest_streak >= 0),
  last_goal_met_date   date,                                  -- in the user's own timezone
  streak_freezes       smallint not null default 0 check (streak_freezes between 0 and 2),
  daily_goal_seconds   integer  not null default 600
                         check (daily_goal_seconds between 60 and 14400),   -- 1 min .. 4 h
  timezone             text not null default 'UTC',
  total_listen_seconds bigint not null default 0 check (total_listen_seconds >= 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger trg_user_streaks_updated_at
  before update on public.user_streaks
  for each row execute function public.set_updated_at();

-- Reject invalid IANA timezone names
create or replace function public.validate_streak_timezone()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' or new.timezone is distinct from old.timezone)
     and not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'invalid timezone: %', new.timezone;
  end if;
  return new;
end;
$$;

create trigger trg_user_streaks_tz
  before insert or update on public.user_streaks
  for each row execute function public.validate_streak_timezone();

-- Every profile gets a streak row automatically
create or replace function public.handle_new_profile_streak()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.user_streaks (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger trg_users_create_streak
  after insert on public.users
  for each row execute function public.handle_new_profile_streak();

-- Daily activity log (one row per user per local day)
create table public.reading_activity (
  user_id             uuid not null references public.users (id) on delete cascade,
  activity_date       date not null,                          -- user's local date
  listened_seconds    integer not null default 0 check (listened_seconds >= 0),
  chapters_completed  integer not null default 0 check (chapters_completed >= 0),
  goal_met            boolean not null default false,
  -- XP: 1 per minute listened, 10 per chapter finished, +5 for hitting the daily goal
  xp_earned           integer generated always as (
                        listened_seconds / 60
                        + 10 * chapters_completed
                        + case when goal_met then 5 else 0 end
                      ) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  primary key (user_id, activity_date)
);

create index idx_reading_activity_date_xp on public.reading_activity (activity_date, xp_earned desc);

create trigger trg_reading_activity_updated_at
  before update on public.reading_activity
  for each row execute function public.set_updated_at();

-- A streak is "alive" if the goal was met yesterday/today, or exactly one day
-- was missed and a freeze is banked.
create or replace function public.live_streak(
  p_current integer, p_last date, p_freezes integer, p_tz text)
returns integer
language sql stable
as $$
  select case
    when p_last is null then 0
    when ((now() at time zone p_tz)::date - p_last) <= 1 then p_current
    when ((now() at time zone p_tz)::date - p_last) = 2 and p_freezes > 0 then p_current
    else 0
  end;
$$;

create view public.user_streaks_live
with (security_invoker = true) as
select us.*,
       public.live_streak(us.current_streak, us.last_goal_met_date,
                          us.streak_freezes, us.timezone) as live_streak
  from public.user_streaks us;

-- Report listening time; all streak/XP math is server-side.
--   supabase.rpc('record_listening', { p_seconds: 120, p_chapters_completed: 0 })
create or replace function public.record_listening(
  p_seconds            integer,
  p_chapters_completed integer default 0)
returns public.user_streaks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  s       public.user_streaks;
  act     public.reading_activity;
  v_today date;
  v_gap   integer;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;
  if p_seconds < 0 or p_seconds > 7200
     or p_chapters_completed < 0 or p_chapters_completed > 5 then
    raise exception 'invalid listening report';
  end if;

  insert into public.user_streaks (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into s from public.user_streaks where user_id = v_uid for update;

  v_today := (now() at time zone s.timezone)::date;

  insert into public.reading_activity as ra
    (user_id, activity_date, listened_seconds, chapters_completed)
  values (v_uid, v_today, p_seconds, p_chapters_completed)
  on conflict (user_id, activity_date) do update
    set listened_seconds   = ra.listened_seconds   + excluded.listened_seconds,
        chapters_completed = ra.chapters_completed + excluded.chapters_completed
  returning * into act;

  if not act.goal_met and act.listened_seconds >= s.daily_goal_seconds then
    update public.reading_activity
       set goal_met = true
     where user_id = v_uid and activity_date = v_today;

    v_gap := case when s.last_goal_met_date is null then null
                  else v_today - s.last_goal_met_date end;

    if v_gap = 1 then
      s.current_streak := s.current_streak + 1;
    elsif v_gap = 2 and s.streak_freezes > 0 then
      s.current_streak := s.current_streak + 1;       -- freeze covers the missed day
      s.streak_freezes := s.streak_freezes - 1;
    elsif v_gap is not null and v_gap < 1 then
      null;                                            -- timezone-change edge case: leave streak alone
    else
      s.current_streak := 1;                           -- first ever, or streak broken
    end if;

    -- Earn a streak freeze every 7 days (max 2 banked)
    if s.current_streak > 0 and s.current_streak % 7 = 0 then
      s.streak_freezes := least(s.streak_freezes + 1, 2);
    end if;

    update public.user_streaks
       set current_streak       = s.current_streak,
           longest_streak       = greatest(longest_streak, s.current_streak),
           streak_freezes       = s.streak_freezes,
           last_goal_met_date   = v_today,
           total_listen_seconds = total_listen_seconds + p_seconds
     where user_id = v_uid;
  else
    update public.user_streaks
       set total_listen_seconds = total_listen_seconds + p_seconds
     where user_id = v_uid;
  end if;

  select * into s from public.user_streaks where user_id = v_uid;
  return s;
end;
$$;

-- Friends leaderboard (you + accepted friends who aren't 'private')
--   supabase.rpc('friends_leaderboard', { p_start: '2026-10-05', p_end: '2026-10-11' })
create or replace function public.friends_leaderboard(p_start date, p_end date)
returns table (
  user_id          uuid,
  username         citext,
  display_name     text,
  avatar_url       text,
  xp               bigint,
  listened_seconds bigint,
  live_streak      integer,
  rank             bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with circle as (
    select auth.uid() as uid
    union
    select case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
      from public.friendships f
     where f.status = 'accepted'
       and auth.uid() in (f.requester_id, f.addressee_id)
  )
  select u.id,
         u.username,
         u.display_name,
         u.avatar_url,
         coalesce(sum(ra.xp_earned), 0)::bigint,
         coalesce(sum(ra.listened_seconds), 0)::bigint,
         public.live_streak(us.current_streak, us.last_goal_met_date, us.streak_freezes, us.timezone),
         rank() over (order by coalesce(sum(ra.xp_earned), 0) desc)
    from circle c
    join public.users u on u.id = c.uid
    left join public.user_streaks us on us.user_id = u.id
    left join public.reading_activity ra
           on ra.user_id = u.id and ra.activity_date between p_start and p_end
   where u.id = auth.uid() or u.profile_visibility <> 'private'
   group by u.id, u.username, u.display_name, u.avatar_url,
            us.current_streak, us.last_goal_met_date, us.streak_freezes, us.timezone
   order by 5 desc, u.username;
$$;

-- =============================================================================
-- 12. ROW LEVEL SECURITY
-- =============================================================================
alter table public.users              enable row level security;
alter table public.books              enable row level security;
alter table public.chapters           enable row level security;
alter table public.characters         enable row level security;
alter table public.chapter_characters enable row level security;
alter table public.narration_scripts  enable row level security;
alter table public.user_progress      enable row level security;
alter table public.summaries          enable row level security;
alter table public.community_books    enable row level security;
alter table public.reviews_comments   enable row level security;
alter table public.friendships        enable row level security;
alter table public.user_streaks       enable row level security;
alter table public.reading_activity   enable row level security;

-- Helper: can the current user read this book (owner or publicly published)?
create or replace function public.can_read_book(p_book_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.books b
     where b.id = p_book_id and b.user_id = auth.uid() and b.deleted_at is null
  ) or exists (
    select 1 from public.community_books cb
     where cb.book_id = p_book_id and cb.status in ('published', 'unlisted')
  );
$$;

-- ---- users ------------------------------------------------------------------
create policy "profiles are viewable by signed-in users"
  on public.users for select to authenticated using (true);
create policy "users update own profile"
  on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---- books ------------------------------------------------------------------
create policy "owner or public reads books"
  on public.books for select to authenticated using (public.can_read_book(id));
create policy "owner inserts books"
  on public.books for insert to authenticated with check (user_id = auth.uid());
create policy "owner updates books"
  on public.books for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner deletes books"
  on public.books for delete to authenticated using (user_id = auth.uid());

-- ---- chapters / characters / chapter_characters / scripts / summaries -------
-- Reads follow book access; writes are done by the service_role worker,
-- except owners may edit their characters (re-cast voices).
create policy "read chapters of readable books"
  on public.chapters for select to authenticated using (public.can_read_book(book_id));

create policy "read characters of readable books"
  on public.characters for select to authenticated using (public.can_read_book(book_id));
create policy "owner edits characters"
  on public.characters for update to authenticated
  using (exists (select 1 from public.books b where b.id = characters.book_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.books b where b.id = characters.book_id and b.user_id = auth.uid()));

create policy "read chapter_characters of readable books"
  on public.chapter_characters for select to authenticated using (public.can_read_book(book_id));

create policy "read scripts of readable chapters"
  on public.narration_scripts for select to authenticated
  using (exists (select 1 from public.chapters c
                  where c.id = narration_scripts.chapter_id
                    and public.can_read_book(c.book_id)));

create policy "read summaries of readable books"
  on public.summaries for select to authenticated using (public.can_read_book(book_id));

-- ---- user_progress (strictly private) ---------------------------------------
create policy "own progress select" on public.user_progress
  for select to authenticated using (user_id = auth.uid());
create policy "own progress insert" on public.user_progress
  for insert to authenticated with check (user_id = auth.uid() and public.can_read_book(book_id));
create policy "own progress update" on public.user_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own progress delete" on public.user_progress
  for delete to authenticated using (user_id = auth.uid());

-- ---- community_books --------------------------------------------------------
create policy "public feed readable"
  on public.community_books for select to authenticated
  using (status in ('published', 'unlisted') or user_id = auth.uid());
create policy "owner publishes"
  on public.community_books for insert to authenticated with check (user_id = auth.uid());
create policy "owner edits listing"
  on public.community_books for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "owner unpublishes"
  on public.community_books for delete to authenticated using (user_id = auth.uid());

-- ---- reviews_comments -------------------------------------------------------
create policy "reviews readable on visible listings"
  on public.reviews_comments for select to authenticated
  using (deleted_at is null or user_id = auth.uid());
create policy "own review insert"
  on public.reviews_comments for insert to authenticated with check (user_id = auth.uid());
create policy "own review update"
  on public.reviews_comments for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own review delete"
  on public.reviews_comments for delete to authenticated using (user_id = auth.uid());

-- ---- friendships ------------------------------------------------------------
create policy "see own friendships"
  on public.friendships for select to authenticated
  using (auth.uid() in (requester_id, addressee_id));
create policy "send friend request"
  on public.friendships for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending');
-- Legal transitions are enforced by trg_friendships_guard
create policy "respond to or block"
  on public.friendships for update to authenticated
  using (auth.uid() in (requester_id, addressee_id))
  with check (auth.uid() in (requester_id, addressee_id));
-- Unfriend / cancel request; only the blocker can lift a block
create policy "unfriend or cancel"
  on public.friendships for delete to authenticated
  using (auth.uid() in (requester_id, addressee_id)
         and (status <> 'blocked' or blocked_by = auth.uid()));

-- ---- streaks & activity (read per profile visibility, write via RPC only) ---
create policy "view streaks per profile visibility"
  on public.user_streaks for select to authenticated
  using (public.can_view_profile_stats(user_id));
create policy "edit own streak settings"
  on public.user_streaks for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "view activity per profile visibility"
  on public.reading_activity for select to authenticated
  using (public.can_view_profile_stats(user_id));

-- Clients may only change goal + timezone; everything else goes through record_listening()
revoke insert, update, delete on public.user_streaks     from anon, authenticated;
grant  update (daily_goal_seconds, timezone) on public.user_streaks to authenticated;
revoke insert, update, delete on public.reading_activity from anon, authenticated;

commit;

-- =============================================================================
-- Notes
--  * Worker flow after the LLM pass:
--      1. insert into characters (name, voice_id, summary, is_narrator, ...)
--      2. set books.narration_style and books.default_narrator_id
--      3. insert into chapter_characters (chapter_id, character_id, book_id, line_count)
--      4. insert into narration_scripts (..., character_id, line_type)
--      5. set chapters.narrator_character_id for multi-POV / mixed books
--  * Narration styles
--      third_person  one narrator character; narration lines -> narrator, speech -> speaker
--      first_person  protagonist is the narrator; narration and dialogue share a
--                    character_id and differ by line_type (optional narration_voice_*)
--      multiple_pov  several is_narrator characters; set chapters.narrator_character_id
--      mixed         per-chapter overrides; others fall back to the book default
--  * Not enforced in SQL: that a narrator has is_narrator = true, and that a script
--    line's character_id belongs to the same book as its chapter (worker-side checks).
--  * Storage: add Supabase Storage / S3 policies separately so published books'
--    audio and covers are readable by others (e.g. signed URLs after can_read_book()).
--  * Sync: pull progress changes with
--      select * from user_progress where updated_at > :last_sync_cursor;
--  * play_count / save_count should be incremented by an RPC or Edge Function.
--  * Read user_streaks_live.live_streak in the app so lapsed streaks display as 0.
--  * For stronger anti-cheat, call record_listening() from an Edge Function that
--    derives seconds from user_progress deltas.
-- =============================================================================