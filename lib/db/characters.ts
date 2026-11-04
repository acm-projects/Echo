import type { DbClient } from './types'

// Spoiler rule used throughout this file:
// a null gate means "visible from the start"; otherwise it unlocks at that chapter.
const upTo = (column: string, currentChapterIndex: number) =>
  `${column}.is.null,${column}.lte.${currentChapterIndex}`

const reached = (gate: number | null, currentChapterIndex: number) =>
  gate === null || gate <= currentChapterIndex

export async function getCharactersForBook(
  supabase: DbClient,
  bookId: string,
  currentChapterIndex: number,
) {
  const { data, error } = await supabase
    .from('characters')
    .select('id, name, aliases, role, gender, is_narrator, portrait_path, first_appearance_chapter_index, voice_id, voice_name, voice_description, voice_sample_path, voice_settings')
    .eq('book_id', bookId)
    .or(upTo('first_appearance_chapter_index', currentChapterIndex))
    .order('first_appearance_chapter_index', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true })

  if (error) throw error
  return data
}

export async function getCharacterSummary(
  supabase: DbClient,
  characterId: string,
  currentChapterIndex: number,
) {
  const { data, error } = await supabase
    .from('summaries')
    .select('id, character_id, content, spoiler_free_through_chapter_index, updated_at')
    .eq('summary_type', 'character')
    .eq('character_id', characterId)
    .or(upTo('spoiler_free_through_chapter_index', currentChapterIndex))
    .order('spoiler_free_through_chapter_index', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getCharacterRelationships(
  supabase: DbClient,
  bookId: string,
  currentChapterIndex: number,
) {
  const { data, error } = await supabase
    .from('character_relationships')
    .select('id, label, description, revealed_in_chapter_index, a:characters!character_relationships_a_fk(id, name, role, portrait_path, first_appearance_chapter_index), b:characters!character_relationships_b_fk(id, name, role, portrait_path, first_appearance_chapter_index)')
    .eq('book_id', bookId)
    .or(upTo('revealed_in_chapter_index', currentChapterIndex))
    .order('revealed_in_chapter_index', { ascending: true, nullsFirst: true })

  if (error) throw error

  // Don't reveal a character who hasn't appeared yet, even inside a revealed relationship
  return data.filter(
    (r) =>
      r.a &&
      r.b &&
      reached(r.a.first_appearance_chapter_index, currentChapterIndex) &&
      reached(r.b.first_appearance_chapter_index, currentChapterIndex),
  )
}

export async function getStoryEvents(
  supabase: DbClient,
  bookId: string,
  currentChapterIndex: number,
) {
  const { data, error } = await supabase
    .from('story_events')
    .select('id, chapter_index, sort_order, title, description, story_event_characters(characters(id, name, portrait_path, first_appearance_chapter_index))')
    .eq('book_id', bookId)
    .lte('chapter_index', currentChapterIndex)
    .order('chapter_index', { ascending: true })
    .order('sort_order', { ascending: true })

  if (error) throw error

  return data.map(({ story_event_characters, ...event }) => ({
    ...event,
    characters: story_event_characters.flatMap((link) =>
      link.characters &&
      reached(link.characters.first_appearance_chapter_index, currentChapterIndex)
        ? [link.characters]
        : [],
    ),
  }))
}

export async function getScriptForChapter(supabase: DbClient, chapterId: string) {
  const { data, error } = await supabase
    .from('narration_scripts')
    .select('id, line_index, line_type, character_id, speaker_name, text_content, emotional_tone, start_ms, end_ms')
    .eq('chapter_id', chapterId)
    .order('line_index', { ascending: true })

  if (error) throw error
  return data
}

export async function getSummariesForBook(
  supabase: DbClient,
  bookId: string,
  currentChapterIndex: number,
) {
  const { data, error } = await supabase
    .from('summaries')
    .select('id, summary_type, content, spoiler_free_through_chapter_index, chapter_id, chapters(chapter_index, title)')
    .eq('book_id', bookId)
    .in('summary_type', ['book', 'chapter'])
    .or(upTo('spoiler_free_through_chapter_index', currentChapterIndex))

  if (error) throw error

  const book = data.find((s) => s.summary_type === 'book') ?? null
  const chapters = data
    .filter(
      (s) =>
        s.summary_type === 'chapter' &&
        s.chapters !== null &&
        s.chapters.chapter_index <= currentChapterIndex,
    )
    .sort((a, b) => (a.chapters?.chapter_index ?? 0) - (b.chapters?.chapter_index ?? 0))

  return { book, chapters }
}