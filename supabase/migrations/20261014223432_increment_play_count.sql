-- =============================================================================
-- Migration: increment_play_count
--
-- A function that adds 1 to community_books.play_count and returns the new count.
-- The app calls it when someone plays a shared audiobook:
--   supabase.rpc('increment_play_count', { p_community_book_id: '<id>' })
--
-- Clients are not allowed to write play_count directly, so a function is the
-- only way the number can go up, and it can only go up by 1 per call.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. The function
-- -----------------------------------------------------------------------------
create or replace function public.increment_play_count(p_community_book_id uuid)
returns bigint
language plpgsql
security definer                  -- runs with the owner's rights so it can update any listing
set search_path = public
as $$
declare
  v_count bigint;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- Single UPDATE: safe when many people press play at the same moment.
  -- Only visible listings count (drafts and removed books don't).
  update public.community_books
     set play_count = play_count + 1
   where id = p_community_book_id
     and status in ('published', 'unlisted')
  returning play_count into v_count;

  if v_count is null then
    raise exception 'community book not found';
  end if;

  return v_count;
end;
$$;

-- Signed-in users only; not anonymous visitors
revoke execute on function public.increment_play_count(uuid) from public, anon;
grant  execute on function public.increment_play_count(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Don't refresh updated_at on a play
--    Without this, every play would change the listing's "last edited" time.
-- -----------------------------------------------------------------------------
drop trigger if exists trg_community_books_updated_at on public.community_books;

create trigger trg_community_books_updated_at
  before update on public.community_books
  for each row
  when (old.play_count is not distinct from new.play_count)
  execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Lock the counters so the function is the only way to change them
--    The existing "owner edits listing" policy lets a book's owner update the
--    whole row, including play_count, rating_avg and the other counters.
--    Owners keep the ability to edit the listing itself.
-- -----------------------------------------------------------------------------
revoke update on public.community_books from anon, authenticated;
grant update (title, description, tags, language, status)
  on public.community_books to authenticated;

-- =============================================================================
-- Notes
--  * Each call adds exactly 1. There is no per-user de-duplication, so decide in
--    the app when to call it (e.g. once per listening session, not on every
--    seek). For stricter rules later, add a table of (user, book, day) plays.
--  * Counters set by the database (rating_avg, rating_count, review_count) are
--    updated by a trigger that runs with elevated rights, so they keep working.
--  * save_count is locked too, and needs its own function when you add "save".
--  * New columns added to community_books later are not editable by clients
--    until you add them to the GRANT UPDATE (...) list above.
-- =============================================================================