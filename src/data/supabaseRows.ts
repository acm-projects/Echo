import type { Book, Chapter, Character, CommunityBook, ReviewComment, UserProgress, UserStreak } from './types';

// Real rows from Supabase, read as the signed-in user (RLS decides what's visible). The data layer adds these
// after the mock test data. With nobody signed in, outside the app (scripts have no session storage), or when a
// query fails, each read returns nothing and the mock data still shows. S3 paths in these rows are bucket-relative
// keys; storedFileUrl() in voiceServer.ts turns one into a playable URL.

const BOOK_COLUMNS = 'id, user_id, title, author, description, language, source_file_path, source_file_type, source_file_size_bytes, cover_image_path, status, processing_error, processing_started_at, processing_finished_at, total_chapters, total_duration_ms, model_info, narration_style, default_narrator_id, deleted_at, created_at, updated_at';
const CHAPTER_COLUMNS = 'id, book_id, chapter_index, title, word_count, narrator_character_id, audio_s3_url, audio_duration_ms, audio_size_bytes, audio_format, status, processing_error, created_at, updated_at';
const CHARACTER_COLUMNS = 'id, book_id, name, aliases, gender, is_narrator, summary, voice_id, voice_name, voice_description, voice_sample_path, voice_settings, narration_voice_id, narration_voice_settings, created_at, updated_at';

const PROGRESS_COLUMNS = 'id, user_id, book_id, chapter_id, position_ms, playback_speed, is_completed, device_id, client_updated_at, updated_at';
const COMMUNITY_COLUMNS = 'id, book_id, user_id, title, description, tags, language, status, published_at, play_count, save_count, rating_avg, rating_count, review_count, created_at, updated_at';
const REVIEW_COLUMNS = 'id, community_book_id, user_id, parent_id, rating, title, body, is_edited, deleted_at, created_at, updated_at';

export async function signedInClient() {
  try {
    const { supabase } = await import('../../lib/supabase');
    const { data } = await supabase.auth.getSession();
    return data.session ? { supabase, userId: data.session.user.id } : null;
  } catch {
    return null;
  }
}

async function rows<T>(what: string, query: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) {
    console.warn(`Supabase ${what} failed: ${error.message}`);
    return [];
  }
  return (data ?? []) as T[];
}

export async function supabaseMyBooks(): Promise<Book[]> {
  const client = await signedInClient();
  if (!client) return [];
  return rows<Book>('books', client.supabase.from('books').select(BOOK_COLUMNS).eq('user_id', client.userId).is('deleted_at', null).order('created_at', { ascending: false }));
}

export async function supabaseBook(bookId: string): Promise<Book | null> {
  const client = await signedInClient();
  if (!client) return null;
  // Only the reader's own books: Supabase would also return a book someone else published to the community.
  const [book] = await rows<Book>('book', client.supabase.from('books').select(BOOK_COLUMNS).eq('id', bookId).eq('user_id', client.userId).is('deleted_at', null).limit(1));
  return book ?? null;
}

export async function supabaseChapters(bookId: string): Promise<Chapter[]> {
  const client = await signedInClient();
  if (!client) return [];
  return rows<Chapter>('chapters', client.supabase.from('chapters').select(`${CHAPTER_COLUMNS}, books!inner(user_id)`).eq('book_id', bookId).eq('books.user_id', client.userId).order('chapter_index', { ascending: true }));
}

export async function supabaseCharacters(bookId: string): Promise<Character[]> {
  const client = await signedInClient();
  if (!client) return [];
  return rows<Character>('characters', client.supabase.from('characters').select(`${CHARACTER_COLUMNS}, books!characters_book_id_fkey!inner(user_id)`).eq('book_id', bookId).eq('books.user_id', client.userId).order('name', { ascending: true }));
}

export async function supabaseMyProgress(): Promise<UserProgress[]> {
  const client = await signedInClient();
  if (!client) return [];
  return rows<UserProgress>('progress', client.supabase.from('user_progress').select(PROGRESS_COLUMNS).eq('user_id', client.userId));
}

export async function supabaseBookProgress(bookId: string): Promise<UserProgress | null> {
  const client = await signedInClient();
  if (!client) return null;
  const [record] = await rows<UserProgress>('book progress', client.supabase.from('user_progress').select(PROGRESS_COLUMNS).eq('user_id', client.userId).eq('book_id', bookId).limit(1));
  return record ?? null;
}

// The live view applies today's date to the streak (a missed day ends it), so it's read instead of user_streaks.
export async function supabaseMyStreak(): Promise<UserStreak | null> {
  const client = await signedInClient();
  if (!client) return null;
  const [row] = await rows<Record<string, unknown>>('streak', client.supabase.from('user_streaks_live').select('*').eq('user_id', client.userId).limit(1));
  if (!row) return null;
  return {
    user_id: client.userId,
    current_streak: Number(row.live_streak ?? row.current_streak ?? 0),
    longest_streak: Number(row.longest_streak ?? 0),
    last_goal_met_date: (row.last_goal_met_date as string | null) ?? null,
    streak_freezes: Number(row.streak_freezes ?? 0),
    daily_goal_seconds: Number(row.daily_goal_seconds ?? 0),
    timezone: String(row.timezone ?? 'UTC'),
    total_listen_seconds: Number(row.total_listen_seconds ?? 0),
    created_at: String(row.created_at ?? ''),
    updated_at: String(row.updated_at ?? ''),
  };
}

export async function supabaseCommunityBooks(): Promise<CommunityBook[]> {
  const client = await signedInClient();
  if (!client) return [];
  return rows<CommunityBook>('community books', client.supabase.from('community_books').select(COMMUNITY_COLUMNS).eq('status', 'published').order('published_at', { ascending: false }).limit(50));
}

export async function supabaseCommunityReviews(communityBookId: string): Promise<ReviewComment[]> {
  const client = await signedInClient();
  if (!client) return [];
  return rows<ReviewComment>('reviews', client.supabase.from('reviews_comments').select(REVIEW_COLUMNS).eq('community_book_id', communityBookId).is('deleted_at', null).order('created_at', { ascending: false }));
}

/** A book room's posts with their authors' display names, newest first. */
export async function supabaseRoomPosts(roomId: string) {
  const client = await signedInClient();
  if (!client) return [];
  return rows<{ id: string; body: string; chapter_index: number | null; created_at: string; users: { display_name: string | null; username: string } | null }>(
    'room posts',
    client.supabase.from('room_posts').select('id, body, chapter_index, created_at, users(display_name, username)').eq('room_id', roomId).is('deleted_at', null).order('created_at', { ascending: false }).limit(100),
  );
}
