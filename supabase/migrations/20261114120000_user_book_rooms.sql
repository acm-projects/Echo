-- =============================================================================
-- Migration: user_book_rooms
--
--   1. Profiles for accounts made before the profile trigger existed, so every
--      account can be found in friend search and can send friend requests.
--   2. Book rooms are made by readers, not one per catalog book. A room is about
--      a book (title + author, optionally a catalog entry) and is either
--        public   listed and searchable, anyone signed in can join
--        private  hidden, joined only with its invite code
--   3. room_members: who has joined which room (the creator is the owner).
--   4. Which of the reader's books a room is about: same catalog entry, or the
--      same title once case, spaces and punctuation are ignored. That copy's
--      progress decides which spoilers the reader can see.
--   5. RLS: private rooms, their members and posts are visible only to members;
--      posting needs membership.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. MISSING PROFILES
-- -----------------------------------------------------------------------------
-- An empty username in the sign-up metadata used to give "user" instead of the
-- email's name; nullif makes it fall through to the email like a missing one.
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
                 coalesce(nullif(new.raw_user_meta_data ->> 'username', ''),
                          split_part(new.email, '@', 1),
                          'user'),
                 '[^A-Za-z0-9_]', '', 'g');
  if char_length(base_name) < 3 then base_name := 'user' || base_name; end if;

  insert into public.users (id, username, display_name, avatar_url)
  values (
    new.id,
    left(base_name, 21) || '_' || substr(replace(new.id::text, '-', ''), 1, 6),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), base_name),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- Same naming as the trigger. The streak row follows from trg_users_create_streak.
insert into public.users (id, username, display_name, avatar_url)
select u.id,
       left(n.base_name, 21) || '_' || substr(replace(u.id::text, '-', ''), 1, 6),
       coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), n.base_name),
       u.raw_user_meta_data ->> 'avatar_url'
  from auth.users u
  cross join lateral (
    select case when char_length(raw) < 3 then 'user' || raw else raw end as base_name
      from (select regexp_replace(
                     coalesce(nullif(u.raw_user_meta_data ->> 'username', ''),
                              split_part(u.email, '@', 1),
                              'user'),
                     '[^A-Za-z0-9_]', '', 'g') as raw) r
  ) n
 where not exists (select 1 from public.users p where p.id = u.id)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 2. BOOK_ROOMS made by readers
-- -----------------------------------------------------------------------------
create type public.room_visibility as enum ('public', 'private');

drop trigger if exists trg_catalog_books_create_room on public.catalog_books;
drop function if exists public.create_book_room_for_catalog();

alter table public.book_rooms
  drop constraint if exists book_rooms_catalog_book_id_key,
  alter column catalog_book_id drop not null,
  add column name        text,
  add column book_title  text,
  add column book_author text,
  add column description text,
  add column visibility  public.room_visibility not null default 'public',
  add column invite_code text unique,
  add column created_by  uuid references public.users (id) on delete set null,
  add column updated_at  timestamptz not null default now();

-- The catalog's rooms keep their book and stay public.
update public.book_rooms r
   set book_title  = c.title,
       book_author = c.author,
       name        = c.title
  from public.catalog_books c
 where c.id = r.catalog_book_id;

alter table public.book_rooms
  alter column name set not null,
  alter column book_title set not null,
  add constraint book_rooms_name_length   check (char_length(name) between 1 and 80),
  add constraint book_rooms_title_length  check (char_length(book_title) between 1 and 500),
  add constraint book_rooms_author_length check (char_length(book_author) <= 300),
  add constraint book_rooms_description_length check (char_length(description) <= 500),
  add constraint book_rooms_private_code  check (visibility = 'public' or invite_code is not null),
  add column book_title_key text generated always as (regexp_replace(lower(book_title), '[^a-z0-9]+', '', 'g')) stored;

create index idx_book_rooms_catalog    on public.book_rooms (catalog_book_id) where catalog_book_id is not null;
create index idx_book_rooms_title_key  on public.book_rooms (book_title_key);
create index idx_book_rooms_public     on public.book_rooms (created_at desc) where visibility = 'public';
create index idx_book_rooms_title_trgm on public.book_rooms using gin (book_title gin_trgm_ops);

create trigger trg_book_rooms_updated_at
  before update on public.book_rooms
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. ROOM_MEMBERS
-- -----------------------------------------------------------------------------
create table public.room_members (
  room_id    uuid not null references public.book_rooms (id) on delete cascade,
  user_id    uuid not null references public.users (id)      on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  joined_at  timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index idx_room_members_user on public.room_members (user_id);

-- Security definer so the policies below can ask without recursing into RLS.
create or replace function public.is_room_member(p_room uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.room_members m where m.room_id = p_room and m.user_id = auth.uid());
$$;

create or replace function public.can_see_room(p_room uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.book_rooms r
     where r.id = p_room
       and (r.visibility = 'public' or public.is_room_member(r.id))
  );
$$;

-- Readable invite codes: no 0/O or 1/I/L.
create or replace function public.new_room_code()
returns text
language plpgsql volatile set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.book_rooms where invite_code = code);
  end loop;
  return code;
end;
$$;

-- supabase.rpc('create_book_room', { p_name, p_book_title, p_book_author, p_visibility, p_description })
create or replace function public.create_book_room(
  p_name            text,
  p_book_title      text,
  p_book_author     text default null,
  p_visibility      public.room_visibility default 'public',
  p_description     text default null,
  p_catalog_book_id uuid default null
)
returns public.book_rooms
language plpgsql volatile security definer set search_path = public
as $$
declare
  room public.book_rooms;
