
import { useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { Screen } from '../../../components/Screen';
import { CityHero } from '../../../components/night/NightSky';
import { Reveal } from '../../../components/Reveal';
import { CassetteCard } from '../../../components/CassetteCard';
import { colors, fonts, radius, scenes } from '../../../../theme';
import {
  GENRES,
  RECOMMENDED,
  type GenreId,
} from '../../../data/discover';

const accent = scenes.dusk.accent;

const GENRE_COPY: Record<GenreId, string> = {
  fantasy: 'Beyond reality',
  classics: 'Timeless stories',
  romance: 'Love and longing',
  mystery: 'Hidden truths',
  horror: 'After dark',
  adventure: 'Into the unknown',
};

function openGenre(id: GenreId) {
  router.push({
    pathname: '/Test/genre/[id]',
    params: { id },
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

function GenreCard({
  genre,
  compact,
}: {
  genre: (typeof GENRES)[number];
  compact: boolean;
}) {
  return (
    <Pressable
      onPress={() => openGenre(genre.id)}
      accessibilityRole="button"
      accessibilityLabel={`Explore ${genre.label}`}
      style={({ pressed }) => [
        s.genreCard,
        compact && s.genreCardCompact,
        pressed && s.genrePressed,
      ]}
    >
      <View
        pointerEvents="none"
        style={[
          s.genreGlow,
          { backgroundColor: `${genre.color}12` },
        ]}
      />

      <View
        style={[
          s.genreIcon,
          compact && s.genreIconCompact,
          {
            backgroundColor: `${genre.color}20`,
            borderColor: `${genre.color}55`,
          },
        ]}
      >
        <Ionicons
          name={genre.icon}
          size={compact ? 20 : 26}
          color={genre.color}
        />
      </View>

      <View style={s.genreText}>
        <Text
          style={[
            s.genreEyebrow,
            compact && s.genreEyebrowCompact,
            { color: genre.color },
          ]}
          numberOfLines={1}
        >
          EXPLORE COLLECTION
        </Text>

        <Text
          style={[
            s.genreTitle,
            compact && s.genreTitleCompact,
          ]}
          numberOfLines={2}
        >
          {genre.label}
        </Text>

        <Text
          style={[
            s.genreDescription,
            compact && s.genreDescriptionCompact,
          ]}
          numberOfLines={2}
        >
          {GENRE_COPY[genre.id]}
        </Text>
      </View>

      <View
        style={[
          s.genreBottom,
          compact && s.genreBottomCompact,
        ]}
      >
        <View
          style={[
            s.genreLine,
            { backgroundColor: genre.color },
          ]}
        />

        <Ionicons
          name="arrow-forward"
          size={compact ? 15 : 17}
          color={genre.color}
        />
      </View>
    </Pressable>
  );
}

export default function LibraryScreen() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();

  const contentWidth = Math.min(width, 1100);
  const horizontalPadding = 20;
  const cardGap = 14;

  const columns =
    width < 600 ? 2 : width < 900 ? 3 : 4;

  const genreCardWidth = Math.max(
    0,
    (contentWidth -
      horizontalPadding * 2 -
      cardGap * (columns - 1)) /
      columns
  );

  const compact = genreCardWidth < 190;

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
        <View style={s.content}>
          <CityHero
            height={250}
            scrollY={scrollY}
          >
            <View style={s.header}>
              <Text style={s.eyebrow}>
                STORIES ARE WAITING
              </Text>

              <Text style={s.title}>
                Library
              </Text>

              <Text style={s.subtitle}>
                Find your next story.
              </Text>
            </View>
          </CityHero>

          <Pressable
            style={s.search}
            onPress={() => router.push('/Test/search')}
            accessibilityRole="button"
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
                <CassetteCard
                  key={book.title}
                  book={book}
                />
              ))}
            </ScrollView>
          </Reveal>

          <Reveal index={1}>
            <SectionHead
              title="Browse by Genre"
              subtitle="Find a collection that speaks to you"
            />

            <View style={s.genres}>
              {GENRES.map((genre) => (
                <View
                  key={genre.id}
                  style={{ width: genreCardWidth }}
                >
                  <GenreCard
                    genre={genre}
                    compact={compact}
                  />
                </View>
              ))}
            </View>
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
        </View>
      </Animated.ScrollView>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: {
    paddingBottom: 200,
  },

  content: {
    width: '100%',
    maxWidth: 1100,
    alignSelf: 'center',
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
    flexShrink: 1,
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

  genres: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 14,
    rowGap: 14,
    paddingHorizontal: 20,
    marginBottom: 30,
    width: '100%',
    alignItems: 'flex-start',
  },

  genreCard: {
    width: '100%',
    aspectRatio: 0.95,
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(29,20,49,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(218,194,240,0.18)',
    overflow: 'hidden',
    justifyContent: 'space-between',
  },

  genreCardCompact: {
    padding: 11,
  },

  genrePressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },

  genreGlow: {
    position: 'absolute',
    width: 115,
    height: 115,
    borderRadius: 58,
    top: -50,
    right: -40,
  },

  genreIcon: {
    width: 49,
    height: 49,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  genreIconCompact: {
    width: 38,
    height: 38,
    borderRadius: 11,
    marginBottom: 5,
  },

  genreText: {
    flex: 1,
    justifyContent: 'center',
  },

  genreEyebrow: {
    fontFamily: fonts.sansBold,
    fontSize: 8,
    letterSpacing: 1,
    marginBottom: 7,
  },

  genreEyebrowCompact: {
    fontSize: 7,
    letterSpacing: 0.4,
    marginBottom: 3,
  },

  genreTitle: {
    fontFamily: fonts.serif,
    fontSize: 19,
    lineHeight: 23,
    color: '#F3E9FF',
  },

  genreTitleCompact: {
    fontSize: 16,
    lineHeight: 19,
  },

  genreDescription: {
    fontFamily: fonts.serifItalic,
    fontSize: 12,
    lineHeight: 17,
    color: '#BDAEC9',
    marginTop: 5,
  },

  genreDescriptionCompact: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: 3,
  },

  genreBottom: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  genreBottomCompact: {
    marginTop: 6,
  },

  genreLine: {
    width: 34,
    height: 2,
    borderRadius: 2,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 20,
  },

  footerText: {
    fontFamily: fonts.serifItalic,
    fontSize: 13,
    color: colors.faint,
    textAlign: 'center',
  },
});
