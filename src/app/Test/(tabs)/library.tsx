import { useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../../../components/Screen';
import { CityHero } from '../../../components/night/NightSky';
import { Reveal } from '../../../components/Reveal';
import { Jacket } from '../../../components/Jacket';
import { DoodleUnderline } from '../../../components/Doodle';
import { colors, fonts, radius, scenes } from '../../../../theme';
import { GENRES, RECOMMENDED, booksInGenre, genreOf, type DiscoverBook, type GenreId } from '../../../data/discover';

const accent = scenes.dusk.accent;

function openBook(book: DiscoverBook) {
  router.push({ pathname: '/Test/book_details', params: { title: book.title, author: book.author } });
}

function SectionHead({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

// Discovery: what to listen to next. The reader's own books live on the Your Shelf tab.
export default function LibraryScreen() {
  // Drives the layered city: each skyline sinks at its own speed as you scroll.
  const scrollY = useRef(new Animated.Value(0)).current;
  const [genre, setGenre] = useState<GenreId>('fantasy');
  const picked = genreOf(genre);

  return (
    <Screen scene="dusk" city={false} lanterns>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.page}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <CityHero height={250} scrollY={scrollY}>
          <View style={s.header}>
            <Text style={s.eyebrow}>STORIES ARE WAITING</Text>
            <Text style={s.title}>Library</Text>
            <Text style={s.subtitle}>Find your next story.</Text>
          </View>
        </CityHero>

        <Pressable style={s.search} onPress={() => router.push('/Test/search')} accessibilityRole="search" accessibilityLabel="Search books, authors, genres">
          <Ionicons name="search" size={18} color={colors.dim} />
          <Text style={s.searchText}>Search books, authors, genres…</Text>
        </Pressable>

        <Reveal>
          <SectionHead title="Recommended for You" subtitle="Timeless stories worth discovering" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail} decelerationRate="fast" snapToInterval={292}>
            {RECOMMENDED.map((book) => (
              <Pressable key={book.title} style={s.recommend} onPress={() => openBook(book)} accessibilityRole="button">
                <Jacket title={book.title} author={book.author} accent={book.accent} width={92} />
                <View style={{ flex: 1, justifyContent: 'space-between' }}>
                  <View>
                    <Text style={s.label}>ECHO RECOMMENDS</Text>
                    <Text style={s.bookTitle} numberOfLines={2}>{book.title}</Text>
                    <Text style={s.bookAuthor}>{book.author}</Text>
                    <Text style={[s.genreTag, { color: genreOf(book.genre).color }]}>{genreOf(book.genre).label}</Text>
                  </View>
                  <View style={s.link}>
                    <Text style={s.linkText}>View book</Text>
                    <Ionicons name="arrow-forward" size={14} color={accent} />
                  </View>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </Reveal>

        <Reveal index={1}>
          <SectionHead title="Browse by Genre" subtitle="What kind of story are you in the mood for?" />
          <View style={s.genres}>
            {GENRES.map((g) => {
              const on = g.id === genre;
              return (
                <Pressable key={g.id} onPress={() => setGenre(g.id)} style={[s.genre, on && { borderColor: g.color }]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                  <Text style={[s.genreLabel, on && { color: colors.text }]}>{g.label}</Text>
                  <View style={[s.genreIcon, { backgroundColor: `${g.color}${on ? '40' : '22'}` }]}>
                    <Ionicons name={g.icon} size={18} color={g.color} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Reveal>

        <Reveal index={2}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>{picked.label} Books</Text>
            <DoodleUnderline width={110} color={picked.color} seed={picked.label} delay={150} key={picked.id} />
            <Text style={s.sectionSubtitle}>{booksInGenre(genre).length} stories to explore</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail}>
            {booksInGenre(genre).map((book) => (
              <Pressable key={book.title} onPress={() => openBook(book)} style={({ pressed }) => [s.shelfBook, pressed && { transform: [{ translateY: -4 }] }]} accessibilityRole="button" accessibilityLabel={`${book.title} by ${book.author}`}>
                <Jacket title={book.title} author={book.author} accent={book.accent} width={104} />
                <Text style={s.smallTitle} numberOfLines={2}>{book.title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Reveal>

        <View style={s.footer}>
          <Ionicons name="moon-outline" size={14} color={colors.faint} />
          <Text style={s.footerText}>Every good story starts somewhere.</Text>
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { paddingBottom: 200 },
  header: { paddingHorizontal: 20, paddingTop: 22 },
  eyebrow: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 2.5, color: accent },
  title: { fontFamily: fonts.display, fontSize: 40, letterSpacing: -0.5, color: '#FFFFFF', marginTop: 4 },
  subtitle: { fontFamily: fonts.serifItalic, fontSize: 16, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  search: { marginHorizontal: 20, marginTop: 4, marginBottom: 26, height: 50, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  searchText: { fontFamily: fonts.sans, fontSize: 15, color: colors.faint },
  sectionHead: { paddingHorizontal: 20, marginBottom: 12, marginTop: 8 },
  sectionTitle: { fontFamily: fonts.display, fontSize: 22, color: '#FFFFFF' },
  sectionSubtitle: { fontFamily: fonts.sans, fontSize: 13, color: colors.dim, marginTop: 2 },
  rail: { paddingHorizontal: 20, gap: 12, paddingBottom: 24 },
  recommend: { width: 280, flexDirection: 'row', gap: 14, padding: 12, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  label: { fontFamily: fonts.sansBold, fontSize: 9, letterSpacing: 2, color: colors.faint, marginBottom: 6 },
  bookTitle: { fontFamily: fonts.serif, fontSize: 17, lineHeight: 21, color: '#FFFFFF' },
  bookAuthor: { fontFamily: fonts.serifItalic, fontSize: 13, color: colors.dim, marginTop: 2 },
  genreTag: { fontFamily: fonts.sansBold, fontSize: 11, marginTop: 6 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', borderBottomWidth: 1.5, borderBottomColor: accent, paddingBottom: 1 },
  linkText: { fontFamily: fonts.sansBold, fontSize: 13, color: accent },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, marginBottom: 24 },
  genre: { width: '48%', flexGrow: 1, height: 62, borderRadius: radius.md, paddingLeft: 14, paddingRight: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.border },
  genreLabel: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.dim },
  genreIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  shelfBook: { width: 104, gap: 8 },
  smallTitle: { fontFamily: fonts.serif, fontSize: 14, lineHeight: 18, color: '#FFFFFF' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  footerText: { fontFamily: fonts.serifItalic, fontSize: 13, color: colors.faint },
});
