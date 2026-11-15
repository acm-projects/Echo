import { dataConfig } from './config';

import type {
  User,
  Book,
  Chapter,
  Character,
  UserProgress,
  UserStreak,
  Friendship,
  CommunityBook,
  ReviewComment,
} from './types';

import { USER_IDS, mockUsers } from '../mock/users';
import { mockBooks } from '../mock/books';
import { mockChapters } from '../mock/chapters';
import { mockCharacters } from '../mock/characters';
import { mockProgress } from '../mock/progress';
import { mockStreaks } from '../mock/streaks';
import { mockFriendships } from '../mock/friendships';
import {
  mockCommunityBooks,
  mockReviewsComments,
} from '../mock/community';
import {
  supabaseBook,
  supabaseBookProgress,
  supabaseChapters,
  supabaseCharacters,
  supabaseCommunityBooks,
  supabaseCommunityReviews,
  supabaseMyBooks,
  supabaseMyProgress,
  supabaseMyStreak,
} from './supabaseRows';

// Handles loading, empty, and error scenarios
async function loadMockData<T>(data: T): Promise<T> {
  if (!dataConfig.useMockData) {
    throw new Error('Supabase data layer is not implemented yet.');
  }

  if (dataConfig.scenario === 'slow') {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, dataConfig.slowDelayMs);
    });
  }

  if (dataConfig.scenario === 'error') {
    throw new Error('Mock data request failed.');
  }

  return data;
}

// Returns an empty result when testing empty states
function mockArray<T>(items: T[]): T[] {
  return dataConfig.scenario === 'empty' ? [] : items;
}

// Test data first, then the signed-in user's real rows from Supabase. Scenarios only change the test data,
// and with mock data switched off only the real rows are returned.
async function withSupabase<T>(mock: T[], real: Promise<T[]>): Promise<T[]> {
  const [testItems, realItems] = await Promise.all([
    dataConfig.useMockData ? loadMockData(mockArray(mock)) : Promise.resolve([]),
    real,
  ]);
  return [...testItems, ...realItems];
}

// Current user's profile
export async function getMyProfile(): Promise<User | null> {
  const user = mockUsers.find(
    (item) => item.id === USER_IDS.current
  );

  return loadMockData(
    dataConfig.scenario === 'empty' ? null : user ?? null
  );
}

// Current user's books
export async function getMyBooks(): Promise<Book[]> {
  const books = mockBooks.filter(
    (book) =>
      book.user_id === USER_IDS.current &&
      book.deleted_at === null
  );

  return withSupabase(books, supabaseMyBooks());
}

// Find one book by ID
export async function getBook(
  bookId: string
): Promise<Book | null> {
  const book = mockBooks.find(
    (item) => item.id === bookId && item.deleted_at === null
  );

  // Real book ids aren't in the test data, so those are looked up in Supabase.
  if (!book) {
    const real = await supabaseBook(bookId);
    return real ?? (dataConfig.useMockData ? loadMockData(null) : null);
  }

  return dataConfig.useMockData
    ? loadMockData(dataConfig.scenario === 'empty' ? null : book)
    : null;
}

// Get chapters for a book in reading order
export async function getBookChapters(
  bookId: string
): Promise<Chapter[]> {
  const chapters = mockChapters
    .filter((chapter) => chapter.book_id === bookId)
    .sort((a, b) => a.chapter_index - b.chapter_index);

  return withSupabase(chapters, supabaseChapters(bookId));
}

// Get characters belonging to a book
export async function getBookCharacters(
  bookId: string
): Promise<Character[]> {
  const characters = mockCharacters.filter(
    (character) => character.book_id === bookId
  );

  return withSupabase(characters, supabaseCharacters(bookId));
}

// Get the current user's progress for one book
export async function getBookProgress(
  bookId: string
): Promise<UserProgress | null> {
  const progress = mockProgress.find(
    (item) =>
      item.user_id === USER_IDS.current &&
      item.book_id === bookId
  );

  // Real books have no test progress, so theirs comes from Supabase.
  if (!progress) {
    const real = await supabaseBookProgress(bookId);
    return real ?? (dataConfig.useMockData ? loadMockData(null) : null);
  }

  return dataConfig.useMockData
    ? loadMockData(dataConfig.scenario === 'empty' ? null : progress)
    : null;
}

// Get all listening progress for the current user
export async function getMyProgress(): Promise<UserProgress[]> {
  const progress = mockProgress.filter(
    (item) => item.user_id === USER_IDS.current
  );

  return withSupabase(progress, supabaseMyProgress());
}

// Get current user's listening streak: the signed-in reader's real streak, else the test one.
export async function getMyStreak(): Promise<UserStreak | null> {
  const real = await supabaseMyStreak();
  if (real) return real;

  const streak = mockStreaks.find(
    (item) => item.user_id === USER_IDS.current
  );

  return loadMockData(
    dataConfig.scenario === 'empty' ? null : streak ?? null
  );
}

// Get friendships involving the current user
export async function getMyFriendships(): Promise<Friendship[]> {
  const friendships = mockFriendships.filter(
    (item) =>
      item.requester_id === USER_IDS.current ||
      item.addressee_id === USER_IDS.current
  );

  return loadMockData(mockArray(friendships));
}

// Get published community books
export async function getCommunityBooks(): Promise<CommunityBook[]> {
  const books = mockCommunityBooks.filter(
    (book) => book.status === 'published'
  );

  return withSupabase(books, supabaseCommunityBooks());
}

// Alias for screens that call community items posts
export async function getRoomPosts(): Promise<CommunityBook[]> {
  return getCommunityBooks();
}

// Get reviews and comments for a community book
export async function getCommunityReviews(
  communityBookId: string
): Promise<ReviewComment[]> {
  const reviews = mockReviewsComments.filter(
    (review) =>
      review.community_book_id === communityBookId &&
      review.deleted_at === null
  );

  return withSupabase(reviews, supabaseCommunityReviews(communityBookId));
}
