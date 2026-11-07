import type { Book, Chapter, UserProgress } from './types';
import { getBookChapters, getMyBooks, getMyProgress } from './index';

// The signed-in reader's books with how far through each one they are, most recently listened first.
// Shared by the Your Shelf tab and anything else that shows the reader's own books.
export type DisplayBook = Book & {
  progress: number;
  accent: string;
};

export const accents: Record<string, string> = {
  'The Great Gatsby': '#1F5A6B',
  'A Game of Thrones': '#6B2E2E',
  'The Lord of the Rings': '#3E5A2E',
  Frankenstein: '#2E3A5C',
  Sherlock: '#7A5A1F',
};

// Calculate progress using the durations of completed chapters
// and the current position in the active chapter.
function calculateProgress(
  book: Book,
  chapters: Chapter[],
  record?: UserProgress
): number {
  if (!record || book.status !== 'ready') {
    return 0;
  }

  if (record.is_completed) {
    return 100;
  }

  if (!record.chapter_id || book.total_duration_ms <= 0) {
    return 0;
  }

  const ordered = [...chapters].sort(
    (a, b) => a.chapter_index - b.chapter_index
  );

  const currentIndex = ordered.findIndex(
    (chapter) => chapter.id === record.chapter_id
  );

  if (currentIndex < 0) {
    return 0;
  }

  const priorDuration = ordered
    .slice(0, currentIndex)
    .reduce(
      (sum, chapter) => sum + (chapter.audio_duration_ms ?? 0),
      0
    );

  const currentDuration =
    ordered[currentIndex].audio_duration_ms ?? 0;

  const position =
    currentDuration > 0
      ? Math.min(record.position_ms, currentDuration)
      : 0;

  const percentage =
    ((priorDuration + position) / book.total_duration_ms) * 100;

  return Math.min(
    100,
    Math.max(0, Math.round(percentage))
  );
}

export async function loadShelf(): Promise<DisplayBook[]> {
  // Fetch the current user's books and listening progress.
  const [books, progress] = await Promise.all([
    getMyBooks(),
    getMyProgress(),
  ]);

  // Combine each book with its progress and cover color.
  const displayBooks = await Promise.all(
    books.map(async (book) => {
      const record = progress.find(
        (item) => item.book_id === book.id
      );

      const chapters =
        record && book.status === 'ready'
          ? await getBookChapters(book.id)
          : [];

      return {
        ...book,
        progress: calculateProgress(
          book,
          chapters,
          record
        ),
        accent: accents[book.title] ?? ['#7A3B2E', '#2E5A52', '#5A2E5A', '#6B5A2E'][book.title.length % 4],
      };
    })
  );

  // Recently listened books appear first.
  displayBooks.sort((a, b) => {
    const aTime = progress.find(
      (item) => item.book_id === a.id
    )?.updated_at;

    const bTime = progress.find(
      (item) => item.book_id === b.id
    )?.updated_at;

    if (aTime && bTime) {
      return bTime.localeCompare(aTime);
    }

    if (aTime) return -1;
    if (bTime) return 1;

    return b.created_at.localeCompare(a.created_at);
  });

  return displayBooks;
}
