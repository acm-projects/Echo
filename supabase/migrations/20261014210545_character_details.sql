-- =============================================================================
-- Migration: character_details
--
--   1. characters: role, portrait_path, first_appearance_chapter_index
--   2. character_relationships   who is connected to whom, revealed at a chapter
--   3. story_events              plot events by chapter
--   4. story_event_characters    which characters are involved in each event (M:N)
--   5. RLS: reads follow can_read_book(book_id); only the server writes
--
-- Spoiler-safe character descriptions already live in summaries
-- (summary_type = 'character'), so nothing is added for them here.
-- Chapter numbers are 0-based chapter_index values, comparable between copies
-- made from the same catalog file.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. New columns on characters
-- -----------------------------------------------------------------------------
create type character_role as enum ('protagonist', 'antagonist', 'supporting', 'minor');

alter table public.characters
  add column role                           character_role,   -- null until the LLM has classified them
  add column portrait_path                  text,             -- S3 path of the profile picture
  add column first_appearance_chapter_index integer
    check (first_appearance_chapter_index >= 0);              -- hide the character until this chapter

create index idx_characters_role on public.characters (book_id, role)
  where role is not null;
create index idx_characters_first_appearance on public.characters (book_id, first_appearance_chapter_index)
  where first_appearance_chapter_index is not null;

-- Only the server sets role / portrait / first appearance. Book owners keep the
-- ability to edit voices and profile text (the "owner edits characters" policy),
-- but not these three spoiler-related columns.
revoke update on public.characters from anon, authenticated;
grant update (
  name, aliases, gender, summary,
  voice_id, voice_name, voice_description, voice_sample_path, voice_settings,
  narration_voice_id, narration_voice_settings
) on public.characters to authenticated;

-- -----------------------------------------------------------------------------
-- 2. CHARACTER_RELATIONSHIPS
-- -----------------------------------------------------------------------------
create table public.character_relationships (
  id                        uuid primary key default gen_random_uuid(),
  book_id                   uuid not null references public.books (id) on delete cascade,
  character_a_id            uuid not null,
  character_b_id            uuid not null,

  label                     text not null check (char_length(label) between 1 and 100),  -- e.g. 'mentor of', 'sibling'
  description               text,

  -- Chapter where this relationship becomes known. Null = known from the start.
  revealed_in_chapter_index integer check (revealed_in_chapter_index >= 0),

  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint character_relationships_not_self check (character_a_id <> character_b_id),

  -- Both characters must belong to the SAME book as the relationship
  constraint character_relationships_a_fk
    foreign key (character_a_id, book_id)
    references public.characters (id, book_id) on delete cascade,
  constraint character_relationships_b_fk
    foreign key (character_b_id, book_id)
    references public.characters (id, book_id) on delete cascade
);

-- The same pair can't have the same label twice, in either order
create unique index uq_character_relationship_pair_label
  on public.character_relationships
  (book_id, least(character_a_id, character_b_id), greatest(character_a_id, character_b_id), lower(label));

create index idx_char_rel_book      on public.character_relationships (book_id, revealed_in_chapter_index);
create index idx_char_rel_a         on public.character_relationships (character_a_id);
create index idx_char_rel_b         on public.character_relationships (character_b_id);

create trigger trg_character_relationships_updated_at
  before update on public.character_relationships
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. STORY_EVENTS
-- -----------------------------------------------------------------------------
create table public.story_events (
  id             uuid primary key default gen_random_uuid(),
  book_id        uuid not null references public.books (id) on delete cascade,

  chapter_index  integer not null check (chapter_index >= 0),
  sort_order     integer not null default 0,                 -- order of events inside a chapter
  title          text not null check (char_length(title) between 1 and 200),
  description    text,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint story_events_id_book_unique unique (id, book_id)
);

create index idx_story_events_book_chapter
  on public.story_events (book_id, chapter_index, sort_order);

create trigger trg_story_events_updated_at
  before update on public.story_events
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 4. STORY_EVENT_CHARACTERS  (M:N: many characters per event, many events per character)
-- -----------------------------------------------------------------------------
create table public.story_event_characters (
  event_id      uuid not null,
  character_id  uuid not null,
  book_id       uuid not null,                               -- keeps both sides in the same book
  created_at    timestamptz not null default now(),

  primary key (event_id, character_id),
  foreign key (event_id,     book_id) references public.story_events (id, book_id) on delete cascade,
  foreign key (character_id, book_id) references public.characters   (id, book_id) on delete cascade
);

create index idx_story_event_characters_character on public.story_event_characters (character_id, event_id);
create index idx_story_event_characters_book      on public.story_event_characters (book_id);

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY: read like characters, server-only writes
-- -----------------------------------------------------------------------------
alter table public.character_relationships enable row level security;
alter table public.story_events            enable row level security;
alter table public.story_event_characters  enable row level security;

create policy "read relationships of readable books"
  on public.character_relationships for select to authenticated
  using (public.can_read_book(book_id));

create policy "read story events of readable books"
  on public.story_events for select to authenticated
  using (public.can_read_book(book_id));

create policy "read event characters of readable books"
  on public.story_event_characters for select to authenticated
  using (public.can_read_book(book_id));

-- No insert/update/delete policies exist, and write privileges are removed as
-- a second lock. The service_role worker bypasses both.
revoke insert, update, delete on public.character_relationships from anon, authenticated;
revoke insert, update, delete on public.story_events            from anon, authenticated;
revoke insert, update, delete on public.story_event_characters  from anon, authenticated;

-- =============================================================================
-- Notes
--  * Spoiler filtering is done by the app: hide a character when
--    first_appearance_chapter_index > the reader's current chapter_index, hide a
--    relationship when revealed_in_chapter_index > it, and hide events from
--    chapters the reader hasn't reached. The reader's position comes from
--    user_progress.chapter_id on their own copy of the book.
--  * New columns added to characters later are NOT editable by clients until you
--    add them to the GRANT UPDATE (...) list above.
-- =============================================================================