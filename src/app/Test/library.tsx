
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { fonts } from '../../../theme';
import {
  getMyBooks,
  getMyProgress,
  getBookChapters,
} from '../../data';
import type {
  Book,
  Chapter,
  UserProgress,
} from '../../data/types';

const { width } = Dimensions.get('window');

type DisplayBook = Book & {
  progress: number;
  accent: string;
};

const accents: Record<string, string> = {
  'The Great Gatsby': '#315066',
  'A Game of Thrones': '#3D4657',
  'The Lord of the Rings': '#324D38',
  Frankenstein: '#5C2D37',
};

// Recommendations are static until we connect the recommendation system.
const recommendations = [
  {
    title: 'The Lord of the Rings',
    author: 'J.R.R. Tolkien',
    accent: '#324D38',
    subtitle: 'An epic journey through Middle-earth.',
  },
  {
    title: 'Dune',
    author: 'Frank Herbert',
    accent: '#8B673A',
    subtitle: 'Power, destiny, and survival on Arrakis.',
  },
  {
    title: 'A Game of Thrones',
    author: 'George R.R. Martin',
    accent: '#3D4657',
    subtitle: 'Noble houses battle for power.',
  },
];

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

// Open the selected book's details page.
function openBook(book: DisplayBook) {
  router.push({
    pathname: '/Test/book_details',
    params: {
      id: book.id,
      title: book.title,
      author: book.author ?? 'Unknown author',
      progress: String(book.progress),
    },
  });
}

