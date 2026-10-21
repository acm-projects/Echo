import type { DbClient } from './types'

export async function getMyBooks(supabase: DbClient) {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError

  const userId = sessionData.session?.user.id
  if (!userId) throw new Error('Not signed in')

  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, cover_image_path, status, created_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getBookById(supabase: DbClient, bookId: string) {
  const { data, error } = await supabase
    .from('books')
    .select(
      'id, title, author, description, cover_image_path, status, language, total_chapters, total_duration_ms',
    )
    .eq('id', bookId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getChaptersForBook(supabase: DbClient, bookId: string) {
  const { data, error } = await supabase
    .from('chapters')
    .select('id, chapter_index, title, audio_duration_ms, audio_s3_url, status')
    .eq('book_id', bookId)
    .order('chapter_index', { ascending: true })

  if (error) throw error
  return data
}