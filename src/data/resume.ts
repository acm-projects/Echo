import { getBookChapters, getBookProgress } from './index';
import { playback, type QueuedChapter } from './playback';
import type { Book } from './types';

// Picks a book back up where the reader left off: the saved chapter and position for a real book, or the simulated
// clock for a test book (whose chapters have no audio).
export async function resumeBook(book: Book & { progress: number }) {
  const author = book.author ?? 'Unknown author';
  const [chapters, record] = await Promise.all([getBookChapters(book.id), getBookProgress(book.id)]);
  const playable: QueuedChapter[] = chapters
    .filter((c) => c.status === 'ready' && c.audio_s3_url && !c.audio_s3_url.startsWith('mock/'))
    .map((c) => ({ chapter: c.title ?? `Chapter ${c.chapter_index + 1}`, chapterNumber: c.chapter_index + 1, chapterId: c.id, audioPath: c.audio_s3_url!, durationSec: (c.audio_duration_ms ?? 0) / 1000 }));
  const saved = playable.find((c) => c.chapterId === record?.chapter_id);
  const start = saved ?? playable[0];
  if (start) {
    const startAtSec = saved && !record?.is_completed ? (record?.position_ms ?? 0) / 1000 : 0;
    return playback.load({ title: book.title, author, bookId: book.id, ...start, startAtSec, queue: playable });
  }
  return playback.load({ title: book.title, author, chapter: 'Where you left off', chapterNumber: Math.max(1, Math.ceil((book.progress / 100) * Math.max(1, book.total_chapters))) });
}
