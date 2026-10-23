-- =============================================================================
-- Echo sample data (seed)
--
-- Run in the Supabase dashboard SQL Editor (it runs as the database owner, so
-- Row Level Security does not apply while seeding).
--
-- BEFORE RUNNING: replace the two placeholder emails below with the emails of
-- your test User 1 and User 2. Do not commit real emails or any passwords.
--
-- Safe to run more than once: it first removes the data it created last time.
-- It only touches books whose source_file_path starts with 'test/' and the
-- catalog entry with source = 'seed'.
--
-- Creates
--   catalog:   1 catalog book (+ its Book Room, made by a trigger)
--   User 1:    2 books (book 1 linked to the catalog), 4 chapters, 12 script
--              lines, 4 characters, summaries, 1 relationship, 1 story event,
--              reading progress, 1 community listing
--   User 2:    their OWN copy of the catalog book with its own 4 chapters and a
--              progress row on chapter 0 (to test spoiler protection)
-- =============================================================================

do $$
declare
  v_email1   text := 'echo-test-user1@example.com';
  v_email2   text := 'echo-test-user2@example.com';

  v_u1       uuid;
  v_u2       uuid;
  v_catalog  uuid;
  v_book1    uuid;   -- User 1, linked to the catalog, has all the content
  v_book2    uuid;   -- User 1, not in the catalog, still processing
  v_book_u2  uuid;   -- User 2's own copy of the catalog book
  v_narr     uuid;
  v_elena    uuid;
  v_marcus   uuid;
  v_viktor   uuid;
  v_event    uuid;
