
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../../../components/Screen';
import { CityHero } from '../../../components/night/NightSky';
import { colors, fonts, radius, scenes } from '../../../../theme';
import { Reveal } from '../../../components/Reveal';
import { EmptyState } from '../../../components/EmptyState';
import { DoodleUnderline } from '../../../components/Doodle';
import { useReducedMotion } from '../../../components/night/NightSky';
import {
  getMyBooks,
  getMyProgress,
  getBookChapters,
} from '../../../data';
import type {
  Book,
  Chapter,
  UserProgress,
} from '../../../data/types';

type DisplayBook = Book & {
  progress: number;
  accent: string;
};

const accents: Record<string, string> = {
  'The Great Gatsby': '#1F5A6B',
  'A Game of Thrones': '#6B2E2E',
  'The Lord of the Rings': '#3E5A2E',
  Frankenstein: '#2E3A5C',
  Sherlock: '#7A5A1F',
};

// Recommendations are static until we connect the recommendation system.
const recommendations = [
  {
    title: 'The Lord of the Rings',
    author: 'J.R.R. Tolkien',
    accent: '#3E5A2E',
    subtitle: 'An epic journey through Middle-earth, with a fellowship of voices to tell apart.',
  },
  {
    title: 'Dune',
    author: 'Frank Herbert',
    accent: '#9A5A24',
    subtitle: 'Power, destiny and survival on a desert planet. Best heard with the lights low.',
  },
  {
    title: 'A Game of Thrones',
    author: 'George R.R. Martin',
    accent: '#6B2E2E',
    subtitle: 'Noble houses scheme for a throne. Dozens of characters, each with a voice of their own.',
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
  const [pickIndex, setPickIndex] = useState(0);
  // Drives the layered city: each skyline sinks at its own speed as you scroll.
  const scrollY = useRef(new Animated.Value(0)).current;
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

  const pick = recommendations[pickIndex];
  const lastPlayed = shelf.find((book) => book.progress > 0 && book.progress < 100);

  return (
    <Screen scene="dusk" city={false}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <CityHero height={280} scrollY={scrollY}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{greeting()}</Text>
              <Text style={styles.title}>What shall we{'\n'}listen to {isNight() ? 'tonight' : 'today'}?</Text>
            </View>
            <Pressable style={styles.searchButton} onPress={() => router.push('/Test/search')} accessibilityRole="button" accessibilityLabel="Search">
              <Ionicons name="search" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </CityHero>

        {/* Tonight's pick: one book at a time, like a bookseller's shelf talker, not a carousel */}
        <Reveal style={styles.pick}>
          <Text style={styles.label}>{isNight() ? "TONIGHT'S PICK" : "TODAY'S PICK"}</Text>
          <View style={styles.pickRow}>
            <View style={[styles.jacket, { backgroundColor: pick.accent }]}>
              <View style={styles.jacketRule}>
                <Text style={styles.jacketTitle} numberOfLines={4}>{pick.title}</Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.pickTitle}>{pick.title}</Text>
              <Text style={styles.pickAuthor}>{pick.author}</Text>
              <Text style={styles.pickBlurb}>{pick.subtitle}</Text>
              <Pressable onPress={() => router.push({ pathname: '/Test/book_details', params: { title: pick.title, author: pick.author } })} style={styles.pickLink} accessibilityRole="button">
                <Text style={styles.pickLinkText}>Have a listen</Text>
                <Ionicons name="arrow-forward" size={16} color={scenes.dusk.accent} />
              </Pressable>
            </View>
          </View>
          <View style={styles.pickNav}>
            <Text style={styles.pickCount}>{pickIndex + 1} of {recommendations.length}</Text>
            <Pressable onPress={() => setPickIndex((pickIndex + recommendations.length - 1) % recommendations.length)} hitSlop={10} accessibilityLabel="Previous pick">
              <Ionicons name="chevron-back" size={18} color="rgba(255,255,255,0.6)" />
            </Pressable>
            <Pressable onPress={() => setPickIndex((pickIndex + 1) % recommendations.length)} hitSlop={10} accessibilityLabel="Next pick">
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
            </Pressable>
          </View>
        </Reveal>

        <Reveal index={1} style={styles.shelfSection}>
          <View style={styles.shelfHead}>
            <View>
              <Text style={styles.sectionTitle}>Your shelf</Text>
              <DoodleUnderline width={118} color={scenes.dusk.accent} seed="Your shelf" delay={500} />
            </View>
            {lastPlayed && <Text style={styles.shelfHint}>Bookmark in {lastPlayed.title}</Text>}
          </View>

          {loading ? (
            <ActivityIndicator color="#FFFFFF" style={{ marginVertical: 60 }} />
          ) : error ? (
            <View style={styles.message}>
              <Text style={styles.messageText}>{error}</Text>
              <Pressable onPress={() => void loadBooks()} accessibilityRole="button">
                <Text style={styles.retry}>Try again</Text>
              </Pressable>
            </View>
          ) : shelf.length === 0 ? (
            <EmptyState title="An empty shelf, for now" body="Upload a book and Echo will give every character a voice." action="Upload a book" onAction={() => router.navigate('/Test/upload')} />
          ) : (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.spines}>
                {shelf.map((book, i) => <Spine key={book.id} book={book} index={i} onPress={() => openBook(book)} />)}
              </ScrollView>
              <View style={styles.plank} />
              <View style={styles.plankShadow} />
            </>
          )}
        </Reveal>
      </Animated.ScrollView>
    </Screen>
  );
}

