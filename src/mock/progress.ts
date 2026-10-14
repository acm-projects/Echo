import type { UserProgress } from '../data/types';
import { USER_IDS } from './users';
import { BOOK_IDS } from './books';
import { mockChapters } from './chapters';

// Finds a chapter using its book and chapter index
function getChapterId(
  bookId: string,
  chapterIndex: number
): string {
  const chapter = mockChapters.find(
    (c) =>
      c.book_id === bookId &&
      c.chapter_index === chapterIndex
  );

  if (!chapter) {
    throw new Error(
      `Missing mock chapter ${chapterIndex} for book ${bookId}`
    );
  }

  return chapter.id;
}

// Sample listening progress for testing
export const mockProgress: UserProgress[] = [
  {
    id: '30000000-0000-4000-8000-000000000001',
    user_id: USER_IDS.current,
    book_id: BOOK_IDS.gatsby,
    chapter_id: getChapterId(BOOK_IDS.gatsby, 3),
    position_ms: 600000,
    playback_speed: 1.0,
    is_completed: false,
    device_id: 'mock-iphone',
    client_updated_at: '2026-10-12T15:30:00Z',
    updated_at: '2026-10-12T15:30:00Z',
  },
  {
    id: '30000000-0000-4000-8000-000000000002',
    user_id: USER_IDS.current,
    book_id: BOOK_IDS.gameOfThrones,
    chapter_id: getChapterId(BOOK_IDS.gameOfThrones, 9),
    position_ms: 900000,
    playback_speed: 1.25,
    is_completed: false,
    device_id: 'mock-iphone',
    client_updated_at: '2026-10-13T20:00:00Z',
    updated_at: '2026-10-13T20:00:00Z',
  },
  {
    id: '30000000-0000-4000-8000-000000000003',
    user_id: USER_IDS.alex,
    book_id: BOOK_IDS.gatsby,
    chapter_id: getChapterId(BOOK_IDS.gatsby, 8),
    position_ms: 2000000,
    playback_speed: 1.0,
    is_completed: true,
    device_id: 'mock-android',
    client_updated_at: '2026-10-11T18:00:00Z',
    updated_at: '2026-10-11T18:00:00Z',
  },
];
