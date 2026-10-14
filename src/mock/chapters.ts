import type { Chapter } from '../data/types';
import { BOOK_IDS } from './books';

// Creates a sample chapter linked to a book
function createChapter(
  bookId: string,
  index: number,
  title: string,
  durationMs: number
): Chapter {
  const chapterNumber = String(index + 1).padStart(4, '0');

  return {
    id: bookId.slice(0, 8) + '-0000-4000-8000-' +
      chapterNumber.padStart(12, '0'),
    book_id: bookId,
    chapter_index: index,
    title,
    word_count: 3000,
    narrator_character_id: null,
    audio_s3_url: `mock/audio/${bookId}/${index}.mp3`,
    audio_duration_ms: durationMs,
    audio_size_bytes: 5000000,
    audio_format: 'mp3',
    status: 'ready',
    processing_error: null,
    created_at: '2026-10-01T12:00:00Z',
    updated_at: '2026-10-01T12:00:00Z',
  };
}

// The Great Gatsby has 9 chapters
const gatsbyChapters: Chapter[] = Array.from(
  { length: 9 },
  (_, index) =>
    createChapter(
      BOOK_IDS.gatsby,
      index,
      `Chapter ${index + 1}`,
      2000000
    )
);

// A Game of Thrones has 73 chapters in our mock data
const gameOfThronesChapters: Chapter[] = Array.from(
  { length: 73 },
  (_, index) =>
    createChapter(
      BOOK_IDS.gameOfThrones,
      index,
      `Chapter ${index + 1}`,
      index === 72 ? 1800024 : 1641666
    )
);

// Combine all chapters into one array
export const mockChapters: Chapter[] = [
  ...gatsbyChapters,
  ...gameOfThronesChapters,
];