begin
  if auth.uid() is null then raise exception 'sign in to make a room'; end if;
  insert into public.book_rooms (name, book_title, book_author, description, visibility, invite_code, created_by, catalog_book_id)
  values (
    coalesce(nullif(trim(p_name), ''), trim(p_book_title)),
    trim(p_book_title),
    nullif(trim(p_book_author), ''),
    nullif(trim(p_description), ''),
    p_visibility,
    case when p_visibility = 'private' then public.new_room_code() end,
    auth.uid(),
    p_catalog_book_id
  )
  returning * into room;
  insert into public.room_members (room_id, user_id, role) values (room.id, auth.uid(), 'owner');
  return room;
end;
$$;

-- supabase.rpc('join_room_by_code', { p_code }) -> the room's id, or an error for an unknown code
create or replace function public.join_room_by_code(p_code text)
returns uuid
language plpgsql volatile security definer set search_path = public
as $$
declare
  found uuid;
begin
  if auth.uid() is null then raise exception 'sign in to join a room'; end if;
  select id into found from public.book_rooms
   where invite_code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if found is null then raise exception 'No room has that invite code.'; end if;
  insert into public.room_members (room_id, user_id) values (found, auth.uid()) on conflict do nothing;
  return found;
end;
$$;

revoke execute on function public.new_room_code() from public, anon, authenticated;
revoke execute on function public.create_book_room(text, text, text, public.room_visibility, text, uuid) from public, anon;
revoke execute on function public.join_room_by_code(text) from public, anon;
grant execute on function public.create_book_room(text, text, text, public.room_visibility, text, uuid) to authenticated;
grant execute on function public.join_room_by_code(text) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. THE READER'S COPY OF A ROOM'S BOOK
-- -----------------------------------------------------------------------------
create or replace function public.my_room_books(p_room uuid)
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select b.id
    from public.books b
    join public.book_rooms r on r.id = p_room
   where b.user_id = auth.uid()
     and b.deleted_at is null
     and ((r.catalog_book_id is not null and b.catalog_book_id = r.catalog_book_id)
          or regexp_replace(lower(b.title), '[^a-z0-9]+', '', 'g') = r.book_title_key)
   order by b.updated_at desc;
$$;

-- Furthest 0-based chapter reached in any matching copy; finished = 2147483647;
-- -1 = has a copy but no progress yet; null = no copy.
create or replace function public.my_room_chapter_index(p_room uuid)
returns integer
language sql stable security definer set search_path = public
as $$
  select case
           when not exists (select 1 from public.my_room_books(p_room)) then null
           else coalesce((
             select max(case when up.is_completed then 2147483647 else coalesce(ch.chapter_index, -1) end)
               from public.user_progress up
               left join public.chapters ch on ch.id = up.chapter_id
              where up.user_id = auth.uid()
                and up.book_id in (select public.my_room_books(p_room))
           ), -1)
         end;
$$;

-- One row per room the reader can see: their copy of its book (if any) and how far they are.
create or replace function public.my_room_shelf()
returns table (room_id uuid, book_id uuid, chapter_index integer)
language sql stable security definer set search_path = public
as $$
  select r.id,
         (select public.my_room_books(r.id) limit 1),
         public.my_room_chapter_index(r.id)
    from public.book_rooms r
   where r.visibility = 'public' or public.is_room_member(r.id);
$$;

-- Same columns as before; spoilers now follow the reader's matching copy.
create or replace view public.room_posts_visible
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
  cross join lateral (
    select (p.deleted_at is null
            and p.chapter_index is not null
            and p.user_id <> auth.uid()
            and coalesce(public.my_room_chapter_index(p.room_id), -1) < p.chapter_index
           ) as is_spoiler
  ) s;

drop function if exists public.my_catalog_chapter_index(uuid);

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- -----------------------------------------------------------------------------
alter table public.room_members enable row level security;

drop policy if exists "signed-in users read rooms" on public.book_rooms;
create policy "read public or joined rooms"
  on public.book_rooms for select to authenticated
  using (visibility = 'public' or public.is_room_member(id));

-- Rooms are created through create_book_room(); owners may rename or delete theirs.
grant update (name, description), delete on public.book_rooms to authenticated;
create policy "owner edits room"
  on public.book_rooms for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy "owner deletes room"
  on public.book_rooms for delete to authenticated
  using (created_by = auth.uid());

create policy "see members of visible rooms"
  on public.room_members for select to authenticated
  using (public.can_see_room(room_id));
-- Public rooms are joined directly; private ones only through join_room_by_code().
create policy "join public rooms"
  on public.room_members for insert to authenticated
  with check (
    user_id = auth.uid() and role = 'member'
    and exists (select 1 from public.book_rooms r where r.id = room_id and r.visibility = 'public')
  );
-- Owners delete the room instead of leaving it.
create policy "leave rooms"
  on public.room_members for delete to authenticated
  using (user_id = auth.uid() and role <> 'owner');
revoke update on public.room_members from anon, authenticated;

drop policy if exists "signed-in users read posts" on public.room_posts;
create policy "read posts in visible rooms"
  on public.room_posts for select to authenticated
  using (public.can_see_room(room_id));

drop policy if exists "create own posts" on public.room_posts;
create policy "members post"
  on public.room_posts for insert to authenticated
  with check (user_id = auth.uid() and public.is_room_member(room_id));
