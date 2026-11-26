import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { RoomDoor } from '../../../components/RoomDoor';
import { Screen } from '../../../components/Screen';
import { EmptyState } from '../../../components/EmptyState';
import { CityLoader } from '../../../components/CityLoader';
import { RoomTags } from '../../../components/RoomTags';
import { useReducedMotion } from '../../../components/night/NightSky';
import {
  MOTION_KEYS,
  currentSettings,
} from '../../../data/settings';
import { colors, fonts, type } from '../../../../theme';
import {
  NotSignedIn,
  ago,
  getFollowingFeed,
  getRooms,
  joinRoomByCode,
  listenedLabel,
  type Activity,
  type Room,
} from '../../../data/community';
import { notify } from '../../../../lib/notify';

type CommunityTab = 'Book Rooms' | 'Following';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('') || '?';

function openRoom(room: Room) {
  router.push({
    pathname: '/Test/room',
    params: {
      id: room.id,
      title: room.name,
    },
  });
}

function useLoad<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(() => {
    setError(null);

    load().then(
      (next) => setData(next),
      (e: Error) => setError(e)
    );
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let loading = false;

      const refresh = async () => {
        if (!active || loading) return;

        loading = true;

        try {
          const next = await load();

          if (active) {
            setData(next);
            setError(null);
          }
        } catch (e) {
          if (active) {
            setError(
              e instanceof Error
                ? e
                : new Error('Could not refresh community')
            );
          }
        } finally {
          loading = false;
        }
      };

      void refresh();

      const interval = setInterval(() => {
        void refresh();
      }, 5000);

      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [load])
  );

  return { data, error, reload };
}

