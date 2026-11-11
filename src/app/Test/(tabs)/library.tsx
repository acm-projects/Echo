
import { useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen } from '../../../components/Screen';
import { CityHero } from '../../../components/night/NightSky';
import { Reveal } from '../../../components/Reveal';
import { DoodleUnderline } from '../../../components/Doodle';
import { colors, fonts, radius, scenes } from '../../../../theme';
import {
  GENRES,
  RECOMMENDED,
  booksInGenre,
  genreOf,
  type DiscoverBook,
  type GenreId,
} from '../../../data/discover';

const accent = scenes.dusk.accent;

function openBook(book: DiscoverBook) {
  router.push({
    pathname: '/Test/book_details',
    params: {
      title: book.title,
      author: book.author,
    },
  });
}

function SectionHead({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <View style={s.sectionHead}>
      <Text style={s.sectionTitle}>{title}</Text>
      <Text style={s.sectionSubtitle}>{subtitle}</Text>
    </View>
  );
}

function TapeReel({ small = false }: { small?: boolean }) {
  return (
    <View style={[s.reel, small && s.reelSmall]}>
      <View style={[s.reelInner, small && s.reelInnerSmall]}>
        <View style={s.reelCenter} />
      </View>
    </View>
  );
}

function Cassette({
  book,
  compact = false,
}: {
  book: DiscoverBook;
  compact?: boolean;
}) {
  const bookAccent = book.accent || '#B18BCA';
  const bookGenre = genreOf(book.genre);

  return (
    <Pressable
      onPress={() => openBook(book)}
      accessibilityRole="button"
      accessibilityLabel={`${book.title} by ${book.author}`}
      style={({ pressed }) => [
        compact ? s.compactCard : s.cassetteCard,
        pressed && s.pressed,
      ]}
    >
      <View
        style={[
          s.cassetteShell,
          compact && s.compactShell,
          { borderColor: bookAccent },
        ]}
      >
        <View style={s.cassetteTop}>
          <View style={s.screw} />
          <Text
            style={[
              s.cassetteBrand,
              compact && s.compactBrand,
            ]}
          >
            ECHO AUDIO
          </Text>
          <View style={s.screw} />
        </View>

        <View
          style={[
            s.paperLabel,
            compact && s.compactPaper,
          ]}
        >
          <View
            style={[
              s.labelStripe,
              { backgroundColor: bookAccent },
            ]}
          />

          <Text
            style={[
              s.cassetteTitle,
              compact && s.compactTitle,
            ]}
            numberOfLines={compact ? 2 : 2}
          >
            {book.title}
          </Text>

          <Text
            style={[
              s.cassetteAuthor,
              compact && s.compactAuthor,
            ]}
            numberOfLines={1}
          >
            {book.author}
          </Text>

          <View
            style={[
              s.tapeWindow,
              compact && s.compactWindow,
            ]}
          >
            <View style={s.tapeBand} />
            <TapeReel small={compact} />
            <TapeReel small={compact} />
          </View>

          <View style={s.cassetteInfo}>
            <Text
              style={[
                s.cassetteGenre,
                compact && s.compactGenre,
              ]}
              numberOfLines={1}
            >
              {bookGenre.label.toUpperCase()}
            </Text>
            <Text style={s.sideLabel}>A</Text>
          </View>
        </View>

        <View style={s.cassetteBottom}>
          <View style={s.screw} />
          <View style={s.bottomNotch} />
          <View style={s.screw} />
        </View>
      </View>

      {!compact && (
        <View style={s.cassetteFooter}>
          <View style={s.cassetteFooterText}>
            <Text style={s.cassetteEyebrow}>
              ECHO RECOMMENDS
            </Text>
            <Text
              style={s.cassetteAction}
              numberOfLines={1}
            >
              Discover story
            </Text>
          </View>

          <View
            style={[
              s.cassettePlay,
              { backgroundColor: bookAccent },
            ]}
          >
            <Ionicons
              name="play"
              size={17}
              color="#141023"
            />
          </View>
        </View>
      )}

      {compact && (
        <Text style={s.smallTitle} numberOfLines={2}>
          {book.title}
        </Text>
      )}
    </Pressable>
  );
}

