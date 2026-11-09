import { signedInClient } from './supabaseRows';

// Saves where the reader is in a book to user_progress (one row per reader and book), and adds listening time to
// their streak through record_listening. Only real books are saved; test books keep their mock progress. Without a
// sign-in nothing is written and playback carries on.

export type ProgressPoint = { bookId: string; chapterId: string; positionMs: number; speed: number; completed: boolean };

export async function saveProgress(point: ProgressPoint) {
  const client = await signedInClient();
  if (!client) return;
  const { error } = await client.supabase.from('user_progress').upsert({
    user_id: client.userId,
    book_id: point.bookId,
    chapter_id: point.chapterId,
    position_ms: Math.max(0, Math.round(point.positionMs)),
    playback_speed: Math.min(4, Math.max(0.25, point.speed)),
    is_completed: point.completed,
    client_updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,book_id' });
  if (error) console.warn(`Saving listening progress failed: ${error.message}`);
}

export async function recordListening(seconds: number, chaptersCompleted: number) {
  if (seconds < 1 && !chaptersCompleted) return;
  const client = await signedInClient();
  if (!client) return;
  const { error } = await client.supabase.rpc('record_listening', { p_seconds: Math.round(seconds), p_chapters_completed: chaptersCompleted });
  if (error) console.warn(`Recording listening time failed: ${error.message}`);
}
