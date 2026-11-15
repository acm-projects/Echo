
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen } from '../../../components/Screen';
import {
  GENRES,
  booksInGenre,
  type GenreId,
} from '../../../data/discover';
import { colors, fonts } from '../../../../theme';

const DESCRIPTIONS: Record<GenreId, string> = {
  fantasy: 'Step into worlds beyond imagination.',
  classics: 'Stories that stand the test of time.',
  romance: 'Stories of love, connection, and longing.',
  mystery: 'Follow the clues and uncover hidden truths.',
  horror: 'Explore the darker side of storytelling.',
  adventure: 'Journey into the unknown.',
};

export default function GenreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const genre = GENRES.find((item) => item.id === id);

  if (!genre) {
    return (
      <Screen scene="dusk" city={false}>
        <View style={s.empty}>
          <Text style={s.heading}>Collection not found</Text>

          <Pressable onPress={() => router.back()}>
            <Text style={s.backText}>Return to Library</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  const books = booksInGenre(genre.id);

  return (
    <Screen scene="dusk" city={false} lanterns>
      <LinearGradient
        pointerEvents="none"
        colors={[
          '#0C0D21',
          '#15132B',
          '#211B36',
          '#30213E',
          '#3B2946',
        ]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.page}
      >
        <Pressable
          onPress={() => router.back()}
          style={s.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back to Library"
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color="#F3E9FF"
          />

          <Text style={s.backText}>Library</Text>
        </Pressable>

        <View style={s.header}>
          <View
            style={[
              s.headerIcon,
              {
                backgroundColor: `${genre.color}20`,
                borderColor: `${genre.color}55`,
              },
            ]}
          >
            <Ionicons
              name={genre.icon}
              size={30}
              color={genre.color}
            />
          </View>

          <Text
            style={[
              s.eyebrow,
              { color: genre.color },
            ]}
          >
            ECHO COLLECTION
          </Text>

          <Text style={s.heading}>
            {genre.label}
          </Text>

          <Text style={s.description}>
            {DESCRIPTIONS[genre.id]}
          </Text>

          <View
            style={[
              s.accentLine,
              { backgroundColor: genre.color },
            ]}
          />
        </View>

        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>
            Explore the Collection
          </Text>

          <Text style={s.count}>
            {books.length} {books.length === 1 ? 'story' : 'stories'}
          </Text>
        </View>

        <View style={s.bookList}>
          {books.map((book, index) => (
            <Pressable
              key={`${book.title}-${index}`}
              onPress={() =>
                router.push({
                  pathname: '/Test/book_details',
                  params: {
                    title: book.title,
                    author: book.author,
                  },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`${book.title} by ${book.author}`}
              style={({ pressed }) => [
                s.bookCard,
                pressed && s.pressed,
              ]}
            >
              <View
                style={[
                  s.bookIcon,
                  { borderColor: `${genre.color}66` },
                ]}
              >
                <Ionicons
                  name="book-outline"
                  size={26}
                  color={genre.color}
                />
              </View>

              <View style={s.bookInfo}>
                <Text style={s.bookEyebrow}>
                  ECHO AUDIOBOOK
                </Text>

                <Text
                  style={s.bookTitle}
                  numberOfLines={2}
                >
                  {book.title}
                </Text>

                <Text
                  style={s.bookAuthor}
                  numberOfLines={1}
                >
                  {book.author}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={19}
                color={colors.dim}
              />
            </Pressable>
          ))}
        </View>

        {books.length === 0 && (
          <View style={s.emptyBooks}>
            <Ionicons
              name="library-outline"
              size={30}
              color={genre.color}
            />

            <Text style={s.emptyBooksText}>
              More stories are coming to this collection.
            </Text>
          </View>
        )}

        <View style={s.footer}>
          <Ionicons
            name="moon-outline"
            size={14}
            color={colors.faint}
          />

          <Text style={s.footerText}>
            A new story is always waiting.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 32,
    alignSelf: 'flex-start',
  },
  backText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: '#D6C5E4',
  },
  header: {
    marginBottom: 32,
  },
  headerIcon: {
    width: 66,
    height: 66,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  eyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    letterSpacing: 2.2,
    marginBottom: 10,
  },
  heading: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 46,
    color: '#F3E9FF',
  },
  description: {
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    lineHeight: 24,
    color: '#D3C0DD',
    marginTop: 10,
  },
  accentLine: {
    width: 54,
    height: 3,
    borderRadius: 2,
    marginTop: 22,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
    flex: 1,
  },
  count: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.dim,
  },
  bookList: {
    gap: 12,
  },
  bookCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 14,
    minHeight: 104,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(218,194,240,0.15)',
    backgroundColor: 'rgba(22,15,41,0.9)',
  },
  pressed: {
    opacity: 0.8,
  },
  bookIcon: {
    width: 62,
    height: 72,
    borderRadius: 11,
    borderWidth: 1,
    backgroundColor: 'rgba(41,29,61,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bookInfo: {
    flex: 1,
    gap: 4,
  },
  bookEyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.3,
    color: '#AFA0C5',
  },
  bookTitle: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 22,
    color: '#F3E9FF',
  },
  bookAuthor: {
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    color: '#BBAACD',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 30,
  },
  emptyBooks: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 14,
  },
  emptyBooksText: {
    fontFamily: fonts.serifItalic,
    fontSize: 15,
    color: colors.dim,
    textAlign: 'center',
  },
  footer: {
    marginTop: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  footerText: {
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    color: colors.faint,
  },
});
