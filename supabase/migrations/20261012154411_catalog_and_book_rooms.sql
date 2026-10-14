-- =============================================================================
-- Migration: catalog_and_book_rooms
--
--   1. catalog_books        "the same book" across users (server-written, read by all)
--   2. books.catalog_book_id links each user's private copy to its catalog entry
--   3. book_rooms           one discussion room per catalog book (auto-created)
--   4. room_posts           threaded posts, optional chapter tag, soft delete
--   5. my_catalog_chapter_index() + room_posts_visible view  (spoiler hiding)
--   6. RLS
--
-- Users still own their own copy of every book (chapters, characters, voices).
-- The catalog only LINKS copies; it never shares them.
-- Requires PostgreSQL 15+ (already required by earlier migrations).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CATALOG_BOOKS
-- -----------------------------------------------------------------------------
create table public.catalog_books (
  id                uuid primary key default gen_random_uuid(),

  title             text not null check (char_length(title) between 1 and 500),
  author            text check (char_length(author) <= 300),
  description       text,
  cover_image_path  text,
  language          text not null default 'en',               -- BCP-47 tag
  is_public_domain  boolean not null default false,

  -- Where the book came from, e.g. source = 'gutenberg', source_id = '1342'
  source            text,
  source_id         text,
  source_file_path  text,                                     -- canonical file in S3

  search_vector     tsvector generated always as (
                      to_tsvector('simple',
                        coalesce(title, '') || ' ' || coalesce(author, ''))
                    ) stored,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- A given external book (e.g. Gutenberg #1342) can only appear once
create unique index uq_catalog_source
  on public.catalog_books (source, source_id)
  where source is not null and source_id is not null;

create index idx_catalog_search_vector on public.catalog_books using gin (search_vector);
create index idx_catalog_title_trgm    on public.catalog_books using gin (title gin_trgm_ops);
create index idx_catalog_author_trgm   on public.catalog_books using gin (author gin_trgm_ops);
create index idx_catalog_language      on public.catalog_books (language);

create trigger trg_catalog_books_updated_at
  before update on public.catalog_books
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 2. Link user copies to the catalog (empty for uploads not in the catalog)
-- -----------------------------------------------------------------------------
alter table public.books
  add column catalog_book_id uuid references public.catalog_books (id) on delete set null;

create index idx_books_catalog_book on public.books (catalog_book_id)
  where catalog_book_id is not null;

-- -----------------------------------------------------------------------------
-- 3. BOOK_ROOMS  (one per catalog book, created automatically)
-- -----------------------------------------------------------------------------
create table public.book_rooms (
  id               uuid primary key default gen_random_uuid(),
  catalog_book_id  uuid not null unique references public.catalog_books (id) on delete cascade,
  created_at       timestamptz not null default now()
);

create or replace function public.create_book_room_for_catalog()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.book_rooms (catalog_book_id) values (new.id)
  on conflict (catalog_book_id) do nothing;
  return new;
end;
$$;

create trigger trg_catalog_books_create_room
  after insert on public.catalog_books
  for each row execute function public.create_book_room_for_catalog();

-- Backfill (no-op while the catalog is empty)
insert into public.book_rooms (catalog_book_id)
select id from public.catalog_books
on conflict (catalog_book_id) do nothing;

-- -----------------------------------------------------------------------------
-- 4. ROOM_POSTS
-- -----------------------------------------------------------------------------
create table public.room_posts (
  id             uuid primary key default gen_random_uuid(),
  room_id        uuid not null references public.book_rooms (id) on delete cascade,
  user_id        uuid not null references public.users (id)      on delete cascade,
  parent_id      uuid,                                   -- reply target (same room)

  body           text not null check (char_length(body) between 1 and 5000),

  -- Chapter the post is about (0-based chapter_index, comparable between copies
  -- made from the same catalog file). Null = general post, no spoiler gating.
  chapter_index  integer check (chapter_index >= 0),

  is_edited      boolean not null default false,
  deleted_at     timestamptz,                            -- soft delete keeps threads intact
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint room_posts_id_room_unique unique (id, room_id),

  -- A reply must live in the same room as its parent.
  -- SET NULL is limited to parent_id so room_id is never nulled; replies of a
  -- hard-deleted post become top-level posts.
  constraint room_posts_parent_fk
    foreign key (parent_id, room_id)
    references public.room_posts (id, room_id)
    on delete set null (parent_id)
);

create index idx_room_posts_room_created on public.room_posts (room_id, created_at desc);
create index idx_room_posts_parent       on public.room_posts (parent_id) where parent_id is not null;
create index idx_room_posts_user         on public.room_posts (user_id);
create index idx_room_posts_room_chapter on public.room_posts (room_id, chapter_index)
  where chapter_index is not null;

create trigger trg_room_posts_updated_at
  before update on public.room_posts
  for each row execute function public.set_updated_at();

-- Posts can't be moved between rooms/threads; editing the body flags is_edited
create or replace function public.room_posts_guard()
returns trigger
language plpgsql
as $$
begin
  if new.room_id <> old.room_id
     or new.user_id <> old.user_id
     or new.parent_id is distinct from old.parent_id then
    raise exception 'room, author and parent of a post are immutable';
  end if;
  if new.body is distinct from old.body then
    new.is_edited := true;
  end if;
  return new;
end;
$$;

create trigger trg_room_posts_guard
  before update on public.room_posts
  for each row execute function public.room_posts_guard();

-- -----------------------------------------------------------------------------
-- 5. SPOILER HIDING
--    Reader's position = furthest chapter_index reached across THEIR copies of
--    this catalog book, taken from user_progress.chapter_id (finished = beyond all).
--    Returns null if the reader has no copy.
-- -----------------------------------------------------------------------------
create or replace function public.my_catalog_chapter_index(p_catalog_book_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select max(
           case when up.is_completed then 2147483647
                else coalesce(ch.chapter_index, -1)
           end
         )
    from public.user_progress up
    join public.books b          on b.id  = up.book_id
    left join public.chapters ch on ch.id = up.chapter_id
   where up.user_id = auth.uid()
     and b.catalog_book_id = p_catalog_book_id
     and b.deleted_at is null;
$$;

-- What the app should read: bodies of unreached-chapter posts are withheld and
-- flagged with is_spoiler so the UI can show a "Spoiler for chapter N" label.
-- Your own posts and untagged (general) posts are never hidden.
-- Deleted posts keep their place in the thread with a null body.
create view public.room_posts_visible
with (security_invoker = true) as
select p.id,
       p.room_id,
       p.user_id,
       p.parent_id,
       p.chapter_index,
       p.is_edited,
       p.created_at,
       p.updated_at,
       (p.deleted_at is not null) as is_deleted,
       s.is_spoiler,
       case when p.deleted_at is not null or s.is_spoiler then null else p.body end as body
  from public.room_posts p
  join public.book_rooms r on r.id = p.room_id
  cross join lateral (
    select (p.deleted_at is null
            and p.chapter_index is not null
            and p.user_id <> auth.uid()
            and coalesce(public.my_catalog_chapter_index(r.catalog_book_id), -1) < p.chapter_index
           ) as is_spoiler
  ) s;

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.catalog_books enable row level security;
alter table public.book_rooms    enable row level security;
alter table public.room_posts    enable row level security;

-- Catalog + rooms: every signed-in user reads; only the server (service_role) writes
create policy "signed-in users read catalog"
  on public.catalog_books for select to authenticated using (true);

create policy "signed-in users read rooms"
  on public.book_rooms for select to authenticated using (true);

revoke insert, update, delete on public.catalog_books from anon, authenticated;
revoke insert, update, delete on public.book_rooms    from anon, authenticated;

-- Posts: everyone signed in reads; users create / edit / delete only their own
create policy "signed-in users read posts"
  on public.room_posts for select to authenticated using (true);

create policy "create own posts"
  on public.room_posts for insert to authenticated
  with check (user_id = auth.uid());

create policy "edit own posts"
  on public.room_posts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "delete own posts"
  on public.room_posts for delete to authenticated
  using (user_id = auth.uid());

-- =============================================================================
-- Notes
--  * Query room_posts_visible (not room_posts) in the app so spoilers and deleted
--    posts are masked. The base table's SELECT policy is open per the spec, so a
--    client that reads room_posts directly still gets raw bodies.
--  * Soft delete: UPDATE room_posts SET deleted_at = now() WHERE id = ...
--  * Link a user's copy to the catalog with:
--      UPDATE books SET catalog_book_id = '<catalog id>' WHERE id = '<book id>';
--    (the existing "owner updates books" policy allows this; do it from the server
--    if you don't want users choosing their own link).
--  * chapter_index is 0-based; a post about chapter N becomes readable once the
--    reader's current chapter is N or later.
-- =============================================================================