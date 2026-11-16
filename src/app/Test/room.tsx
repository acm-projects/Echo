import { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { CityLoader } from '../../components/CityLoader';
import { Reveal } from '../../components/Reveal';
import { RoomTags } from '../../components/RoomTags';
import { colors, fonts, type } from '../../../theme';
import { confirm, notify } from '../../../lib/notify';
import {
  NotSignedIn, addRoomPost, ago, deleteRoom, deleteRoomPost, getFriendStates, getRoom, getRoomMembers, getRoomPosts, joinRoom, leaveRoom, requestFriend, roomColor,
  type FriendState, type Member, type Room as RoomInfo, type RoomPost,
} from '../../data/community';

type Loaded = { room: RoomInfo | null; posts: RoomPost[]; members: Member[]; friends: Map<string, FriendState> };

// One book room. Anyone who can see it reads its posts; members post. Posts can be tagged with the chapter the reader
// is on; readers who haven't got that far in their own copy (or don't have the book) see that a spoiler is there, and
// its text appears once they reach the chapter.
export default function Room() {
  const params = useLocalSearchParams<{ id?: string; title?: string }>();
  const id = params.id ?? '';
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [draft, setDraft] = useState('');
  const [spoiler, setSpoiler] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const load = useCallback(() => {
    let active = true;
    setError(null);
    Promise.all([getRoom(id), getRoomPosts(id), getRoomMembers(id), getFriendStates().catch(() => new Map<string, FriendState>())]).then(
      ([room, posts, members, friends]) => { if (active) setData({ room, posts, members, friends }); },
      (e: Error) => active && setError(e),
    );
    return () => { active = false; };
  }, [id]);
  // Auto-refresh posts every 4 seconds
  useFocusEffect(
  useCallback(() => {
    let active = true;
    let refreshing = false;

    load();

    const refreshPosts = async () => {
      if (!active || refreshing || !id) return;

      refreshing = true;

      try {
        const posts = await getRoomPosts(id);

        if (active) {
          setData((current) =>
            current ? { ...current, posts } : current
          );
        }
      } catch {
      } finally {
        refreshing = false;
      }
    };

    const interval = setInterval(() => {
      void refreshPosts();
    }, 4000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [id, load])
);

  const room = data?.room ?? null;
  const title = room?.name ?? params.title ?? 'Book room';
  const accent = roomColor(room?.bookTitle ?? title);
  // A post can be tagged with the reader's chapter only when they have the book and have started it.
  const myChapter = room?.myChapter ?? null;
  const canTag = myChapter !== null && myChapter >= 0 && myChapter !== Infinity;

  const run = async (what: string, task: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (e) {
      notify(what, e instanceof Error ? e.message : 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  };

  const post = () => {
    const body = draft.trim();
    if (!body) return;
    return run('Couldn’t post', async () => {
      await addRoomPost(id, body, spoiler && canTag ? myChapter! : undefined);
      setDraft('');
      setSpoiler(false);
      const posts = await getRoomPosts(id);
      setData((d) => d && { ...d, posts });
    });
  };

  const remove = (p: RoomPost) => run('Couldn’t delete the post', async () => {
    await deleteRoomPost(p.id);
    setData((d) => d && { ...d, posts: d.posts.filter((item) => item.id !== p.id) });
  });

  const join = () => run('Couldn’t join', async () => { await joinRoom(id); load(); });

  const leave = async () => {
    if (!room) return;
    const sure = room.owner
      ? await confirm('Delete this room?', 'Every post in it is deleted too, for everyone. This can’t be undone.', 'Delete')
      : await confirm('Leave this room?', room.visibility === 'private' ? 'You’ll need the invite code to come back.' : 'You can join again any time.', 'Leave');
    if (!sure) return;
    await run(room.owner ? 'Couldn’t delete the room' : 'Couldn’t leave', async () => {
      await (room.owner ? deleteRoom(id) : leaveRoom(id));
      router.canGoBack() ? router.back() : router.replace('/Test/community');
    });
  };

  const addFriend = (userId: string) => run('Couldn’t send the request', async () => {
    await requestFriend(userId);
    setData((d) => d && { ...d, friends: new Map(d.friends).set(userId, d.friends.get(userId) === 'received' ? 'received' : 'sent') });
  });

  const shareCode = () => {
    if (!room?.inviteCode) return;
    Share.share({ message: `Join my book room “${room.name}” on Echo. We’re reading ${room.bookTitle}. Invite code: ${room.inviteCode}` }).catch(() => {});
  };

  const friendButton = (userId: string, compact = false) => {
    const state = data?.friends.get(userId) ?? 'none';
    if (state === 'friend') return compact ? null : <Text style={type.meta}>Friends</Text>;
    if (state === 'sent') return <Text style={type.meta}>Requested</Text>;
    if (state === 'received') return <Pressable onPress={() => router.push('/Test/people')} hitSlop={8}><Text style={[type.meta, { color: colors.pink }]}>Wants to connect</Text></Pressable>;
    return (
      <Pressable onPress={() => addFriend(userId)} style={s.addFriend} hitSlop={8} accessibilityRole="button" accessibilityLabel="Send a friend request">
        <Ionicons name="person-add-outline" size={13} color={colors.text} />
        {!compact && <Text style={s.addFriendText}>Add friend</Text>}
      </Pressable>
    );
  };

  let body;
  if (error) {
    body = error instanceof NotSignedIn ? (
      <EmptyState title="Sign in to join the conversation" body="Book rooms live with your account." action="Sign in" onAction={() => router.push('/Test/login')} />
    ) : (
      <EmptyState title="Couldn’t open this room" body={error.message} action="Try again" onAction={load} />
    );
  } else if (!data) {
    body = <CityLoader scene="ember" label="Opening the room…" />;
  } else if (!room) {
    body = <EmptyState title="This room isn’t open to you" body="It may have been deleted, or it’s private. Private rooms are joined with an invite code from the Community tab." action="Back to Community" onAction={() => router.replace('/Test/community')} />;
  } else {
    const others = data.members.filter((m) => !m.me);
    body = (
      <>
        <Reveal>
          <View style={[s.banner, { backgroundColor: accent }]}>
            <Text style={s.bannerMeta}>{room.bookAuthor ? `${room.bookTitle} · ${room.bookAuthor}`.toUpperCase() : room.bookTitle.toUpperCase()}</Text>
            {room.description && <Text style={s.bannerText}>{room.description}</Text>}
            <RoomTags room={room} />
            {room.myBookId ? (
              <Pressable onPress={() => router.push({ pathname: '/Test/book_details', params: { id: room.myBookId! } })} style={s.shelfLink} accessibilityRole="link">
                <Text style={s.shelfLinkText}>Open your copy</Text>
                <Ionicons name="arrow-forward" size={13} color={colors.text} />
              </Pressable>
            ) : (
              <Text style={s.bannerNote}>This book isn’t on your shelf, so posts tagged with a chapter stay hidden. Add it and listen that far to read them.</Text>
            )}
          </View>
        </Reveal>

        {room.joined && room.visibility === 'private' && room.inviteCode && (
          <Reveal index={1}>
            <View style={s.invite}>
              <View style={{ flex: 1 }}>
                <Text style={type.meta}>INVITE CODE</Text>
                <Text style={s.code} selectable>{room.inviteCode}</Text>
              </View>
              <Pressable onPress={shareCode} style={s.inviteShare} accessibilityRole="button" accessibilityLabel="Share the invite code">
                <Ionicons name="share-outline" size={16} color={colors.text} />
                <Text style={s.addFriendText}>Share</Text>
              </Pressable>
            </View>
          </Reveal>
        )}

        <Reveal index={1}>
          <Pressable onPress={() => setShowMembers(!showMembers)} style={s.membersRow} accessibilityRole="button" accessibilityState={{ expanded: showMembers }}>
            <Ionicons name="people-outline" size={17} color={colors.dim} />
            <Text style={[s.author, { flex: 1 }]}>{data.members.length} {data.members.length === 1 ? 'member' : 'members'}</Text>
            <Ionicons name={showMembers ? 'chevron-up' : 'chevron-down'} size={17} color={colors.faint} />
          </Pressable>
          {showMembers && (
            <View style={s.members}>
              {data.members.length === 0 && <Text style={type.meta}>Nobody has joined yet.</Text>}
              {data.members.map((m) => (
                <View key={m.id} style={s.member}>
                  <View style={s.avatar}><Text style={s.avatarText}>{m.name.charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.author}>{m.name}{m.owner ? '  ·  made this room' : ''}</Text>
                    {m.username !== '' && !m.me && <Text style={type.meta}>@{m.username}</Text>}
                  </View>
                  {!m.me && friendButton(m.id)}
                </View>
              ))}
              {others.length > 0 && <Text style={[type.meta, { marginTop: 4 }]}>Friends see each other’s listening in the Following tab.</Text>}
            </View>
          )}
        </Reveal>

        {room.joined ? (
          <Reveal index={2}>
            <View style={s.composer}>
              <TextInput value={draft} onChangeText={setDraft} placeholder={canTag ? `Share a thought about chapter ${myChapter! + 1}…` : 'Share a thought about the book…'} placeholderTextColor={colors.faint} multiline maxLength={5000} style={s.input} />
              <View style={s.composerRow}>
                {canTag ? (
                  <Pressable onPress={() => setSpoiler(!spoiler)} style={s.spoilerToggle} accessibilityRole="checkbox" accessibilityState={{ checked: spoiler }}>
                    <Ionicons name={spoiler ? 'eye-off' : 'eye-off-outline'} size={16} color={spoiler ? colors.pink : colors.dim} />
                    <Text style={[type.meta, spoiler && { color: colors.pink }]}>Spoiler for chapter {myChapter! + 1}</Text>
                  </Pressable>
                ) : (
                  <Text style={[type.meta, { flex: 1 }]}>{room.myBookId ? 'Start listening to tag spoilers by chapter' : 'Everyone in the room can read this'}</Text>
                )}
                <Pressable onPress={post} disabled={!draft.trim() || busy} style={[s.send, (!draft.trim() || busy) && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Post">
                  {busy ? <ActivityIndicator color="#29123C" size="small" /> : <Ionicons name="arrow-up" size={18} color="#29123C" />}
                </Pressable>
              </View>
            </View>
          </Reveal>
        ) : (
          <Reveal index={2}>
            <Pressable onPress={join} disabled={busy} style={[s.join, busy && { opacity: 0.5 }]} accessibilityRole="button">
              {busy ? <ActivityIndicator color="#29123C" /> : <Text style={s.joinText}>Join this room to post</Text>}
            </Pressable>
          </Reveal>
        )}

        {data.posts.length === 0 ? (
          <Text style={[type.body, { textAlign: 'center', marginTop: 18 }]}>No posts yet. {room.joined ? 'Be the first to say something.' : 'Join and start the conversation.'}</Text>
        ) : (
          data.posts.map((p, i) => (
            <Reveal key={p.id} index={Math.min(i + 3, 8)}>
              <View style={s.post}>
                <View style={s.postHead}>
                  <View style={s.avatar}><Text style={s.avatarText}>{p.author.charAt(0).toUpperCase()}</Text></View>
                  <Text style={s.author}>{p.author}</Text>
                  <Text style={[type.meta, { flex: 1 }]}>{p.chapterIndex !== null ? `· Ch. ${p.chapterIndex + 1} ` : ''}· {ago(p.createdAt)}</Text>
                  {p.mine ? (
                    <Pressable onPress={() => remove(p)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Delete your post">
                      <Ionicons name="trash-outline" size={16} color={colors.faint} />
                    </Pressable>
                  ) : friendButton(p.userId, true)}
                </View>
                {p.spoiler ? (
                  <View style={s.spoiler}>
                    <Ionicons name="eye-off-outline" size={18} color={colors.dim} />
                    <Text style={[type.meta, { flex: 1 }]}>CHAPTER {(p.chapterIndex ?? 0) + 1} SPOILER · {room.myBookId ? 'UNLOCKS WHEN YOU GET THERE' : 'ADD THE BOOK TO READ IT'}</Text>
                  </View>
                ) : (
                  <Text style={s.body}>{p.body}</Text>
                )}
              </View>
            </Reveal>
          ))
        )}

        {room.joined && (
          <Pressable onPress={leave} style={s.leave} accessibilityRole="button">
            <Text style={s.leaveText}>{room.owner ? 'Delete this room' : 'Leave this room'}</Text>
          </Pressable>
        )}
      </>
    );
  }

  return (
    <Screen interior="cafe">
      <PageHeader title={title} eyebrow={room?.visibility === 'private' ? 'PRIVATE BOOK ROOM' : 'BOOK ROOM'} fallback="/Test/community" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { paddingHorizontal: 20, paddingBottom: 220, gap: 12 },
  banner: { gap: 6, borderRadius: 12, padding: 18 },
  bannerMeta: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 1.8, color: 'rgba(255,255,255,0.75)' },
  bannerText: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20, color: colors.text },
  bannerNote: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 19, color: 'rgba(255,255,255,0.8)', marginTop: 6 },
  shelfLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 8 },
  shelfLinkText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text, textDecorationLine: 'underline' },
  invite: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border, backgroundColor: 'rgba(0,0,0,0.22)' },
  code: { fontFamily: fonts.sansBold, fontSize: 24, letterSpacing: 5, color: colors.text, marginTop: 2 },
  inviteShare: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  membersRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  members: { paddingHorizontal: 6, paddingTop: 4, gap: 2 },
  member: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.14)' },
  addFriend: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 9, borderRadius: 6, borderWidth: 1, borderColor: colors.border },
  addFriendText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.text },
  composer: { borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  input: { minHeight: 44, color: colors.text, fontFamily: fonts.sans, fontSize: 15, outlineStyle: 'none' } as object,
  composerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  spoilerToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  send: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.pink, alignItems: 'center', justifyContent: 'center' },
  join: { height: 50, borderRadius: 10, backgroundColor: colors.pink, alignItems: 'center', justifyContent: 'center' },
  joinText: { fontFamily: fonts.sansBold, fontSize: 15, color: '#29123C' },
  post: { gap: 10, paddingVertical: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.18)' },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(155,107,214,0.4)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
  author: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.text },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.text },
  spoiler: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderStyle: 'dashed', borderColor: colors.border },
  leave: { alignSelf: 'center', paddingVertical: 14, marginTop: 10 },
  leaveText: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.danger },
});
