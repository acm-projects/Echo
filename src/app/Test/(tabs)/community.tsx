import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { Screen } from '../../../components/Screen';
import { EmptyState } from '../../../components/EmptyState';
import { CityLoader } from '../../../components/CityLoader';
import { colors, fonts, type } from '../../../../theme';
import { NotSignedIn, ago, getFollowingFeed, getRooms, joinRoomByCode, listenedLabel, roomColor, type Activity, type Room } from '../../../data/community';
import { notify } from '../../../../lib/notify';
import { RoomTags } from '../../../components/RoomTags';

type CommunityTab = 'Book Rooms' | 'Following';

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';

function openRoom(room: Room) {
  router.push({ pathname: '/Test/room', params: { id: room.id, title: room.name } });
}

// Loads on every visit to the tab, so a post made in a room shows up here straight away.
function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const reload = useCallback(() => {
    let active = true;
    setError(null);
    load().then((next) => active && setData(next), (e: Error) => active && setError(e));
    return () => { active = false; };
  }, [load]);
  useFocusEffect(reload);
  return { data, error, reload };
}

export default function Community() {
  const [tab, setTab] = useState<CommunityTab>('Book Rooms');

  return (
    <Screen scene="ember">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <Text style={type.h1}>Community</Text>

        <View style={s.tabs}>
          {(['Book Rooms', 'Following'] as CommunityTab[]).map((item) => {
            const active = tab === item;
            return (
              <Pressable key={item} onPress={() => setTab(item)} style={[s.tab, active && s.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: active }}>
                <Text style={[s.tabText, active && s.tabTextActive]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>

        {tab === 'Book Rooms' ? <BookRooms /> : <Following />}
      </ScrollView>
    </Screen>
  );
}

function SignInOrError({ error, retry }: { error: Error; retry: () => void }) {
  return error instanceof NotSignedIn ? (
    <EmptyState title="Sign in to join the conversation" body="Book rooms and your friends' listening live with your account." action="Sign in" onAction={() => router.push('/Test/login')} />
  ) : (
    <EmptyState title="Couldn't reach the community" body={error.message} action="Try again" onAction={retry} />
  );
}

function activityLine(room: Room) {
  if (!room.posts) return 'No posts yet';
  return `${room.posts} ${room.posts === 1 ? 'post' : 'posts'}${room.lastPostAt ? ` · last ${ago(room.lastPostAt)} ago` : ''}`;
}

const membersLine = (room: Room) => `${room.members} ${room.members === 1 ? 'member' : 'members'}`;

function BookRooms() {
  const { data: rooms, error, reload } = useLoad(getRooms);
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  if (error) return <SignInOrError error={error} retry={reload} />;
  if (!rooms) return <CityLoader scene="ember" label="Opening the book rooms…" />;

  const mine = rooms.filter((r) => r.joined);
  const discover = rooms.filter((r) => !r.joined && r.visibility === 'public');

  const joinWithCode = async () => {
    if (code.trim().length < 4 || joining) return;
    setJoining(true);
    try {
      const id = await joinRoomByCode(code);
      setCode('');
      router.push({ pathname: '/Test/room', params: { id } });
    } catch (e) {
      notify('Couldn’t join', e instanceof Error ? e.message : 'Try again in a moment.');
    } finally {
      setJoining(false);
    }
  };

  return (
    <View>
      <View style={s.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>Your Book Rooms</Text>
          <Text style={s.sectionSubtitle}>Rooms you made or joined</Text>
        </View>
        <Pressable style={s.newButton} onPress={() => router.push('/Test/new-room')} accessibilityRole="button" accessibilityLabel="Make a book room">
          <Ionicons name="add" size={17} color="#2A1258" />
          <Text style={s.newButtonText}>New room</Text>
        </Pressable>
      </View>

      <View style={s.codeRow}>
        <Ionicons name="key-outline" size={17} color={colors.dim} />
        <TextInput value={code} onChangeText={(t) => setCode(t.toUpperCase())} placeholder="Have an invite code?" placeholderTextColor={colors.faint} style={s.codeInput} autoCapitalize="characters" autoCorrect={false} maxLength={12} returnKeyType="go" onSubmitEditing={joinWithCode} />
        <Pressable onPress={joinWithCode} disabled={code.trim().length < 4 || joining} style={[s.codeJoin, (code.trim().length < 4 || joining) && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Join with code">
          {joining ? <ActivityIndicator size="small" color={colors.text} /> : <Text style={s.codeJoinText}>Join</Text>}
        </Pressable>
      </View>

      {mine.length === 0 ? (
        <View style={[s.room, { minHeight: 0 }]}>
          <Text style={[type.body, { flex: 1 }]}>You haven’t joined a room yet. Make one for a book you love, join a public room below, or enter a friend’s invite code.</Text>
        </View>
      ) : (
        <View style={s.rooms}>
          {mine.map((room) => (
            <Pressable key={room.id} style={s.room} onPress={() => openRoom(room)} accessibilityRole="button" accessibilityLabel={`${room.name} book room`}>
              <View style={[s.roomCover, { backgroundColor: roomColor(room.bookTitle) }]}>
                <Ionicons name={room.visibility === 'private' ? 'lock-closed-outline' : 'book-outline'} size={28} color="rgba(255,255,255,0.8)" />
              </View>
              <View style={s.roomInfo}>
                <Text style={s.roomTitle} numberOfLines={2}>{room.name}</Text>
                <Text style={s.roomReaders} numberOfLines={1}>{room.bookTitle}{room.bookAuthor ? ` · ${room.bookAuthor}` : ''}</Text>
                <RoomTags room={room} />
                <Text style={s.newDiscussions}>{membersLine(room)} · {activityLine(room)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={21} color={colors.dim} />
            </Pressable>
          ))}
        </View>
      )}

      <View style={[s.sectionHeader, { marginTop: 34 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>Public Book Rooms</Text>
          <Text style={s.sectionSubtitle}>Open to every listener</Text>
        </View>
        <Pressable onPress={() => router.push('/Test/search')} hitSlop={8} accessibilityRole="button">
          <Text style={s.seeAll}>Search</Text>
        </Pressable>
      </View>

      {discover.length === 0 ? (
        <Text style={type.body}>{mine.length ? 'You’re in every public room there is.' : 'No public rooms yet. Make the first one.'}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.discoverList}>
          {discover.map((room) => (
            <Pressable key={room.id} style={s.discoverCard} onPress={() => openRoom(room)} accessibilityRole="button" accessibilityLabel={`${room.name} book room`}>
              <View style={[s.discoverCover, { backgroundColor: roomColor(room.bookTitle) }]}>
                <Ionicons name="book-outline" size={34} color="rgba(255,255,255,0.75)" />
                {room.myBookId && (
                  <View style={s.shelfDot}>
                    <Ionicons name="book" size={10} color="#18131E" />
                    <Text style={s.shelfDotText}>ON YOUR SHELF</Text>
                  </View>
                )}
              </View>
              <Text style={s.discoverTitle} numberOfLines={2}>{room.name}</Text>
              <Text style={s.discoverMembers} numberOfLines={1}>{room.name === room.bookTitle ? (room.bookAuthor ?? membersLine(room)) : room.bookTitle}</Text>
              <Text style={s.discoverMembers}>{membersLine(room)}{room.myBookId ? '' : ' · not on your shelf'}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Following() {
  const { data, error, reload } = useLoad(getFollowingFeed);

  const header = (
    <View style={s.sectionHeader}>
      <View style={{ flex: 1 }}>
        <Text style={s.sectionTitle}>Following</Text>
        <Text style={s.sectionSubtitle}>{data?.friends ? `What your ${data.friends === 1 ? 'friend has' : `${data.friends} friends have`} been up to` : 'Recent activity from your friends'}</Text>
      </View>
      <Pressable style={s.peopleButton} onPress={() => router.push('/Test/people')} accessibilityRole="button" accessibilityLabel="Find friends">
        <Ionicons name="people-outline" size={19} color={colors.text} />
      </Pressable>
    </View>
  );

  if (error) return <View>{header}<SignInOrError error={error} retry={reload} /></View>;
  if (!data) return <View>{header}<CityLoader scene="ember" label="Checking in on your friends…" /></View>;
  if (!data.friends) return <View>{header}<EmptyState title="Listening is better together" body="Add friends to see when they listen and what they post in book rooms." action="Find friends" onAction={() => router.push('/Test/people')} /></View>;
  if (!data.items.length) return <View>{header}<EmptyState title="Quiet lately" body="Your friends haven’t listened or posted in the last two weeks." /></View>;

  return (
    <View>
      {header}
      {data.items.map((item) => <ActivityCard key={`${item.kind}-${item.userId}-${item.date}-${item.kind === 'posted' ? item.roomId : ''}`} item={item} />)}
    </View>
  );
}

function ActivityCard({ item }: { item: Activity }) {
  if (item.kind === 'listened') {
    return (
      <View style={s.activityCard}>
        <View style={s.avatar}><Text style={s.avatarText}>{initials(item.name)}</Text></View>
        <View style={s.activityInfo}>
          <Text style={s.activityText}>
            <Text style={s.personName}>{item.name}</Text> listened for {listenedLabel(item.seconds)}
          </Text>
          <Text style={s.activityBook}>{ago(item.date)}{item.chapters ? ` · finished ${item.chapters} ${item.chapters === 1 ? 'chapter' : 'chapters'}` : ''}</Text>
        </View>
        <View style={s.activityIcon}><Ionicons name="headset-outline" size={19} color={colors.blue} /></View>
      </View>
    );
  }
  return (
    <Pressable style={s.post} onPress={() => router.push({ pathname: '/Test/room', params: { id: item.roomId, title: item.roomTitle } })} accessibilityRole="button">
      <View style={s.personRow}>
        <View style={s.avatar}><Text style={s.avatarText}>{initials(item.name)}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={s.personName}>{item.name}</Text>
          <Text style={s.activityTime}>posted in {item.roomTitle} · {ago(item.date)} ago</Text>
        </View>
      </View>
      {item.spoiler ? (
        <View style={[s.spoilerHeader, { marginBottom: 0 }]}>
          <Ionicons name="eye-off-outline" size={15} color={colors.pink} />
          <Text style={s.spoilerLabel}>CHAPTER {(item.chapterIndex ?? 0) + 1} SPOILER · HIDDEN UNTIL YOU GET THERE</Text>
        </View>
      ) : (
        <Text style={s.revealedText} numberOfLines={4}>{item.body}</Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  newButton: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 34, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#E3C3F5' },
  newButtonText: { fontFamily: fonts.sansBold, fontSize: 13, color: '#2A1258' },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 10, paddingLeft: 14, paddingRight: 6, marginBottom: 14, backgroundColor: 'rgba(0,0,0,0.22)', borderWidth: 1, borderColor: colors.border },
  codeInput: { flex: 1, color: colors.text, fontFamily: fonts.sansBold, fontSize: 14, letterSpacing: 1.5, outlineStyle: 'none' } as object,
  codeJoin: { height: 36, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', minWidth: 58 },
  codeJoinText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
  shelfDot: { position: 'absolute', left: 6, bottom: 6, flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 3, backgroundColor: colors.blue },
  shelfDotText: { fontFamily: fonts.sansBold, fontSize: 8.5, letterSpacing: 0.6, color: '#18131E' },
  revealedText: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.text, marginVertical: 8 },
  content: {
    padding: 20,
    paddingBottom: 150,
  },

  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 4,
    marginTop: 18,
    marginBottom: 28,
  },

  tab: {
    flex: 1,
    height: 42,
    borderRadius: 12,
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
    borderRadius: 12,
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
    borderRadius: 10,
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
    borderRadius: 12,
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
    borderRadius: 12,
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
    borderRadius: 10,
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