export default function LibraryScreen() {
  const [shelf, setShelf] = useState<DisplayBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBooks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
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
            accent: accents[book.title] ?? '#34485B',
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

      setShelf(displayBooks);
    } catch {
      setError(
        'Could not load your books. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBooks();
  }, [loadBooks]);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>
              YOUR LIBRARY
            </Text>

            <Text style={styles.title}>
              Find your next story.
            </Text>
          </View>

          <Pressable style={styles.searchButton}>
            <Ionicons
              name="search"
              size={21}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Recommended for You
          </Text>
        </View>

        <ScrollView
          horizontal
          pagingEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          snapToInterval={width - 44}
          contentContainerStyle={styles.recommendationList}
        >
          {recommendations.map((book) => (
            <Pressable
              key={book.title}
              style={[
                styles.heroCard,
                { backgroundColor: book.accent },
              ]}
              onPress={() => {
                const match = shelf.find(
                  (item) => item.title === book.title
                );

                if (match) {
                  openBook(match);
                }
              }}
            >
              <View style={styles.heroTop}>
                <Text style={styles.recommendedLabel}>
                  ECHO RECOMMENDS
                </Text>

                <Ionicons
                  name="headset-outline"
                  size={22}
                  color="rgba(255,255,255,0.8)"
                />
              </View>

              <View style={styles.heroContent}>
                <View style={styles.heroCover}>
                  <Ionicons
                    name="book-outline"
                    size={50}
                    color="rgba(255,255,255,0.88)"
                  />
                </View>

                <View style={styles.heroInfo}>
                  <Text
                    style={styles.heroTitle}
                    numberOfLines={2}
                  >
                    {book.title}
                  </Text>

                  <Text style={styles.heroAuthor}>
                    {book.author}
                  </Text>

                  <Text
                    style={styles.heroSubtitle}
                    numberOfLines={2}
                  >
                    {book.subtitle}
                  </Text>

                  <View style={styles.viewBook}>
                    <Ionicons
                      name="play"
                      size={14}
                      color="#17131E"
                    />

                    <Text style={styles.viewBookText}>
                      View Book
                    </Text>
                  </View>
                </View>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.dots}>
          <View
            style={[
              styles.dot,
              styles.activeDot,
            ]}
          />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <View style={styles.shelfHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Your Shelf
            </Text>

            <Text style={styles.sectionSubtitle}>
              Pick up where you left off
            </Text>
          </View>

          <Text style={styles.seeAll}>
            See All
          </Text>
        </View>

        {loading ? (
          <View style={styles.message}>
            <ActivityIndicator color="#FFFFFF" />

            <Text style={styles.messageText}>
              Loading your books...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.message}>
            <Text style={styles.messageText}>
              {error}
            </Text>

            <Pressable
              onPress={() => void loadBooks()}
            >
              <Text style={styles.retry}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : shelf.length === 0 ? (
          <View style={styles.message}>
            <Text style={styles.messageText}>
              Your shelf is empty. Upload a book to get started.
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shelf}
          >
            {shelf.map((book, index) => (
              <Pressable
                key={book.id}
                style={styles.bookContainer}
                onPress={() => openBook(book)}
              >
                <View
                  style={[
                    styles.bookCover,
                    {
                      backgroundColor: book.accent,
                    },
                  ]}
                >
                  {index === 0 &&
                    book.progress > 0 && (
                      <View
                        style={styles.lastPlayedBadge}
                      >
                        <Ionicons
                          name="play"
                          size={9}
                          color="#FFFFFF"
                        />

                        <Text
                          style={styles.lastPlayedText}
                        >
                          LAST PLAYED
                        </Text>
                      </View>
                    )}

                  <Ionicons
                    name="book-outline"
                    size={42}
                    color="rgba(255,255,255,0.75)"
                  />

                  <Text
                    style={styles.coverTitle}
                    numberOfLines={3}
                  >
                    {book.title}
                  </Text>
                </View>

                <Text
                  style={styles.bookTitle}
                  numberOfLines={1}
                >
                  {book.title}
                </Text>

                <Text
                  style={styles.bookAuthor}
                  numberOfLines={1}
                >
                  {book.author ?? 'Unknown author'}
                </Text>

                {book.status !== 'ready' && (
                  <Text style={styles.bookStatus}>
                    {book.status === 'failed'
                      ? 'Failed'
                      : book.status === 'uploaded'
                        ? 'Uploaded'
                        : book.status === 'queued'
                          ? 'Queued'
                          : 'Processing'}
                  </Text>
                )}

                {book.status === 'ready' && (
                  <View style={styles.progressRow}>
                    <View
                      style={styles.progressTrack}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${book.progress}%`,
                          },
                        ]}
                      />
                    </View>

                    <Text
                      style={styles.progressText}
                    >
                      {book.progress}%
                    </Text>
                  </View>
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    paddingHorizontal: 20,
    paddingVertical: 26,
    alignItems: 'center',
    gap: 12,
  },

  messageText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
  },

  retry: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },

  bookStatus: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    marginTop: 9,
    fontWeight: '700',
    textTransform: 'capitalize',
  },

  page: {
    paddingTop: 20,
    paddingBottom: 150,
  },

  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },

  eyebrow: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 5,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: fonts.sansBold,
    fontWeight: '800',
  },

  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 13,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },

  sectionSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 3,
  },

  recommendationList: {
    paddingHorizontal: 20,
    gap: 12,
  },

  heroCard: {
    width: width - 52,
    minHeight: 245,
    borderRadius: 24,
    padding: 20,
    justifyContent: 'space-between',
  },

  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  recommendedLabel: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.7,
  },

  heroContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 18,
  },

  heroCover: {
    width: 105,
    height: 150,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.23)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  heroInfo: {
    flex: 1,
    paddingBottom: 2,
  },

  heroTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
    lineHeight: 29,
  },

  heroAuthor: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 13,
    marginTop: 5,
  },

  heroSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },

  viewBook: {
    marginTop: 15,
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 15,
    height: 36,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },

  viewBookText: {
    color: '#17131E',
    fontSize: 12,
    fontWeight: '800',
  },

  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 13,
    marginBottom: 31,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  activeDot: {
    width: 18,
    backgroundColor: '#FFFFFF',
  },

  shelfHeader: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 15,
  },

  seeAll: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '700',
  },

  shelf: {
    paddingHorizontal: 20,
    gap: 15,
  },

  bookContainer: {
    width: 145,
  },

  bookCover: {
    width: 145,
    height: 205,
    borderRadius: 13,
    padding: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },

  lastPlayedBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 10,
  },

  lastPlayedText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.6,
  },

  coverTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 14,
  },

  bookTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  bookAuthor: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    marginTop: 3,
  },

  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 9,
  },

  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },

  progressText: {
    width: 28,
    color: 'rgba(255,255,255,0.65)',
    fontSize: 10,
    fontWeight: '700',
  },
});