function isNight() {
  const hour = new Date().getHours();
  return hour >= 17 || hour < 5;
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Up late?';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

// A book standing on the shelf. Width and height vary a little per title so the shelf looks collected, not generated.
// A ribbon hangs from the top of books you're partway through; its length shows how far in you are.
function Spine({ book, index, onPress }: { book: DisplayBook; index: number; onPress: () => void }) {
  const seed = [...book.title].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const w = 46 + (seed % 4) * 6;
  const h = 168 + (seed % 5) * 9;
  const reduced = useReducedMotion();
  // Books drop onto the shelf one after another and wobble as they settle; ribbons sway like they were just touched.
  const settle = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    Animated.spring(settle, { toValue: 1, delay: 180 + index * 110, friction: 5, tension: 70, useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 1800 + (seed % 5) * 200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: -1, duration: 1800 + (seed % 5) * 200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [index, reduced, seed, settle, sway]);
  const lean = (seed % 3) - 1;
  return (
    <Animated.View
      style={{
        opacity: settle.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: settle.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] }) },
          { rotate: settle.interpolate({ inputRange: [0, 1], outputRange: [`${lean * 6}deg`, '0deg'] }) },
        ],
      }}
    >
      <Pressable onPress={onPress} style={({ pressed }) => [{ width: w, height: h, marginTop: 200 - h }, pressed && { transform: [{ translateY: -8 }, { rotate: `${lean * 2}deg` }] }]} accessibilityRole="button" accessibilityLabel={`${book.title}, ${book.progress}% listened`}>
        <View style={[styles.spine, { backgroundColor: book.accent }]}>
          <View style={styles.spineBand} />
          <View style={[styles.spineTextBox, { width: h - 40, height: w, left: (w - (h - 40)) / 2, top: (h - w) / 2 }]}>
            <Text style={styles.spineTitle} numberOfLines={1}>{book.title}</Text>
          </View>
          <View style={[styles.spineBand, { top: undefined, bottom: 12 }]} />
        </View>
        {book.progress > 0 && book.progress < 100 && (
          <Animated.View style={[styles.ribbon, { height: 18 + book.progress * 0.5, transformOrigin: 'top', transform: [{ rotate: sway.interpolate({ inputRange: [-1, 1], outputRange: ['-5deg', '5deg'] }) }] }]} />
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: 170 },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 22 },
  greeting: { fontFamily: fonts.serifItalic, fontSize: 17, color: scenes.dusk.accent },
  title: { fontFamily: fonts.display, fontSize: 32, lineHeight: 36, letterSpacing: -0.5, color: '#FFFFFF', marginTop: 4 },
  searchButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  label: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 2.5, color: 'rgba(255,255,255,0.6)', marginBottom: 14 },
  pick: { paddingHorizontal: 20, marginTop: 6 },
  pickRow: { flexDirection: 'row', gap: 18 },
  jacket: { width: 112, height: 160, borderRadius: radius.sm, padding: 7 },
  jacketRule: { flex: 1, borderWidth: 1, borderColor: 'rgba(255,233,200,0.5)', padding: 9, justifyContent: 'flex-end' },
  jacketTitle: { fontFamily: fonts.display, fontSize: 15, lineHeight: 17, color: '#FFE9C8' },
  pickTitle: { fontFamily: fonts.serif, fontSize: 22, lineHeight: 26, color: '#FFFFFF' },
  pickAuthor: { fontFamily: fonts.serifItalic, fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: 3 },
  pickBlurb: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.75)', marginTop: 10 },
  pickLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'flex-start', borderBottomWidth: 1.5, borderBottomColor: scenes.dusk.accent, paddingBottom: 2 },
  pickLinkText: { fontFamily: fonts.sansBold, fontSize: 15, color: scenes.dusk.accent },
  pickNav: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.2)' },
  pickCount: { flex: 1, fontFamily: fonts.sansMd, fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  shelfSection: { marginTop: 34 },
  shelfHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 6 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 24, color: '#FFFFFF' },
  shelfHint: { fontFamily: fonts.serifItalic, fontSize: 13, color: 'rgba(255,255,255,0.6)' },
  spines: { paddingHorizontal: 20, gap: 4, alignItems: 'flex-end' },
  spine: { flex: 1, borderTopLeftRadius: 3, borderTopRightRadius: 3, overflow: 'hidden' },
  spineBand: { position: 'absolute', top: 12, left: 0, right: 0, height: 2, backgroundColor: 'rgba(255,233,200,0.45)' },
  spineTextBox: { position: 'absolute', alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-90deg' }] },
  spineTitle: { fontFamily: fonts.serif, fontSize: 14, color: '#FFE9C8' },
  ribbon: { position: 'absolute', top: 0, right: 8, width: 7, backgroundColor: colors.gold },
  plank: { height: 10, marginHorizontal: 12, backgroundColor: '#4A2E22', borderRadius: 2 },
  plankShadow: { height: 8, marginHorizontal: 18, backgroundColor: 'rgba(0,0,0,0.3)' },
  message: { paddingHorizontal: 20, paddingVertical: 30, gap: 10 },
  messageText: { fontFamily: fonts.sans, fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  retry: { fontFamily: fonts.sansBold, fontSize: 14, color: scenes.dusk.accent },
});
