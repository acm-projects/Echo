import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { fonts } from '../../../theme';

const characters = [
  {
    id: 'character-1',
    name: 'Main Character',
    role: 'Primary character',
    connection: 'Connections will appear here',
  },
  {
    id: 'character-2',
    name: 'Character Two',
    role: 'Supporting character',
    connection: 'Relationships will appear here',
  },
  {
    id: 'character-3',
    name: 'Character Three',
    role: 'Supporting character',
    connection: 'Events will appear here',
  },
];

export default function BookDetailsScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    title?: string;
    author?: string;
    progress?: string;
  }>();

  const title = params.title ?? 'Book';
  const author = params.author ?? 'Unknown Author';

  const parsedProgress = Number(params.progress ?? 0);

  const progress = Number.isFinite(parsedProgress)
    ? Math.min(100, Math.max(0, parsedProgress))
    : 0;

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.page}
      >
        <View style={styles.topBar}>
          <Pressable
            style={styles.iconButton}
            onPress={() => router.back()}
          >
            <Ionicons
              name="chevron-back"
              size={25}
              color="#FFFFFF"
            />
          </Pressable>

          <Pressable style={styles.iconButton}>
            <Ionicons
              name="ellipsis-horizontal"
              size={23}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <View style={styles.bookHeader}>
          <View style={styles.cover}>
            <Ionicons
              name="book-outline"
              size={64}
              color="rgba(255,255,255,0.8)"
            />
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.author}>{author}</Text>
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressLabels}>
            <Text style={styles.progressLabel}>
              Your progress
            </Text>

            <Text style={styles.percentage}>
              {Math.round(progress)}%
            </Text>
          </View>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%` },
              ]}
            />
          </View>
        </View>

        <Pressable style={styles.continueButton}>
          <Ionicons
            name="play"
            size={18}
            color="#18131E"
          />

          <Text style={styles.continueText}>
            Continue Listening
          </Text>
        </Pressable>

        <Pressable style={styles.chapterSelector}>
          <View>
            <Text style={styles.smallLabel}>
              CURRENT PROGRESS
            </Text>

            <Text style={styles.chapterText}>
              Chapter 7
            </Text>
          </View>

          <Ionicons
            name="chevron-down"
            size={20}
            color="#FFFFFF"
          />
        </Pressable>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Chapters</Text>

          {['Chapter 7', 'Chapter 8', 'Chapter 9'].map(
            (chapter, index) => (
              <Pressable
                key={chapter}
                style={styles.chapterRow}
              >
                <View
                  style={[
                    styles.chapterNumber,
                    index === 0 && styles.activeChapter,
                  ]}
                >
                  {index === 0 ? (
                    <Ionicons
                      name="play"
                      size={12}
                      color="#FFFFFF"
                    />
                  ) : (
                    <Text style={styles.chapterNumberText}>
                      {index + 8}
                    </Text>
                  )}
                </View>

                <View style={styles.chapterInfo}>
                  <Text style={styles.chapterName}>
                    {chapter}
                  </Text>

                  <Text style={styles.chapterDuration}>
                    {18 + index * 3} min
                  </Text>
                </View>

                <Ionicons
                  name="ellipsis-horizontal"
                  size={19}
                  color="rgba(255,255,255,0.4)"
                />
              </Pressable>
            )
          )}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeadingRow}>
            <View>
              <Text style={styles.sectionTitle}>
                Characters
              </Text>

              <Text style={styles.sectionDescription}>
                Characters you've met so far
              </Text>
            </View>

            <Text style={styles.seeAll}>See All</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.characterList}
          >
            {characters.map((character) => (
              <Pressable
                key={character.id}
                style={styles.characterCard}
              >
                <View style={styles.characterImage}>
                  <Ionicons
                    name="person"
                    size={38}
                    color="rgba(255,255,255,0.55)"
                  />
                </View>

                <Text
                  style={styles.characterName}
                  numberOfLines={1}
                >
                  {character.name}
                </Text>

                <Text
                  style={styles.characterRole}
                  numberOfLines={1}
                >
                  {character.role}
                </Text>

                <View style={styles.characterDetail}>
                  <Ionicons
                    name="git-network-outline"
                    size={13}
                    color="rgba(255,255,255,0.5)"
                  />

                  <Text
                    style={styles.characterDetailText}
                    numberOfLines={2}
                  >
                    {character.connection}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.futureFeature}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color="rgba(255,255,255,0.65)"
            />

            <View style={styles.futureText}>
              <Text style={styles.futureTitle}>
                Spoiler-safe characters
              </Text>

              <Text style={styles.futureDescription}>
                Character relationships and events will only
                reveal information through your current chapter.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 150,
  },

  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  bookHeader: {
    alignItems: 'center',
    marginTop: 20,
  },

  cover: {
    width: 155,
    height: 220,
    borderRadius: 14,
    backgroundColor: '#493A5D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 27,
    fontFamily: fonts?.bold,
    fontWeight: '900',
    textAlign: 'center',
  },

  author: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
    marginTop: 6,
  },

  progressSection: {
    marginTop: 27,
  },

  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },

  progressLabel: {
    color: 'rgba(255,255,255,0.62)',
    fontSize: 12,
  },

  percentage: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 3,
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
  },

  continueButton: {
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    marginTop: 22,
    flexDirection: 'row',
    gap: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  continueText: {
    color: '#18131E',
    fontSize: 15,
    fontWeight: '900',
  },

  chapterSelector: {
    marginTop: 14,
    minHeight: 67,
    paddingHorizontal: 17,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  smallLabel: {
    color: 'rgba(255,255,255,0.42)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.2,
  },

  chapterText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 3,
  },

  section: {
    marginTop: 35,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },

  sectionDescription: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    marginTop: 3,
  },

  chapterRow: {
    minHeight: 67,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },

  chapterNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  activeChapter: {
    backgroundColor: '#7156A5',
  },

  chapterNumberText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '800',
  },

  chapterInfo: {
    flex: 1,
    marginLeft: 13,
  },

  chapterName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  chapterDuration: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 3,
  },

  sectionHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 15,
  },

  seeAll: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },

  characterList: {
    gap: 12,
  },

  characterCard: {
    width: 145,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  characterImage: {
    height: 120,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },

  characterName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  characterRole: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    marginTop: 3,
  },

  characterDetail: {
    flexDirection: 'row',
    gap: 5,
    marginTop: 9,
    alignItems: 'flex-start',
  },

  characterDetailText: {
    flex: 1,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 9,
    lineHeight: 13,
  },

  futureFeature: {
    marginTop: 18,
    borderRadius: 14,
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    gap: 11,
    alignItems: 'flex-start',
  },

  futureText: {
    flex: 1,
  },

  futureTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  futureDescription: {
    color: 'rgba(255,255,255,0.48)',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
});