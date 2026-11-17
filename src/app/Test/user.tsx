import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { CityLoader } from '../../components/CityLoader';
import { Avatar } from '../../components/Avatar';
import { colors, fonts, type } from '../../../theme';
import { notify } from '../../../lib/notify';
import { supabase } from '../../../lib/supabase';
import { acceptFriendRequest, getMyFriendships } from '../../../lib/db/friends';
import { requestFriend, type FriendState } from '../../data/community';
import { getProfile, type ProfileView } from '../../data/avatars';

// Same rounding as your own Profile tab: whole hours, "<1" under an hour.
const hoursLabel = (seconds: number) => (seconds < 3600 ? (seconds > 0 ? '<1' : '0') : String(Math.floor(seconds / 3600)));

type Loaded = { profile: ProfileView; friend: FriendState; incomingId?: string; me: boolean };

// Another reader's profile, opened by tapping their name in a book room (or a mutual friend here). Shows their stats,
// the rooms you're both in and friends you share, with a friend request button.
export default function UserProfile() {
  const { id = '' } = useLocalSearchParams<{ id?: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(() => {
    let active = true;
    setError(null);
    Promise.all([getProfile(id), getMyFriendships(supabase), supabase.auth.getSession()]).then(
      ([profile, friendships, session]) => {
        if (!active) return;
        const incoming = friendships.incomingRequests.find((f) => f.other_user.id === id);
        const friend: FriendState = friendships.friends.some((f) => f.other_user.id === id) ? 'friend'
          : incoming ? 'received'
          : friendships.outgoingRequests.some((f) => f.other_user.id === id) ? 'sent'
          : 'none';
        setData({ profile, friend, incomingId: incoming?.id, me: session.data.session?.user.id === id });
      },
      (e: Error) => active && setError(e.message),
    );
    return () => { active = false; };
  }, [id]);
  useFocusEffect(load);

  const befriend = async () => {
    if (!data || sending) return;
    setSending(true);
    try {
      if (data.friend === 'received' && data.incomingId) {
        await acceptFriendRequest(supabase, data.incomingId);
        setData({ ...data, friend: 'friend' });
      } else {
        await requestFriend(id);
        setData({ ...data, friend: 'sent' });
      }
    } catch (e) {
      notify('Couldn’t send the request', (e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const name = data ? data.profile.displayName || data.profile.username : '';

  let body;
  if (error) {
    body = <EmptyState title="Couldn’t open this profile" body={error} action="Try again" onAction={load} />;
  } else if (!data) {
    body = <CityLoader scene="ember" label="Opening the profile…" />;
  } else {
    const { profile } = data;
    body = (
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.head}>
          <Avatar name={name} path={profile.avatarUrl} size={96} style={s.bigAvatar} />
          <Text style={s.name}>{name}</Text>
          <Text style={type.meta}>@{profile.username}</Text>
          {profile.bio ? <Text style={[type.body, { textAlign: 'center' }]}>{profile.bio}</Text> : null}
          {!data.me && (
            data.friend === 'friend' ? (
              <View style={s.badge}><Ionicons name="checkmark" size={14} color={colors.text} /><Text style={s.badgeText}>Friends</Text></View>
            ) : data.friend === 'sent' ? (
              <View style={s.badge}><Ionicons name="time-outline" size={14} color={colors.dim} /><Text style={[s.badgeText, { color: colors.dim }]}>Request sent</Text></View>
            ) : (
              <Pressable onPress={befriend} disabled={sending} style={[s.request, sending && { opacity: 0.5 }]} accessibilityRole="button">
                {sending ? <ActivityIndicator color="#29123C" /> : (
                  <>
                    <Ionicons name={data.friend === 'received' ? 'checkmark' : 'person-add-outline'} size={16} color="#29123C" />
                    <Text style={s.requestText}>{data.friend === 'received' ? 'Accept friend request' : 'Send friend request'}</Text>
                  </>
                )}
              </Pressable>
            )
          )}
        </View>

        {profile.stats ? (
          <View style={s.stats}>
            {[
              [String(profile.stats.books), 'Books'],
              [hoursLabel(profile.stats.listenSeconds), 'Hours'],
              [String(profile.stats.streak), 'Day streak'],
            ].map(([n, l], i) => (
              <View key={l} style={[s.stat, i > 0 && s.divider]}>
                <Text style={s.statNumber}>{n}</Text>
                <Text style={type.meta}>{l}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[type.meta, { textAlign: 'center' }]}>{name} keeps their listening stats private.</Text>
        )}

        <Text style={s.section}>{data.me ? 'YOUR BOOK ROOMS' : 'BOOK ROOMS YOU SHARE'}</Text>
        {profile.sharedRooms.length === 0 ? (
          <Text style={type.meta}>{data.me ? 'You haven’t joined any rooms yet.' : 'You’re not in any rooms together yet.'}</Text>
        ) : (
          <View style={s.list}>
            {profile.sharedRooms.map((room, i) => (
              <Pressable key={room.id} onPress={() => router.push({ pathname: '/Test/room', params: { id: room.id, title: room.name } })} style={[s.row, i > 0 && s.rowLine]} accessibilityRole="button">
                <Ionicons name="chatbubbles-outline" size={18} color={colors.blue} />
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle} numberOfLines={1}>{room.name}</Text>
                  <Text style={type.meta} numberOfLines={1}>{room.bookTitle}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.faint} />
              </Pressable>
            ))}
          </View>
        )}

        {!data.me && (
          <>
            <Text style={s.section}>MUTUAL FRIENDS</Text>
            {profile.mutualFriends.length === 0 ? (
              <Text style={type.meta}>No friends in common yet.</Text>
            ) : (
              <View style={s.list}>
                {profile.mutualFriends.map((friend, i) => (
                  <Pressable key={friend.id} onPress={() => router.push({ pathname: '/Test/user', params: { id: friend.id } })} style={[s.row, i > 0 && s.rowLine]} accessibilityRole="button">
                    <Avatar name={friend.displayName || friend.username} path={friend.avatarUrl} size={34} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.rowTitle} numberOfLines={1}>{friend.displayName || friend.username}</Text>
                      <Text style={type.meta}>@{friend.username}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.faint} />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <Screen interior="cafe">
      <PageHeader title={name || 'Profile'} eyebrow="LISTENER" fallback="/Test/community" />
      {body}
    </Screen>
  );
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingBottom: 60, gap: 12 },
  head: { alignItems: 'center', gap: 6, marginBottom: 12 },
  bigAvatar: { borderWidth: 2, borderColor: 'rgba(214,123,176,0.4)', marginBottom: 6 },
  name: { fontFamily: fonts.serif, fontSize: 26, color: colors.text },
  request: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, backgroundColor: colors.pink },
  requestText: { fontFamily: fonts.sansBold, fontSize: 14, color: '#29123C' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 13, color: colors.text },
  stats: { flexDirection: 'row', borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 18 },
  stat: { flex: 1, alignItems: 'center' },
  statNumber: { fontFamily: fonts.sansBold, fontSize: 28, color: colors.text },
  divider: { borderLeftWidth: 1, borderLeftColor: colors.border },
  section: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 2.5, color: colors.dim, marginTop: 14 },
  list: { borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowLine: { borderTopWidth: 1, borderTopColor: colors.border },
  rowTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.text },
});
