import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen } from '../components/Screen';
import { colors, fonts, type } from '../../../theme';

type CommunityTab = 'Book Rooms' | 'Following';

const ROOMS = [
  {
    id: 'dune',
    title: 'Dune',
    readers: '2.4k readers',
    chapter: 'Chapter 7',
    discussions: 12,
    accent: '#806039',
  },
  {
    id: 'night-circus',
    title: 'The Night Circus',
    readers: '1.8k readers',
    chapter: 'Chapter 4',
    discussions: 8,
    accent: '#563B68',
  },
];

const DISCOVER = [
  {
    id: 'lotr',
    title: 'The Lord of the Rings',
    members: '4.1k',
    accent: '#405541',
  },
  {
    id: 'gatsby',
    title: 'The Great Gatsby',
    members: '1.2k',
    accent: '#385A6B',
  },
  {
    id: 'frankenstein',
    title: 'Frankenstein',
    members: '980',
    accent: '#4A5A4D',
  },
];

export default function Community() {
  const [tab, setTab] =
    useState<CommunityTab>('Book Rooms');

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        <Text style={type.h1}>Community</Text>

        <View style={s.tabs}>
          {(['Book Rooms', 'Following'] as CommunityTab[]).map(
            (item) => {
              const active = tab === item;

              return (
                <Pressable
                  key={item}
                  onPress={() => setTab(item)}
                  style={[
                    s.tab,
                    active && s.tabActive,
                  ]}
                >
                  <Text
                    style={[
                      s.tabText,
                      active && s.tabTextActive,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              );
            }
          )}
        </View>

        {tab === 'Book Rooms' ? (
          <BookRooms />
        ) : (
          <Following />
        )}
      </ScrollView>
    </Screen>
  );
}

function BookRooms() {
  return (
    <View>
      <View style={s.sectionHeader}>
        <View>
          <Text style={s.sectionTitle}>
            Your Book Rooms
          </Text>

          <Text style={s.sectionSubtitle}>
            Discuss the books you're reading
          </Text>
        </View>
      </View>

      <View style={s.rooms}>
        {ROOMS.map((room) => (
          <Pressable
            key={room.id}
            style={s.room}
          >
            <View
              style={[
                s.roomCover,
                { backgroundColor: room.accent },
              ]}
            >
              <Ionicons
                name="book-outline"
                size={30}
                color="rgba(255,255,255,0.8)"
              />
            </View>

            <View style={s.roomInfo}>
              <Text style={s.roomTitle}>
                {room.title}
              </Text>

              <Text style={s.roomReaders}>
                {room.readers}
              </Text>

              <View style={s.chapterBadge}>
                <Ionicons
                  name="bookmark-outline"
                  size={12}
                  color={colors.blue}
                />

                <Text style={s.chapterText}>
                  You're on {room.chapter}
                </Text>
              </View>

              <Text style={s.newDiscussions}>
                {room.discussions} new discussions
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={21}
              color={colors.dim}
            />
          </Pressable>
        ))}
      </View>

      <View style={s.sectionHeader}>
        <View>
          <Text style={s.sectionTitle}>
            Discover Book Rooms
          </Text>

          <Text style={s.sectionSubtitle}>
            Find people reading the same stories
          </Text>
        </View>

        <Pressable>
          <Text style={s.seeAll}>
            See All
          </Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.discoverList}
      >
        {DISCOVER.map((room) => (
          <Pressable
            key={room.id}
            style={s.discoverCard}
          >
            <View
              style={[
                s.discoverCover,
                { backgroundColor: room.accent },
              ]}
            >
              <Ionicons
                name="book-outline"
                size={34}
                color="rgba(255,255,255,0.75)"
              />
            </View>

            <Text
              style={s.discoverTitle}
              numberOfLines={2}
            >
              {room.title}
            </Text>

            <Text style={s.discoverMembers}>
              {room.members} readers
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function Following() {
  return (
    <View>
      <View style={s.sectionHeader}>
        <View>
          <Text style={s.sectionTitle}>
            Following
          </Text>

          <Text style={s.sectionSubtitle}>
            Recent activity from people you follow
          </Text>
        </View>

        <Pressable style={s.peopleButton}>
          <Ionicons
            name="people-outline"
            size={19}
            color={colors.text}
          />
        </Pressable>
      </View>

      <ActivityCard
        initials="MK"
        name="Maya K."
        action="started listening to"
        book="The Night Circus"
        icon="headset-outline"
      />

      <ActivityCard
        initials="AJ"
        name="Alex J."
        action="shared a new voice cast for"
        book="Dune"
        icon="mic-outline"
      />

      <View style={s.post}>
        <View style={s.personRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>JS</Text>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={s.personName}>
              Jordan S.
            </Text>

            <Text style={s.activityTime}>
              posted in Dune · 12 min ago
            </Text>
          </View>
        </View>

        <View style={s.spoilerHeader}>
          <Ionicons
            name="eye-off-outline"
            size={15}
            color={colors.pink}
          />

          <Text style={s.spoilerLabel}>
            CHAPTER 12 SPOILERS
          </Text>
        </View>

        <Pressable style={s.spoiler}>
          <Ionicons
            name="eye-outline"
            size={23}
            color={colors.dim}
          />

          <Text style={s.spoilerTitle}>
            Spoiler protected
          </Text>

          <Text style={s.spoilerDescription}>
            You're currently on Chapter 7
          </Text>

          <Text style={s.reveal}>
            Tap to reveal
          </Text>
        </Pressable>

        <View style={s.stats}>
          <View style={s.stat}>
            <Ionicons
              name="heart-outline"
              size={18}
              color={colors.dim}
            />
            <Text style={type.meta}>24</Text>
          </View>

          <View style={s.stat}>
            <Ionicons
              name="chatbubble-outline"
              size={17}
              color={colors.dim}
            />
            <Text style={type.meta}>6</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function ActivityCard({
  initials,
  name,
  action,
  book,
  icon,
}: {
  initials: string;
  name: string;
  action: string;
  book: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={s.activityCard}>
      <View style={s.avatar}>
        <Text style={s.avatarText}>
          {initials}
        </Text>
      </View>

      <View style={s.activityInfo}>
        <Text style={s.activityText}>
          <Text style={s.personName}>
            {name}
          </Text>{' '}
          {action}
        </Text>

        <Text style={s.activityBook}>
          {book}
        </Text>
      </View>

      <View style={s.activityIcon}>
        <Ionicons
          name={icon}
          size={19}
          color={colors.blue}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 150,
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    padding: 4,
    marginTop: 18,
    marginBottom: 28,
  },

  tab: {
    flex: 1,
    height: 42,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabActive: {
    backgroundColor: '#E3C3F5',
  },

  tabText: {
    fontFamily: fonts.sansBold,
    color: colors.dim,
    fontSize: 14,
  },

  tabTextActive: {
    color: '#2A1258',
  },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 14,
  },

  sectionTitle: {
    fontFamily: fonts.sansBold,
    color: colors.text,
    fontSize: 20,
  },

  sectionSubtitle: {
    ...type.meta,
    color: colors.dim,
    marginTop: 4,
  },

  rooms: {
    gap: 11,
    marginBottom: 34,
  },

  room: {
    minHeight: 126,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
  },

  roomCover: {
    width: 72,
    height: 96,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  roomInfo: {
    flex: 1,
    marginLeft: 14,
  },

  roomTitle: {
    fontFamily: fonts.sansBold,
    color: colors.text,
    fontSize: 17,
  },

  roomReaders: {
    ...type.meta,
    color: colors.dim,
    marginTop: 3,
  },

  chapterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 9,
  },

  chapterText: {
    fontFamily: fonts.sansBold,
    color: colors.blue,
    fontSize: 11,
  },

  newDiscussions: {
    ...type.meta,
    color: colors.faint,
    marginTop: 5,
  },

  seeAll: {
    fontFamily: fonts.sansBold,
    color: colors.blue,
    fontSize: 13,
  },

  discoverList: {
    gap: 12,
    paddingBottom: 6,
  },

  discoverCard: {
    width: 130,
  },

  discoverCover: {
    width: 130,
    height: 155,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 9,
  },

  discoverTitle: {
    fontFamily: fonts.sansBold,
    color: colors.text,
    fontSize: 13,
    lineHeight: 17,
  },

  discoverMembers: {
    ...type.meta,
    color: colors.dim,
    marginTop: 3,
  },

  peopleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  activityCard: {
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 11,
  },

  avatar: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: 'rgba(227,195,245,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  avatarText: {
    fontFamily: fonts.sansBold,
    color: colors.pink,
    fontSize: 12,
  },

  activityInfo: {
    flex: 1,
    marginLeft: 12,
  },

  activityText: {
    ...type.body,
    color: colors.dim,
    fontSize: 13,
  },

  personName: {
    fontFamily: fonts.sansBold,
    color: colors.text,
    fontSize: 14,
  },

  activityBook: {
    fontFamily: fonts.sansBold,
    color: colors.blue,
    fontSize: 13,
    marginTop: 4,
  },

  activityIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(127,168,230,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  post: {
    padding: 16,
    borderRadius: 22,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 2,
  },

  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },

  activityTime: {
    ...type.meta,
    color: colors.dim,
    marginTop: 2,
  },

  spoilerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 18,
    marginBottom: 8,
  },

  spoilerLabel: {
    fontFamily: fonts.sansBold,
    color: colors.pink,
    fontSize: 10,
    letterSpacing: 1,
  },

  spoiler: {
    minHeight: 145,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },

  spoilerTitle: {
    fontFamily: fonts.sansBold,
    color: colors.text,
    fontSize: 14,
    marginTop: 7,
  },

  spoilerDescription: {
    ...type.meta,
    color: colors.dim,
    marginTop: 4,
  },

  reveal: {
    fontFamily: fonts.sansBold,
    color: colors.blue,
    fontSize: 12,
    marginTop: 9,
  },

  stats: {
    flexDirection: 'row',
    gap: 18,
    marginTop: 13,
  },

  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});