export default function LibraryScreen() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const [genre, setGenre] = useState<GenreId>('fantasy');
  const picked = genreOf(genre);

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
        locations={[0, 0.23, 0.5, 0.75, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.18, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.page}
        onScroll={Animated.event(
          [
            {
              nativeEvent: {
                contentOffset: { y: scrollY },
              },
            },
          ],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <CityHero height={250} scrollY={scrollY}>
          <View style={s.header}>
            <Text style={s.eyebrow}>
              STORIES ARE WAITING
            </Text>

            <Text style={s.title}>Library</Text>

            <Text style={s.subtitle}>
              Find your next story.
            </Text>
          </View>
        </CityHero>

        <Pressable
          style={s.search}
          onPress={() => router.push('/Test/search')}
          accessibilityRole="search"
          accessibilityLabel="Search books, authors, genres"
        >
          <Ionicons
            name="search"
            size={18}
            color={colors.dim}
          />
          <Text style={s.searchText}>
            Search books, authors, genres…
          </Text>
        </Pressable>

        <Reveal>
          <SectionHead
            title="Recommended for You"
            subtitle="Timeless stories worth discovering"
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.rail}
            decelerationRate="fast"
            snapToInterval={292}
          >
            {RECOMMENDED.map((book) => (
              <Cassette
                key={book.title}
                book={book}
              />
            ))}
          </ScrollView>
        </Reveal>

        <Reveal index={1}>
          <SectionHead
            title="Browse by Genre"
            subtitle="What kind of story are you in the mood for?"
          />

          <View style={s.genres}>
            {GENRES.map((g) => {
              const on = g.id === genre;

              return (
                <Pressable
                  key={g.id}
                  onPress={() => setGenre(g.id)}
                  style={[
                    s.genre,
                    on && {
                      borderColor: g.color,
                      backgroundColor: 'rgba(30,23,47,0.92)',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text
                    style={[
                      s.genreLabel,
                      on && { color: colors.text },
                    ]}
                  >
                    {g.label}
                  </Text>

                  <View
                    style={[
                      s.genreIcon,
                      {
                        backgroundColor: `${g.color}${on ? '40' : '22'}`,
                      },
                    ]}
                  >
                    <Ionicons
                      name={g.icon}
                      size={18}
                      color={g.color}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Reveal>

        <Reveal index={2}>
          <View style={s.sectionHead}>
            <Text style={s.sectionTitle}>
              {picked.label} Books
            </Text>

            <DoodleUnderline
              width={110}
              color={picked.color}
              seed={picked.label}
              delay={150}
              key={picked.id}
            />

            <Text style={s.sectionSubtitle}>
              {booksInGenre(genre).length} stories to explore
            </Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.rail}
          >
            {booksInGenre(genre).map((book) => (
              <Cassette
                key={book.title}
                book={book}
                compact
              />
            ))}
          </ScrollView>
        </Reveal>

        <View style={s.footer}>
          <Ionicons
            name="moon-outline"
            size={14}
            color={colors.faint}
          />
          <Text style={s.footerText}>
            Every good story starts somewhere.
          </Text>
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: {
    paddingBottom: 200,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 22,
  },

  eyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 11,
    letterSpacing: 2.5,
    color: accent,
  },

  title: {
    fontFamily: fonts.display,
    fontSize: 40,
    letterSpacing: -0.5,
    color: '#FFFFFF',
    marginTop: 4,
  },

  subtitle: {
    fontFamily: fonts.serifItalic,
    fontSize: 16,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },

  search: {
    marginHorizontal: 20,
    marginTop: 4,
    marginBottom: 26,
    height: 50,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(12,10,29,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(218,194,240,0.16)',
  },

  searchText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.faint,
  },

  sectionHead: {
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },

  sectionTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: '#FFFFFF',
  },

  sectionSubtitle: {
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.dim,
    marginTop: 2,
  },

  rail: {
    paddingHorizontal: 20,
    gap: 12,
    paddingBottom: 24,
  },

  cassetteCard: {
    width: 280,
    borderRadius: 19,
    backgroundColor: 'rgba(12,10,29,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(218,194,240,0.20)',
    padding: 12,
  },

  pressed: {
    opacity: 0.8,
    transform: [{ translateY: -3 }],
  },

  cassetteShell: {
    height: 192,
    borderWidth: 2,
    borderRadius: 13,
    backgroundColor: '#252039',
    paddingHorizontal: 12,
    paddingVertical: 9,
    justifyContent: 'space-between',
  },

  cassetteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  screw: {
    width: 7,
    height: 7,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#8F829F',
    backgroundColor: '#43384D',
  },

  cassetteBrand: {
    fontFamily: fonts.sansBold,
    color: '#CDB9DE',
    fontSize: 9,
    letterSpacing: 2.3,
  },

  paperLabel: {
    backgroundColor: '#EFDFEA',
    borderRadius: 7,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 7,
    overflow: 'hidden',
  },

  labelStripe: {
    height: 5,
    borderRadius: 3,
    marginBottom: 7,
  },

  cassetteTitle: {
    fontFamily: fonts.serif,
    fontSize: 17,
    lineHeight: 20,
    color: '#271A33',
    minHeight: 40,
  },

  cassetteAuthor: {
    fontFamily: fonts.serifItalic,
    color: '#76617E',
    fontSize: 11,
    marginTop: 2,
    marginBottom: 7,
  },

  tapeWindow: {
    height: 41,
    backgroundColor: '#171222',
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    overflow: 'hidden',
  },

  tapeBand: {
    position: 'absolute',
    left: '18%',
    right: '18%',
    height: 18,
    borderRadius: 4,
    backgroundColor: '#3E324B',
  },

  reel: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#51435F',
    borderWidth: 4,
    borderColor: '#30253D',
    alignItems: 'center',
    justifyContent: 'center',
  },

  reelInner: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#D7C7DF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  reelCenter: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#3A294A',
  },

  cassetteInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 5,
  },

  cassetteGenre: {
    fontFamily: fonts.sansBold,
    fontSize: 8,
    letterSpacing: 0.7,
    color: '#624F6C',
    flex: 1,
  },

  sideLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 10,
    color: '#624F6C',
    marginLeft: 5,
  },

  cassetteBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  bottomNotch: {
    height: 5,
    width: 65,
    borderRadius: 3,
    backgroundColor: '#5A496C',
  },

  cassetteFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 12,
    paddingBottom: 2,
  },

  cassetteFooterText: {
    flex: 1,
  },

  cassetteEyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 9,
    letterSpacing: 1.7,
    color: '#A99AB8',
  },

  cassetteAction: {
    fontFamily: fonts.serif,
    fontSize: 15,
    color: '#F1E5FB',
    marginTop: 4,
  },

  cassettePlay: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },

  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 24,
  },

  genre: {
    width: '48%',
    flexGrow: 1,
    height: 62,
    borderRadius: radius.md,
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(15,12,32,0.86)',
    borderWidth: 1.5,
    borderColor: 'rgba(218,194,240,0.16)',
  },

  genreLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.dim,
    flexShrink: 1,
  },

  genreIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  compactCard: {
    width: 176,
    gap: 10,
  },

  compactShell: {
    height: 154,
    paddingHorizontal: 7,
    paddingVertical: 7,
    borderRadius: 11,
  },

  compactBrand: {
    fontSize: 7,
    letterSpacing: 1.2,
  },

  compactPaper: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },

  compactTitle: {
    fontSize: 12,
    lineHeight: 14,
    minHeight: 28,
  },

  compactAuthor: {
    fontSize: 9,
    marginBottom: 5,
  },

  compactWindow: {
    height: 29,
  },

  reelSmall: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 3,
  },

  reelInnerSmall: {
    width: 13,
    height: 13,
    borderRadius: 7,
  },

  compactGenre: {
    fontSize: 7,
    letterSpacing: 0,
  },

  smallTitle: {
    fontFamily: fonts.serif,
    fontSize: 14,
    lineHeight: 18,
    color: '#FFFFFF',
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },

  footerText: {
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    color: colors.faint,
  },
});
