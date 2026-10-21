import type { DbClient } from './types'

export async function getProgressForBook(supabase: DbClient, bookId: string) {
  const { data, error } = await supabase
    .from('user_progress')
    .select(
      'book_id, chapter_id, position_ms, playback_speed, is_completed, client_updated_at, chapters(chapter_index)',
    )
    .eq('book_id', bookId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getContinueListening(supabase: DbClient) {
  const { data, error } = await supabase
    .from('user_progress')
    .select(
      'book_id, chapter_id, position_ms, client_updated_at, books!inner(id, title, author, cover_image_path)',
    )
    .eq('is_completed', false)
    .is('books.deleted_at', null)
    .order('client_updated_at', { ascending: false })

  if (error) throw error
  return data
}