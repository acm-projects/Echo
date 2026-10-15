-- =============================================================================
-- Migration: fix_function_search_paths
--
-- Clears the Security Advisor warnings that come from our own functions:
--
--   1. "Function Search Path Mutable"
--        Pin search_path = public on every function that didn't set one.
--
--   2. "Function can be executed by anon / signed-in users" (SECURITY DEFINER)
--        - Trigger-only functions: nobody needs to call them directly, so
--          remove EXECUTE from everyone except the server. Triggers still fire.
--        - Helper / RPC functions: remove EXECUTE from public and anon, keep it
--          for signed-in users, who are the only ones who should call them.
--
-- No tables, columns or data are changed.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Pin the search path
-- -----------------------------------------------------------------------------
alter function public.set_updated_at()                  set search_path = public;
alter function public.upsert_progress(uuid, uuid, integer, timestamptz, text, numeric, boolean)
                                                        set search_path = public;
alter function public.friendships_guard()               set search_path = public;
alter function public.validate_streak_timezone()        set search_path = public;
alter function public.live_streak(integer, date, integer, text)
                                                        set search_path = public;
alter function public.room_posts_guard()                set search_path = public;
alter function public.voice_jobs_stamp_times()          set search_path = public;
alter function public.shared_casts_guard()              set search_path = public;
alter function public.shared_cast_voices_guard()        set search_path = public;

-- -----------------------------------------------------------------------------
-- 2a. Trigger-only SECURITY DEFINER functions: not callable by clients at all.
--     Database triggers do not need the caller to hold EXECUTE, so these keep
--     working (new-user profile, rating counters, streak row, book room).
-- -----------------------------------------------------------------------------
revoke execute on function public.handle_new_user()                from public, anon, authenticated;
revoke execute on function public.refresh_community_book_stats()   from public, anon, authenticated;
revoke execute on function public.handle_new_profile_streak()      from public, anon, authenticated;
revoke execute on function public.create_book_room_for_catalog()   from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2b. Functions that signed-in users legitimately call (RLS policies, views, RPC):
--     closed to anonymous visitors, open to signed-in users.
-- -----------------------------------------------------------------------------
revoke execute on function public.can_read_book(uuid)                    from public, anon;
revoke execute on function public.are_friends(uuid, uuid)                from public, anon;
revoke execute on function public.can_view_profile_stats(uuid)           from public, anon;
revoke execute on function public.my_catalog_chapter_index(uuid)         from public, anon;
revoke execute on function public.record_listening(integer, integer)     from public, anon;
revoke execute on function public.friends_leaderboard(date, date)        from public, anon;
revoke execute on function public.upsert_progress(uuid, uuid, integer, timestamptz, text, numeric, boolean)
                                                                         from public, anon;

grant execute on function public.can_read_book(uuid)                     to authenticated;
grant execute on function public.are_friends(uuid, uuid)                 to authenticated;
grant execute on function public.can_view_profile_stats(uuid)            to authenticated;
grant execute on function public.my_catalog_chapter_index(uuid)          to authenticated;
grant execute on function public.record_listening(integer, integer)      to authenticated;
grant execute on function public.friends_leaderboard(date, date)         to authenticated;
grant execute on function public.upsert_progress(uuid, uuid, integer, timestamptz, text, numeric, boolean)
                                                                         to authenticated;

-- =============================================================================
-- Notes
--  * Warnings that can remain after this migration are intentional or are
--    dashboard settings, not SQL:
--      - "Signed-in users can execute SECURITY DEFINER function" for the helpers
--        in 2b. They must be callable by signed-in users: RLS policies and the
--        app's RPC calls depend on it.
--      - "Extension in public" for pg_trgm and citext (moving them is a separate,
--        riskier change).
--      - "Leaked password protection disabled": Authentication settings in the
--        dashboard.
--  * service_role (your server) is unaffected by every change here.
-- =============================================================================