begin
  select id into v_u1 from auth.users where email = v_email1;
  select id into v_u2 from auth.users where email = v_email2;
  if v_u1 is null or v_u2 is null then
    raise exception 'Test user not found. Edit v_email1 / v_email2 at the top of this script.';
  end if;

  -- ---------------------------------------------------------------------------
  -- 0. Clean up any earlier run
  -- ---------------------------------------------------------------------------
  delete from public.books
   where user_id in (v_u1, v_u2) and source_file_path like 'test/%';
  delete from public.catalog_books
   where source = 'seed' and source_id = 'echo-seed-1';

  -- ---------------------------------------------------------------------------
  -- 1. Catalog book (a trigger creates its Book Room)
  -- ---------------------------------------------------------------------------
  insert into public.catalog_books
    (title, author, description, language, is_public_domain, source, source_id, source_file_path)
  values
    ('The Lantern Keeper', 'Test Author',
     'A lighthouse keeper guards an old secret as a storm closes in.',
     'en', true, 'seed', 'echo-seed-1', 'test/catalog/lantern-keeper.pdf')
  returning id into v_catalog;

  -- Safety net in case the room trigger is not installed
  insert into public.book_rooms (catalog_book_id) values (v_catalog)
  on conflict (catalog_book_id) do nothing;

  -- ---------------------------------------------------------------------------
  -- 2. User 1's two books
  -- ---------------------------------------------------------------------------
  insert into public.books
    (user_id, title, author, description, language, source_file_path, source_file_type,
     status, total_chapters, total_duration_ms, narration_style, catalog_book_id)
  values
    (v_u1, 'The Lantern Keeper', 'Test Author',
     'A lighthouse keeper guards an old secret as a storm closes in.',
     'en', 'test/book1.pdf', 'pdf', 'ready', 4, 240000, 'third_person', v_catalog)
  returning id into v_book1;

  insert into public.books
    (user_id, title, author, language, source_file_path, source_file_type, status)
  values
    (v_u1, 'Second Test Book', 'Another Author', 'en', 'test/book2.epub', 'epub', 'queued')
  returning id into v_book2;

  -- ---------------------------------------------------------------------------
  -- 3. Chapters for book 1 (chapter_index is 0-based)
  -- ---------------------------------------------------------------------------
  insert into public.chapters
    (book_id, chapter_index, title, audio_s3_url, audio_duration_ms, status, word_count)
  select v_book1, t.ci, t.title,
         'test/book1/chapter-' || t.ci || '.mp3', 60000, 'ready'::processing_status, 1200
    from (values
      (0, 'The Lighthouse'),
      (1, 'A Stranger Arrives'),
      (2, 'The Letter'),
      (3, 'The Storm')
    ) as t(ci, title);

  -- ---------------------------------------------------------------------------
  -- 4. Characters (role + first_appearance_chapter_index drive spoiler hiding)
  --    summary = the FULL profile (contains spoilers) and must never be returned
  --    by getCharactersForBook.
  -- ---------------------------------------------------------------------------
  insert into public.characters
    (book_id, name, is_narrator, gender, summary, voice_id, voice_name, voice_description)
  values
    (v_book1, 'Narrator', true, 'neutral',
     'The storyteller.', 'voice_narrator', 'Calm storyteller', 'Warm, steady, mid-range voice')
  returning id into v_narr;

  insert into public.characters
    (book_id, name, role, first_appearance_chapter_index, gender, portrait_path,
     summary, voice_id, voice_name, voice_description, voice_settings)
  values
    (v_book1, 'Elena', 'protagonist', 0, 'female', 'test/portraits/elena.png',
     'FULL PROFILE (spoilers): Elena is secretly the daughter of the last keeper and the true heir of the lantern.',
     'voice_elena', 'Bright alto', 'Determined young woman, clear and bright',
     '{"pitch": 1.0, "speed": 1.0}'::jsonb)
  returning id into v_elena;

  insert into public.characters
    (book_id, name, role, first_appearance_chapter_index, gender, portrait_path,
     summary, voice_id, voice_name, voice_description, voice_settings)
  values
    (v_book1, 'Marcus', 'supporting', 1, 'male', 'test/portraits/marcus.png',
     'FULL PROFILE (spoilers): Marcus carries the letter on behalf of Elena''s late mother.',
     'voice_marcus', 'Gentle baritone', 'Kind, slightly tired traveler',
     '{"pitch": 0.9, "speed": 0.95}'::jsonb)
  returning id into v_marcus;

  insert into public.characters
    (book_id, name, role, first_appearance_chapter_index, gender, portrait_path,
     summary, voice_id, voice_name, voice_description, voice_settings)
  values
    (v_book1, 'Viktor', 'antagonist', 3, 'male', 'test/portraits/viktor.png',
     'FULL PROFILE (spoilers): Viktor wants the lantern for its power and stops at nothing.',
     'voice_viktor', 'Cold bass', 'Menacing, deep and slow',
     '{"pitch": 0.7, "speed": 0.9}'::jsonb)
  returning id into v_viktor;

  update public.books set default_narrator_id = v_narr where id = v_book1;

  -- ---------------------------------------------------------------------------
  -- 5. Script lines: 3 per chapter
  -- ---------------------------------------------------------------------------
  insert into public.narration_scripts
    (chapter_id, character_id, line_index, line_type, speaker_name, text_content,
     emotional_tone, start_ms, end_ms)
  select c.id, ch.id, t.li, t.ltype::script_line_type, t.speaker, t.body, t.tone, t.s, t.e
    from (values
      (0, 0, 'narration', 'Narrator', 'The lighthouse stood alone at the edge of the cliff.',        'calm',    0,     6000),
      (0, 1, 'dialogue',  'Elena',    'Another quiet night. The lamp will not light itself.',          'weary',   6000,  12000),
      (0, 2, 'narration', 'Narrator', 'She climbed the spiral stairs, one hundred steps, as always.', 'calm',    12000, 19000),

      (1, 0, 'narration', 'Narrator', 'A stranger appeared on the path as the fog rolled in.',         'tense',   0,     6000),
      (1, 1, 'dialogue',  'Marcus',   'Excuse me, I am looking for the keeper of this light.',         'polite',  6000,  12000),
      (1, 2, 'dialogue',  'Elena',    'You have found her. What do you want?',                         'guarded', 12000, 17000),

      (2, 0, 'narration', 'Narrator', 'Marcus placed a sealed letter on the table.',                   'calm',    0,     5000),
      (2, 1, 'dialogue',  'Marcus',   'It was addressed to your mother, years ago.',                   'gentle',  5000,  10000),
      (2, 2, 'dialogue',  'Elena',    'Then why does it bear my name now?',                            'shocked', 10000, 15000),

      (3, 0, 'narration', 'Narrator', 'Thunder shook the tower as a figure entered the lamp room.',    'tense',   0,     7000),
      (3, 1, 'dialogue',  'Viktor',   'At last, the last keeper. Give me the lantern.',                'cold',    7000,  13000),
      (3, 2, 'dialogue',  'Elena',    'Never. It was never yours to take.',                            'fierce',  13000, 18000)
    ) as t(ci, li, ltype, speaker, body, tone, s, e)
    join public.chapters   c  on c.book_id  = v_book1 and c.chapter_index = t.ci
    join public.characters ch on ch.book_id = v_book1 and ch.name = t.speaker;

  -- Which characters appear in which chapters (built from the script lines)
  insert into public.chapter_characters (chapter_id, character_id, book_id, line_count)
  select ns.chapter_id, ns.character_id, v_book1, count(*)
    from public.narration_scripts ns
    join public.chapters c on c.id = ns.chapter_id
   where c.book_id = v_book1 and ns.character_id is not null
   group by ns.chapter_id, ns.character_id;

  -- ---------------------------------------------------------------------------
  -- 6. Summaries
  --    spoiler_free_through_chapter_index: null = always safe; N = safe from chapter N on
  -- ---------------------------------------------------------------------------
  -- Book summary
  insert into public.summaries (book_id, summary_type, content)
  values (v_book1, 'book',
          'A lonely lighthouse keeper receives an unexpected visitor, and an old secret begins to surface.');

  -- Chapter summaries (chapter 0 is early, chapter 3 is late)
  insert into public.summaries
    (book_id, chapter_id, summary_type, content, spoiler_free_through_chapter_index)
  select v_book1, c.id, 'chapter', t.body, t.ci
    from (values
      (0, 'Elena tends the lighthouse alone, as she does every night.'),
      (3, 'A storm hits and an intruder demands the lantern.')
    ) as t(ci, body)
    join public.chapters c on c.book_id = v_book1 and c.chapter_index = t.ci;

  -- Character summaries for Elena: an early version and a more complete later one
  insert into public.summaries
    (book_id, character_id, summary_type, content, spoiler_free_through_chapter_index)
  values
    (v_book1, v_elena, 'character',
     'Elena is the quiet keeper of the lighthouse.', 0),
    (v_book1, v_elena, 'character',
     'Elena is the keeper of the lighthouse, and a mysterious letter now draws her into her family history.', 2);

  -- ---------------------------------------------------------------------------
  -- 7. One character relationship and one story event
  -- ---------------------------------------------------------------------------
  insert into public.character_relationships
    (book_id, character_a_id, character_b_id, label, description, revealed_in_chapter_index)
  values
    (v_book1, v_elena, v_marcus, 'old family friend',
     'Marcus knew Elena''s mother and has been looking for Elena for years.', 2);

  insert into public.story_events (book_id, chapter_index, sort_order, title, description)
  values (v_book1, 2, 0, 'The Sealed Letter',
          'Marcus delivers a letter that changes how Elena sees her past.')
  returning id into v_event;

  insert into public.story_event_characters (event_id, character_id, book_id)
  values (v_event, v_elena,  v_book1),
         (v_event, v_marcus, v_book1);

  -- ---------------------------------------------------------------------------
  -- 8. User 1's progress: book 1, chapter 2, partway through
  -- ---------------------------------------------------------------------------
  insert into public.user_progress
    (user_id, book_id, chapter_id, position_ms, playback_speed, is_completed, device_id)
  select v_u1, v_book1, c.id, 45000, 1.25, false, 'seed-device'
    from public.chapters c
   where c.book_id = v_book1 and c.chapter_index = 2;

  -- ---------------------------------------------------------------------------
  -- 9. User 2's OWN copy of the catalog book, with its own chapters
  -- ---------------------------------------------------------------------------
  insert into public.books
    (user_id, title, author, description, language, source_file_path, source_file_type,
     status, total_chapters, total_duration_ms, catalog_book_id)
  values
    (v_u2, 'The Lantern Keeper', 'Test Author',
     'A lighthouse keeper guards an old secret as a storm closes in.',
     'en', 'test/book1-user2.pdf', 'pdf', 'ready', 4, 240000, v_catalog)
  returning id into v_book_u2;

  insert into public.chapters
    (book_id, chapter_index, title, audio_s3_url, audio_duration_ms, status, word_count)
  select v_book_u2, t.ci, t.title,
         'test/book1-user2/chapter-' || t.ci || '.mp3', 60000, 'ready'::processing_status, 1200
    from (values
      (0, 'The Lighthouse'),
      (1, 'A Stranger Arrives'),
      (2, 'The Letter'),
      (3, 'The Storm')
    ) as t(ci, title);

  -- User 2 is on an EARLY chapter (chapter 0)
  insert into public.user_progress
    (user_id, book_id, chapter_id, position_ms, playback_speed, is_completed, device_id)
  select v_u2, v_book_u2, c.id, 30000, 1.0, false, 'seed-device'
    from public.chapters c
   where c.book_id = v_book_u2 and c.chapter_index = 0;

  -- ---------------------------------------------------------------------------
  -- 10. Community listing for User 1's book 1
  --     'draft' on purpose: a PUBLISHED book is readable by every signed-in user
  --     (can_read_book), which would make the privacy test fail. Change to
  --     'published' only when testing the community feed.
  -- ---------------------------------------------------------------------------
  insert into public.community_books (book_id, user_id, title, description, tags, status)
  values (v_book1, v_u1, 'The Lantern Keeper (test listing)',
          'Sample listing for testing.', array['seed', 'test'], 'draft');

  raise notice 'Seed complete. Catalog id: %, User 1 book: %, User 2 copy: %',
    v_catalog, v_book1, v_book_u2;
end
$$;