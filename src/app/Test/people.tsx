import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../components/Screen';
import { PageHeader } from '../../components/PageHeader';
import { EmptyState } from '../../components/EmptyState';
import { Reveal } from '../../components/Reveal';
import { colors, fonts, type } from '../../../theme';
import { supabase } from '../../../lib/supabase';
import { notify } from '../../../lib/notify';
import { acceptFriendRequest, declineFriendRequest, getMyFriendships, searchUsers, sendFriendRequest, type MyFriendships, type UserSearchResult } from '../../../lib/db/friends';

type Person = { id: string; username: string | null; display_name: string | null };

const name = (p: Person) => p.display_name || p.username || 'Listener';

export default function People() {
  const [data, setData] = useState<MyFriendships | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const load = useCallback(() => {
    setError(null);
    getMyFriendships(supabase).then(setData, (e: Error) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  // Search as you type, after a short pause so we don't query on every keystroke.
  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const timer = setTimeout(() => searchUsers(supabase, query).then(setResults, () => setResults([])), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const add = async (person: UserSearchResult) => {
    try {
      await sendFriendRequest(supabase, person.id);
      setRequested(new Set(requested).add(person.id));
    } catch (e) {
      notify('Could not send request', (e as Error).message);
    }
  };

  const respond = async (friendshipId: string, accept: boolean) => {
    try {
      await (accept ? acceptFriendRequest : declineFriendRequest)(supabase, friendshipId);
      load();
    } catch (e) {
      notify('Something went wrong', (e as Error).message);
    }
  };

  const known = new Set([...(data?.friends ?? []), ...(data?.outgoingRequests ?? []), ...(data?.incomingRequests ?? [])].map((f) => f.other_user.id));

  return (
    <Screen scene="aurora">
      <PageHeader title="People" eyebrow="FRIENDS" fallback="/Test/community" />
      <View style={s.field}>
        <Ionicons name="person-add-outline" size={18} color={colors.dim} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Find friends by name or username" placeholderTextColor={colors.faint} style={s.input} autoCapitalize="none" />
      </View>

      <ScrollView contentContainerStyle={s.page} keyboardShouldPersistTaps="handled">
        {query.trim().length >= 2 ? (
          results.length === 0 ? (
            <Text style={[type.body, { textAlign: 'center', marginTop: 20 }]}>No listeners found for “{query.trim()}”.</Text>
          ) : (
            results.map((p, i) => (
              <Reveal key={p.id} index={i}>
                <PersonRow person={p}>
                  {known.has(p.id) || requested.has(p.id) ? (
                    <Text style={type.meta}>{requested.has(p.id) ? 'Requested' : 'Connected'}</Text>
                  ) : (
                    <SmallButton label="Add" icon="add" onPress={() => add(p)} />
                  )}
                </PersonRow>
              </Reveal>
            ))
          )
        ) : error ? (
          <EmptyState title="Couldn't reach your friends" body={error.includes('authenticated') ? 'Sign in to see and add friends.' : error} action={error.includes('authenticated') ? 'Sign in' : 'Try again'} onAction={error.includes('authenticated') ? () => router.push('/Test/login') : load} />
        ) : !data ? (
          <ActivityIndicator color={colors.pink} style={{ marginTop: 40 }} />
        ) : (
          <>
            {data.incomingRequests.length > 0 && <Text style={s.section}>WANTS TO CONNECT</Text>}
            {data.incomingRequests.map((f, i) => (
              <Reveal key={f.id} index={i}>
                <PersonRow person={f.other_user}>
                  <SmallButton label="Accept" icon="checkmark" onPress={() => respond(f.id, true)} />
                  <Pressable onPress={() => respond(f.id, false)} hitSlop={8} accessibilityLabel="Decline"><Ionicons name="close" size={20} color={colors.faint} /></Pressable>
                </PersonRow>
              </Reveal>
            ))}
            <Text style={s.section}>FRIENDS · {data.friends.length}</Text>
            {data.friends.length === 0 ? (
              <EmptyState title="Listening is better together" body="Search above to find friends and see what they're reading." />
            ) : (
              data.friends.map((f, i) => (
                <Reveal key={f.id} index={i}>
                  <PersonRow person={f.other_user} />
                </Reveal>
              ))
            )}
            {data.outgoingRequests.length > 0 && <Text style={type.meta}>{data.outgoingRequests.length} request{data.outgoingRequests.length > 1 ? 's' : ''} waiting for a reply</Text>}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function PersonRow({ person, children }: { person: Person; children?: React.ReactNode }) {
  return (
    <View style={s.row}>
      <View style={s.avatar}><Text style={s.avatarText}>{name(person).charAt(0).toUpperCase()}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{name(person)}</Text>
        {person.username && <Text style={type.meta}>@{person.username}</Text>}
      </View>
      {children}
    </View>
  );
}

function SmallButton({ label, icon, onPress }: { label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={s.small} accessibilityRole="button">
      <Ionicons name={icon} size={15} color="#29123C" />
      <Text style={s.smallText}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  field: { marginHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 10, height: 52, borderRadius: 26, paddingHorizontal: 18, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.text, fontFamily: fonts.sansMd, fontSize: 15, outlineStyle: 'none' } as object,
  page: { padding: 20, paddingBottom: 220 },
  section: { fontFamily: fonts.sansBold, fontSize: 12, letterSpacing: 2.2, color: colors.dim, marginTop: 8, marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.18)' },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(155,107,214,0.4)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.text },
  name: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.text },
  small: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, height: 32, borderRadius: 16, backgroundColor: colors.pink },
  smallText: { fontFamily: fonts.sansBold, fontSize: 13, color: '#29123C' },
});
