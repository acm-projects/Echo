import type { DbClient } from './types'
import type { Database } from '../database.types'

type BookRow = Database['public']['Tables']['books']['Row']
type SourceFileType = Database['public']['Enums']['source_file_type']
export type BookChanges = Partial<Pick<BookRow, 'title' | 'author' | 'description'>>

export async function createBook(
  supabase: DbClient,
  title: string,
  author: string | null,
  sourceFilePath: string,
  sourceFileType: SourceFileType,
  catalogBookId?: string,
) {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!authData.user) throw new Error('No authenticated user found')

  const { data, error } = await supabase
    .from('books')
    .insert({
      user_id: authData.user.id,
      title,
      author,
      source_file_path: sourceFilePath,
      source_file_type: sourceFileType,
      status: 'uploaded',
      catalog_book_id: catalogBookId ?? null,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateBook(
  supabase: DbClient,
  bookId: string,
  changes: BookChanges,
) {
  const { data, error } = await supabase
    .from('books')
    .update(changes)
    .eq('id', bookId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteBook(supabase: DbClient, bookId: string) {
  const { data, error } = await supabase
    .from('books')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', bookId)

  if (error) throw error
  return data
}

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