export default function Community() {
  const [tab, setTab] = useState<CommunityTab>('Book Rooms');

  return (
    <Screen scene="ember">
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
                  style={[s.tab, active && s.tabActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
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

        {tab === 'Book Rooms' ? <BookRooms /> : <Following />}
      </ScrollView>
    </Screen>
  );
}

function SignInOrError({
  error,
  retry,
}: {
  error: Error;
  retry: () => void;
}) {
  return error instanceof NotSignedIn ? (
    <EmptyState
      title="Sign in to join the conversation"
      body="Book rooms and your friends' listening live with your account."
      action="Sign in"
      onAction={() => router.push('/Test/login')}
    />
  ) : (
    <EmptyState
      title="Couldn't reach the community"
      body={error.message}
      action="Try again"
      onAction={retry}
    />
  );
}

function activityLine(room: Room) {
  if (!room.posts) return 'No posts yet';

  return `${room.posts} ${
    room.posts === 1 ? 'post' : 'posts'
  }${
    room.lastPostAt
      ? ` · last ${ago(room.lastPostAt)} ago`
      : ''
  }`;
}

const membersLine = (room: Room) =>
  `${room.members} ${
    room.members === 1 ? 'member' : 'members'
  }`;

function BookRooms() {
  const { data: rooms, error, reload } = useLoad(getRooms);
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();

  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const pending = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const discoverWidth = Math.min(
    164,
    Math.max(112, (width - 64) / 2.3)
  );

  const discoverHeight = Math.round(discoverWidth * 1.5);

  useFocusEffect(
    useCallback(() => {
      pending.current = false;
      setOpening(null);

      return () => {
        if (timer.current) {
          clearTimeout(timer.current);
          timer.current = null;
        }

        pending.current = false;
      };
    }, [])
  );

  const enterRoom = (room: Room) => {
    if (pending.current) return;

    const animate =
      !reduced && currentSettings()[MOTION_KEYS.rooms];

    if (!animate) {
      openRoom(room);
      return;
    }

    pending.current = true;
    setOpening(room.id);

    timer.current = setTimeout(() => {
      openRoom(room);

      timer.current = setTimeout(() => {
        pending.current = false;
        setOpening(null);
        timer.current = null;
      }, 1000);
    }, 480);
  };

  if (error) {
    return <SignInOrError error={error} retry={reload} />;
  }

  if (!rooms) {
    return (
      <CityLoader
        scene="ember"
        label="Opening the book rooms…"
      />
    );
  }

  const mine = rooms.filter((r) => r.joined);

  const discover = rooms.filter(
    (r) => !r.joined && r.visibility === 'public'
  );

  const joinWithCode = async () => {
    if (
      code.trim().length < 4 ||
      joining ||
      pending.current
    ) {
      return;
    }

    setJoining(true);

    try {
      const id = await joinRoomByCode(code);

      setCode('');

      router.push({
        pathname: '/Test/room',
        params: { id },
      });
    } catch (e) {
      notify(
        'Couldn’t join',
        e instanceof Error
          ? e.message
          : 'Try again in a moment.'
      );
    } finally {
      setJoining(false);
    }
  };

  return (
    <View>
      <View style={s.sectionHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>Your Book Rooms</Text>

          <Text style={s.sectionSubtitle}>
            Rooms you made or joined
          </Text>
        </View>

        <Pressable
          style={s.newButton}
          disabled={opening !== null}
          onPress={() => router.push('/Test/new-room')}
          accessibilityRole="button"
          accessibilityLabel="Make a book room"
        >
          <Ionicons name="add" size={17} color="#2A1258" />

          <Text style={s.newButtonText}>New room</Text>
        </Pressable>
      </View>

      <View style={s.codeRow}>
        <Ionicons
          name="key-outline"
          size={17}
          color={colors.dim}
        />

        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="Have an invite code?"
          placeholderTextColor={colors.faint}
          style={s.codeInput}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          returnKeyType="go"
          onSubmitEditing={joinWithCode}
        />

        <Pressable
          onPress={joinWithCode}
          disabled={
            code.trim().length < 4 ||
            joining ||
            opening !== null
          }
          style={[
            s.codeJoin,
            (code.trim().length < 4 || joining) && {
              opacity: 0.4,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Join with code"
        >
          {joining ? (
            <ActivityIndicator
              size="small"
              color={colors.text}
            />
          ) : (
            <Text style={s.codeJoinText}>Join</Text>
          )}
        </Pressable>
      </View>

      {mine.length === 0 ? (
        <View style={s.emptyRoom}>
          <Ionicons
            name="enter-outline"
            size={25}
            color={colors.dim}
          />

          <Text style={[type.body, { flex: 1 }]}>
            You haven’t joined a room yet. Make one for a
            book you love, join a public room below, or
            enter a friend’s invite code.
          </Text>
        </View>
      ) : (
        <View style={s.rooms}>
          {mine.map((room) => (
            <Pressable
              key={room.id}
              disabled={opening !== null}
              onPress={() => enterRoom(room)}
              style={({ pressed }) => [
                s.room,
                pressed && s.roomPressed,
                opening === room.id && s.roomOpening,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${room.name} book room`}
            >
              <RoomDoor
                id={room.id}
                name={room.name}
                width={78}
                height={117}
                visibility={room.visibility}
                opening={opening === room.id}
              />

              <View style={s.roomInfo}>
                <Text
                  style={s.roomTitle}
                  numberOfLines={2}
                >
                  {room.name}
                </Text>

                <Text
                  style={s.roomReaders}
                  numberOfLines={1}
                >
                  {room.bookTitle}
                  {room.bookAuthor
                    ? ` · ${room.bookAuthor}`
                    : ''}
                </Text>

                <RoomTags room={room} />

                <Text style={s.newDiscussions}>
                  {membersLine(room)} · {activityLine(room)}
                </Text>

                {opening === room.id && (
                  <Text style={s.entering}>Entering room…</Text>
                )}
              </View>

              <Ionicons
                name="chevron-forward"
                size={19}
                color={
                  opening === room.id
                    ? '#E8B475'
                    : colors.dim
                }
              />
            </Pressable>
          ))}
        </View>
      )}

      <View style={[s.sectionHeader, { marginTop: 30 }]}>
        <View style={{ flex: 1 }}>
          <Text style={s.sectionTitle}>
            Public Book Rooms
          </Text>

          <Text style={s.sectionSubtitle}>
            Open to every listener
          </Text>
        </View>

        <Pressable
          onPress={() => router.push('/Test/search')}
          disabled={opening !== null}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={s.seeAll}>Search</Text>
        </Pressable>
      </View>

      {discover.length === 0 ? (
        <Text style={type.body}>
          {mine.length
            ? 'You’re in every public room there is.'
            : 'No public rooms yet. Make the first one.'}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.discoverList}
        >
          {discover.map((room) => (
            <Pressable
              key={room.id}
              disabled={opening !== null}
              onPress={() => enterRoom(room)}
              style={({ pressed }) => [
                s.discoverCard,
                { width: discoverWidth },
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${room.name} book room`}
            >
              <View
                style={[
                  s.discoverCover,
                  {
                    width: discoverWidth,
                    height: discoverHeight,
                  },
                ]}
              >
                <RoomDoor
                  id={room.id}
                  name={room.name}
                  width={discoverWidth}
                  height={discoverHeight}
                  visibility={room.visibility}
                  opening={opening === room.id}
                />
              </View>

              <Text
                style={s.discoverTitle}
                numberOfLines={2}
              >
                {room.name}
              </Text>

              <Text
                style={s.discoverMembers}
                numberOfLines={1}
              >
                {room.name === room.bookTitle
                  ? room.bookAuthor ?? membersLine(room)
                  : room.bookTitle}
              </Text>

              <View style={s.memberRow}>
                <Ionicons
                  name="people-outline"
                  size={12}
                  color={colors.dim}
                />

                <Text style={s.memberText}>
                  {membersLine(room)}
                </Text>
              </View>

              {room.myBookId ? (
                <View style={s.shelfStatus}>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={12}
                    color={colors.blue}
                  />

                  <Text style={s.shelfStatusText}>
                    On your shelf
                  </Text>
                </View>
              ) : (
                <Text style={s.notOnShelf}>
                  Not on your shelf
                </Text>
              )}

              {opening === room.id && (
                <Text style={s.entering}>Entering room…</Text>
              )}
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

        <Text style={s.sectionSubtitle}>
          {data?.friends
            ? `What your ${
                data.friends === 1
                  ? 'friend has'
                  : `${data.friends} friends have`
              } been up to`
            : 'Recent activity from your friends'}
        </Text>
      </View>

      <Pressable
        style={s.peopleButton}
        onPress={() => router.push('/Test/people')}
        accessibilityRole="button"
        accessibilityLabel="Find friends"
      >
        <Ionicons
          name="people-outline"
          size={19}
          color={colors.text}
        />
      </Pressable>
    </View>
  );

  if (error) {
    return (
      <View>
        {header}
        <SignInOrError error={error} retry={reload} />
      </View>
    );
  }

  if (!data) {
    return (
      <View>
        {header}

        <CityLoader
          scene="ember"
          label="Checking in on your friends…"
        />
      </View>
    );
  }

  if (!data.friends) {
    return (
      <View>
        {header}

        <EmptyState
          title="Listening is better together"
          body="Add friends to see when they listen and what they post in book rooms."
          action="Find friends"
          onAction={() => router.push('/Test/people')}
        />
      </View>
    );
  }

  if (!data.items.length) {
    return (
      <View>
        {header}

        <EmptyState
          title="Quiet lately"
          body="Your friends haven’t listened or posted in the last two weeks."
        />
      </View>
    );
  }

  return (
    <View>
      {header}

      {data.items.map((item) => (
        <ActivityCard
          key={`${item.kind}-${item.userId}-${item.date}-${
            item.kind === 'posted' ? item.roomId : ''
          }`}
          item={item}
        />
      ))}
    </View>
  );
}

function ActivityCard({ item }: { item: Activity }) {
  if (item.kind === 'listened') {
    return (
      <View style={s.activityCard}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {initials(item.name)}
          </Text>
        </View>

        <View style={s.activityInfo}>
          <Text style={s.activityText}>
            <Text style={s.personName}>{item.name}</Text>
            {' listened for '}
            {listenedLabel(item.seconds)}
          </Text>

          <Text style={s.activityBook}>
            {ago(item.date)}
            {item.chapters
              ? ` · finished ${item.chapters} ${
                  item.chapters === 1
                    ? 'chapter'
                    : 'chapters'
                }`
              : ''}
          </Text>
        </View>

        <View style={s.activityIcon}>
          <Ionicons
            name="headset-outline"
            size={19}
            color={colors.blue}
          />
        </View>
      </View>
    );
  }

  return (
    <Pressable
      style={s.post}
      onPress={() =>
        router.push({
          pathname: '/Test/room',
          params: {
            id: item.roomId,
            title: item.roomTitle,
          },
        })
      }
      accessibilityRole="button"
    >
      <View style={s.personRow}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {initials(item.name)}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={s.personName}>{item.name}</Text>

          <Text style={s.activityTime}>
            posted in {item.roomTitle} · {ago(item.date)} ago
          </Text>
        </View>
      </View>

      {item.spoiler ? (
        <View style={s.spoilerHeader}>
          <Ionicons
            name="eye-off-outline"
            size={15}
            color={colors.pink}
          />

          <Text style={s.spoilerLabel}>
            CHAPTER {(item.chapterIndex ?? 0) + 1} SPOILER ·
            HIDDEN UNTIL YOU GET THERE
          </Text>
        </View>
      ) : (
        <Text style={s.revealedText} numberOfLines={4}>
          {item.body}
        </Text>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 150,
    width: '100%',
    maxWidth: 1000,
    alignSelf: 'center',
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
    borderRadius: 9,
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
    gap: 12,
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

  newButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#E3C3F5',
  },

  newButtonText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: '#2A1258',
  },

  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    borderRadius: 10,
    paddingLeft: 14,
    paddingRight: 6,
    marginBottom: 18,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: colors.border,
  },

  codeInput: {
    flex: 1,
    color: colors.text,
    fontFamily: fonts.sansBold,
    fontSize: 14,
    letterSpacing: 1.5,
    outlineStyle: 'none',
  } as object,

  codeJoin: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 58,
  },

  codeJoinText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.text,
  },

  rooms: {
    gap: 10,
  },

  room: {
    minHeight: 137,
    borderRadius: 12,
    backgroundColor: 'rgba(19,12,28,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(243,233,255,0.07)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  roomPressed: {
    backgroundColor: 'rgba(243,233,255,0.07)',
  },

  roomOpening: {
    borderColor: 'rgba(232,180,117,0.3)',
    backgroundColor: 'rgba(232,180,117,0.045)',
  },

  emptyRoom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(19,12,28,0.3)',
  },

  roomInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
    marginRight: 8,
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

  newDiscussions: {
    ...type.meta,
    color: colors.faint,
    marginTop: 6,
  },

  entering: {
    fontFamily: fonts.sansMd,
    fontSize: 11,
    color: '#E8B475',
    marginTop: 5,
  },

  seeAll: {
    fontFamily: fonts.sansBold,
    color: colors.blue,
    fontSize: 13,
  },

  discoverList: {
    gap: 16,
    paddingBottom: 10,
  },

  discoverCard: {
    alignSelf: 'flex-start',
  },

  discoverCover: {
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 10,
  },

  discoverTitle: {
    fontFamily: fonts.sansBold,
    color: colors.text,
    fontSize: 14,
    lineHeight: 19,
  },

  discoverMembers: {
    ...type.meta,
    color: colors.dim,
    marginTop: 3,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },

  memberText: {
    ...type.meta,
    color: colors.dim,
    fontSize: 11,
  },

  shelfStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },

  shelfStatusText: {
    fontFamily: fonts.sansMd,
    color: colors.blue,
    fontSize: 10,
  },

  notOnShelf: {
    fontFamily: fonts.sansMd,
    color: colors.faint,
    fontSize: 10,
    marginTop: 5,
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
    marginBottom: 10,
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
  },

  spoilerLabel: {
    flex: 1,
    fontFamily: fonts.sansBold,
    color: colors.pink,
    fontSize: 10,
    letterSpacing: 1,
  },

  revealedText: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginVertical: 8,
  },
});