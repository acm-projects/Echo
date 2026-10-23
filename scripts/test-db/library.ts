type Database = import('../../lib/database.types').Database
type DbClient = import('../../lib/db/types').DbClient
const assert: typeof import('node:assert/strict') = require('node:assert/strict')
const supabaseJs = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js')
const booksDb = require('../../lib/db/books.ts') as typeof import('../../lib/db/books')
const charactersDb = require('../../lib/db/characters.ts') as typeof import('../../lib/db/characters')
const progressDb = require('../../lib/db/progress.ts') as typeof import('../../lib/db/progress')

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing ${name}; load it from .env before running this script.`)
  return value
}

const supabase: DbClient = supabaseJs.createClient<Database>(
  requiredEnv('EXPO_PUBLIC_SUPABASE_URL'),
  requiredEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  { auth: { persistSession: false, autoRefreshToken: false } },
)

async function logResult<T>(label: string, action: () => Promise<T>): Promise<T> {
  try {
    const result = await action()
    console.log(`${label}:`, result)
    return result
  } catch (error) {
    console.log(`${label} error:`, error)
    throw error
  }
}

async function main() {
  const user1Email = requiredEnv('TEST_USER1_EMAIL')
  const user1Password = requiredEnv('TEST_USER1_PASSWORD')
  const user2Email = requiredEnv('TEST_USER2_EMAIL')
  const user2Password = requiredEnv('TEST_USER2_PASSWORD')

  await logResult('Sign in User 1', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user1Email,
      password: user1Password,
    })
    if (error) throw error
    return { signedIn: Boolean(data.session) }
  })

  const user1Books = await logResult('getMyBooks (User 1)', () =>
    booksDb.getMyBooks(supabase),
  )
  const book1 = user1Books.find((book) => book.title === 'The Lantern Keeper')
  const secondBook = user1Books.find((book) => book.title === 'Second Test Book')
  if (!book1) throw new Error('User 1 should have the seeded catalog book')
  if (!secondBook) throw new Error('User 1 should have the second seeded book')

  await logResult('getBookById (User 1)', () => booksDb.getBookById(supabase, book1.id))
  const chapters = await logResult('getChaptersForBook (User 1)', () =>
    booksDb.getChaptersForBook(supabase, book1.id),
  )
  assert.equal(chapters.length, 4)

  const characters = await logResult('getCharactersForBook (User 1, chapter 2)', () =>
    charactersDb.getCharactersForBook(supabase, book1.id, 2),
  )
  assert.equal(characters.some((character) => character.name === 'Viktor'), false)
  const elena = characters.find((character) => character.name === 'Elena')
  if (!elena) throw new Error('Elena should be visible by chapter 2')

  const characterSummary = await logResult('getCharacterSummary (User 1, chapter 2)', () =>
    charactersDb.getCharacterSummary(supabase, elena.id, 2),
  )
  if (!characterSummary) throw new Error('Expected Elena character summary at chapter 2')
  assert.ok((characterSummary.spoiler_free_through_chapter_index ?? 0) <= 2)

  await logResult('getCharacterRelationships (User 1, chapter 2)', () =>
    charactersDb.getCharacterRelationships(supabase, book1.id, 2),
  )
  await logResult('getStoryEvents (User 1, chapter 2)', () =>
    charactersDb.getStoryEvents(supabase, book1.id, 2),
  )
  await logResult('getScriptForChapter (User 1, chapter 2)', () =>
    charactersDb.getScriptForChapter(supabase, chapters[2].id),
  )
  await logResult('getSummariesForBook (User 1, chapter 2)', () =>
    charactersDb.getSummariesForBook(supabase, book1.id, 2),
  )
  await logResult('getProgressForBook (User 1)', () =>
    progressDb.getProgressForBook(supabase, book1.id),
  )
  await logResult('getContinueListening (User 1)', () =>
    progressDb.getContinueListening(supabase),
  )

    // ---- Added checks (User 1) ----
  const names = (list: { name: string }[]) => list.map((c) => c.name).sort()

  // Library: chapters come back in order
  assert.deepEqual(chapters.map((c) => c.chapter_index), [0, 1, 2, 3])

  // Progress: matches the seed data, and an unstarted book returns null
  const progress = await progressDb.getProgressForBook(supabase, book1.id)
  assert.equal(progress?.chapters?.chapter_index, 2)
  assert.equal(progress?.position_ms, 45000)
  assert.equal(progress?.playback_speed, 1.25)
  assert.equal(progress?.is_completed, false)
  assert.equal(await progressDb.getProgressForBook(supabase, secondBook.id), null)
  const continueList = await progressDb.getContinueListening(supabase)
  assert.ok(continueList.some((p) => p.book_id === book1.id))

  // Spoilers: characters unlock by chapter, and the full profile is never returned
  const early = await charactersDb.getCharactersForBook(supabase, book1.id, 0)
  const mid = await charactersDb.getCharactersForBook(supabase, book1.id, 1)
  const late = await charactersDb.getCharactersForBook(supabase, book1.id, 3)
  assert.deepEqual(names(early), ['Elena', 'Narrator'])
  assert.deepEqual(names(mid), ['Elena', 'Marcus', 'Narrator'])
  assert.deepEqual(names(late), ['Elena', 'Marcus', 'Narrator', 'Viktor'])
  assert.ok(
    [...early, ...mid, ...late].every((c) => !('summary' in c)),
    'getCharactersForBook must not return summary',
  )

  // Spoilers: relationships, events, character summaries, book summaries
  assert.equal((await charactersDb.getCharacterRelationships(supabase, book1.id, 1)).length, 0)
  assert.equal((await charactersDb.getCharacterRelationships(supabase, book1.id, 3)).length, 1)
  assert.equal((await charactersDb.getStoryEvents(supabase, book1.id, 1)).length, 0)
  const lateEvents = await charactersDb.getStoryEvents(supabase, book1.id, 3)
  assert.equal(lateEvents.length, 1)
  assert.deepEqual(names(lateEvents[0].characters), ['Elena', 'Marcus'])

  const earlySummary = await charactersDb.getCharacterSummary(supabase, elena.id, 0)
  const lateSummary = await charactersDb.getCharacterSummary(supabase, elena.id, 2)
  assert.equal(earlySummary?.spoiler_free_through_chapter_index, 0)
  assert.equal(lateSummary?.spoiler_free_through_chapter_index, 2)
  const viktor = late.find((c) => c.name === 'Viktor')
  if (!viktor) throw new Error('Viktor should be visible at chapter 3')
  assert.equal(await charactersDb.getCharacterSummary(supabase, viktor.id, 3), null)

  const summariesEarly = await charactersDb.getSummariesForBook(supabase, book1.id, 0)
  const summariesLate = await charactersDb.getSummariesForBook(supabase, book1.id, 3)
  assert.ok(summariesEarly.book)
  assert.equal(summariesEarly.chapters.length, 1)
  assert.equal(summariesLate.chapters.length, 2)

  // Script: in order, with speaker and timings
  const script = await charactersDb.getScriptForChapter(supabase, chapters[2].id)
  assert.deepEqual(script.map((l) => l.line_index), [0, 1, 2])
  assert.equal(script[1].speaker_name, 'Marcus')
  assert.ok(
    script.every((l) => l.start_ms !== null && l.end_ms !== null && l.end_ms > l.start_ms),
  )
  console.log('Added User 1 checks passed.')

  await logResult('Sign out User 1', async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return 'signed out'
  })

  const user2Id = await logResult('Sign in User 2', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: user2Email,
      password: user2Password,
    })
    if (error) throw error
    return data.user.id
  })

  const user2Books = await logResult('getMyBooks (User 2)', () =>
    booksDb.getMyBooks(supabase),
  )
  const user2Copy = user2Books.find((book) => book.title === 'The Lantern Keeper')
  if (!user2Copy) throw new Error('User 2 should have their own catalog book copy')
  assert.notEqual(user2Copy.id, book1.id, 'Each user must own a separate book row')

  assert.ok(user2Books.every((b) => b.id !== book1.id && b.id !== secondBook.id))

  const user2CannotReadBook = await logResult(
    'getBookById (User 2 reading User 1 book; expected null)',
    () => booksDb.getBookById(supabase, book1.id),
  )
  assert.equal(user2CannotReadBook, null)

  const user2CannotReadChapters = await logResult(
    'getChaptersForBook (User 2 reading User 1 book; expected empty)',
    () => booksDb.getChaptersForBook(supabase, book1.id),
  )
  assert.deepEqual(user2CannotReadChapters, [])

  const user2CannotReadCharacters = await logResult(
    'getCharactersForBook (User 2 reading User 1 book; expected empty)',
    () => charactersDb.getCharactersForBook(supabase, book1.id, 0),
  )
  assert.deepEqual(user2CannotReadCharacters, [])

  const user2CannotReadCharacterSummary = await logResult(
    'getCharacterSummary (User 2 reading User 1 character; expected null)',
    () => charactersDb.getCharacterSummary(supabase, elena.id, 0),
  )
  assert.equal(user2CannotReadCharacterSummary, null)

  const user2CannotReadRelationships = await logResult(
    'getCharacterRelationships (User 2 reading User 1 book; expected empty)',
    () => charactersDb.getCharacterRelationships(supabase, book1.id, 0),
  )
  assert.deepEqual(user2CannotReadRelationships, [])

  const user2CannotReadEvents = await logResult(
    'getStoryEvents (User 2 reading User 1 book; expected empty)',
    () => charactersDb.getStoryEvents(supabase, book1.id, 0),
  )
  assert.deepEqual(user2CannotReadEvents, [])

  const user2CannotReadScript = await logResult(
    'getScriptForChapter (User 2 reading User 1 chapter; expected empty)',
    () => charactersDb.getScriptForChapter(supabase, chapters[2].id),
  )
  assert.deepEqual(user2CannotReadScript, [])

  const user2CannotReadSummaries = await logResult(
    'getSummariesForBook (User 2 reading User 1 book)',
    () => charactersDb.getSummariesForBook(supabase, book1.id, 0),
  )
  assert.equal(user2CannotReadSummaries.book, null)
  assert.deepEqual(user2CannotReadSummaries.chapters, [])

  const user2CannotReadProgress = await logResult(
    'getProgressForBook (User 2 reading User 1 progress; expected null)',
    () => progressDb.getProgressForBook(supabase, book1.id),
  )
  assert.equal(user2CannotReadProgress, null)

  const user2Progress = await logResult('getContinueListening (User 2)', () =>
    progressDb.getContinueListening(supabase),
  )
  assert.equal(
    user2Progress.every((progress) => progress.book_id !== book1.id),
    true,
    'User 2 should not see User 1 progress',
  )

  await logResult('getBookById (User 2 own copy)', () =>
    booksDb.getBookById(supabase, user2Copy.id),
  )
  const user2Chapters = await logResult('getChaptersForBook (User 2 own copy)', () =>
    booksDb.getChaptersForBook(supabase, user2Copy.id),
  )
  assert.equal(user2Chapters.length, 4)

  const { data: catalogBook, error: catalogError } = await supabase
    .from('catalog_books')
    .select('id')
    .eq('source', 'seed')
    .eq('source_id', 'echo-seed-1')
    .maybeSingle()
  if (catalogError) throw catalogError
  if (!catalogBook) throw new Error('The seeded catalog book should exist')

  const roomChapterIndex = await logResult('my_catalog_chapter_index (User 2)', async () => {
    const { data, error } = await supabase.rpc('my_catalog_chapter_index', {
      p_catalog_book_id: catalogBook.id,
    })
    if (error) throw error
    return data
  })
  assert.equal(roomChapterIndex, 0, 'User 2 should be at the early chapter in the Book Room')

  const { data: room, error: roomError } = await supabase
    .from('book_rooms')
    .select('id')
    .eq('catalog_book_id', catalogBook.id)
    .maybeSingle()
  if (roomError) throw roomError
  if (!room) throw new Error('The catalog book should have a Book Room')

  const roomPosts = await logResult('room_posts_visible (User 2)', async () => {
    const { data, error } = await supabase
      .from('room_posts_visible')
      .select('user_id, chapter_index, body, is_spoiler')
      .eq('room_id', room.id)
    if (error) throw error
    return data
  })
  assert.equal(
    roomPosts
      .filter(
        (post) =>
          post.user_id !== user2Id &&
          post.chapter_index !== null &&
          post.chapter_index > roomChapterIndex,
      )
      .every((post) => post.is_spoiler && post.body === null),
    true,
    'Unreached Book Room posts from other users should be masked as spoilers',
  )

  await logResult('Sign out User 2', async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    return 'signed out'
  })

  console.log('All library database checks passed.')
}

main().catch((error) => {
  console.log('Library database checks failed:', error)
  process.exitCode = 1
})
