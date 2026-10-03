import {
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
import { colors, fonts } from '../../../theme';

const { width } = Dimensions.get('window');

type Book = {
  id: string;
  title: string;
  author: string;
  progress: number;
  accent: string;
  subtitle?: string;
};

const recommendations: Book[] = [
  {
    id: 'lotr',
    title: 'The Lord of the Rings',
    author: 'J.R.R. Tolkien',
    progress: 0,
    accent: '#324D38',
    subtitle: 'An epic journey through Middle-earth.',
  },
  {
    id: 'dune',
    title: 'Dune',
    author: 'Frank Herbert',
    progress: 72,
    accent: '#8B673A',
    subtitle: 'Power, destiny, and survival on Arrakis.',
  },
  {
    id: 'game-of-thrones',
    title: 'A Game of Thrones',
    author: 'George R.R. Martin',
    progress: 0,
    accent: '#3D4657',
    subtitle: 'Noble houses battle for power.',
  },
];

// First item = most recently listened.
// Remaining books = most recently added first.
const shelf: Book[] = [
  {
    id: 'night-circus',
    title: 'The Night Circus',
    author: 'Erin Morgenstern',
    progress: 42,
    accent: '#45305F',
  },
  {
    id: 'dune',
    title: 'Dune',
    author: 'Frank Herbert',
    progress: 72,
    accent: '#8B673A',
  },
  {
    id: 'great-gatsby',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    progress: 31,
    accent: '#315066',
  },
  {
    id: 'dracula',
    title: 'Dracula',
    author: 'Bram Stoker',
    progress: 8,
    accent: '#5C2D37',
  },
];

function openBook(book: Book) {
  router.push({
    pathname: '/Test/book-details',
    params: {
      id: book.id,
      title: book.title,
      author: book.author,
      progress: String(book.progress),
    },
  });
}

export default function LibraryScreen() {
  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>YOUR LIBRARY</Text>
            <Text style={styles.title}>Find your next story.</Text>
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
              key={book.id}
              style={[
                styles.heroCard,
                { backgroundColor: book.accent },
              ]}
              onPress={() => openBook(book)}
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
          <View style={[styles.dot, styles.activeDot]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>

        <View style={styles.shelfHeader}>
          <View>
            <Text style={styles.sectionTitle}>Your Shelf</Text>
            <Text style={styles.sectionSubtitle}>
              Pick up where you left off
            </Text>
          </View>

          <Text style={styles.seeAll}>See All</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shelf}
        >
          {shelf.map((book, index) => (
            <Pressable
              key={`${book.id}-${index}`}
              style={styles.bookContainer}
              onPress={() => openBook(book)}
            >
              <View
                style={[
                  styles.bookCover,
                  { backgroundColor: book.accent },
                ]}
              >
                {index === 0 && (
                  <View style={styles.lastPlayedBadge}>
                    <Ionicons
                      name="play"
                      size={9}
                      color="#FFFFFF"
                    />
                    <Text style={styles.lastPlayedText}>
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
                {book.author}
              </Text>

              <View style={styles.progressRow}>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${book.progress}%` },
                    ]}
                  />
                </View>

                <Text style={styles.progressText}>
                  {book.progress}%
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: fonts?.bold,
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